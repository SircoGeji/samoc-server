import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Offer, RetentionOffer } from '../../../models';
import { CodeType, Env, OfferTypes } from '../../../types/enum';
import { retWithSuccess } from '../../../models/SamocResponse';
import {
  AppError,
  BambooIsBusyError,
  BambooIsOfflineError,
} from '../../../util/errorHandler';
import Logger from '../../../util/logger';
import { build, BuildResponse } from '../../../services/Bamboo';
import { OfferModel } from '../../../models/Offer';
import pRetry from 'p-retry';
import {
  getFlexSiteUrl,
  getTargetEnv,
  OFFER_QUERY_OPTS,
  pRetryOptions,
  processCampaignError,
  RETENTION_OFFER_QUERY_OPTS,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../../util/utils';
import * as CmsApi from '../../../services/CmsApi';
import { io } from '../../../server';
import * as httpContext from 'express-http-context';
import {
  DISABLE_CAMPAIGN_ROLLBACK,
  USE_PARALLEL_VALIDATION,
} from '../../../util/config';
import {
  BambooApiCfg,
  checkBambooIsBusy,
  checkCouponIsReady,
  CheckCouponIsReadyResponse,
  getOfferTypeKey,
  getValdnStatus,
  getValidatedStatus,
  isStatusAllowedForValidate,
  offerDIT,
  rollbackOfferForValidate,
  rollbackRetentionOfferForValidate,
} from '../validateOffer';
import { Plan } from '../../../models';
import { RetentionOfferModel } from '../../../models/RetentionOffer';
import {
  addCatchAllRules,
  restoreConfigurationValue,
  SavedRules,
} from '../../../services/CmsApi';

const logger = Logger(module);
const logPrefix = (env: Env) => {
  return `[${env.toUpperCase()}] Validate Offer Controller:`;
};

const validateOffer = async (
  campaignId: string,
  offerModel: OfferModel,
  errorMessages: AppError[],
  updatedBy: string,
) => {
  // Step 1) find offer in database by offerId and find offer env
  const planCode = offerModel.planCode;
  const store = offerModel.Plan.Store;

  if (!isStatusAllowedForValidate(offerModel.statusId)) {
    return;
  }

  httpContext.set('planCode', planCode);
  const targetEnv: Env = getTargetEnv(offerModel);
  httpContext.set('env', targetEnv);

  const updateOfferValidationFailed = async () => {
    logger.debug(`[${targetEnv}] Update offer status to Validation Failed`);
    await updateOfferStatus(offerModel, getValdnStatus(targetEnv));
    io.emit('offer-status-updated', offerModel.toJSON());
  };

  // Step 2) Check if bamboo is available with exported const checkBambooIsBusy
  const uniqueOfferCode = { code: '' };

  // Step 7) skip bamboo validation for non-US offers
  const bamBooValidation = async () => {
    updateSpinnerText('Triggering Bamboo validation...');
    if (offerModel.Plan.Store.regionCode == 'us') {
      const offerCode = uniqueOfferCode.code
        ? uniqueOfferCode.code
        : offerModel.offerCode;
      const cfg = {
        valdnEnv: targetEnv,
        offersUrl: getFlexSiteUrl(
          targetEnv,
          offerModel.storeCode.slice(-2),
          '/us/en/offers?optly=false',
        ),
        offerType: getOfferTypeKey(
          offerModel ? offerModel.OfferType.offerTypeId : OfferTypes.RETENTION,
        ),
        offerCode: offerCode,
      } as BambooApiCfg;

      let buildResponse: BuildResponse;
      try {
        buildResponse = await build(cfg);
      } catch (err) {
        if (err instanceof BambooIsBusyError) {
          // do not rollback, can try again
          throw new AppError(
            `Another offer on ${targetEnv.toUpperCase()} is being validated on Bamboo, please try again in a few minutes.`,
            400,
          );
        }

        if (err instanceof BambooIsOfflineError) {
          // do not rollback, can try again
          throw new AppError(
            `${targetEnv.toUpperCase()} Bamboo may be down for scheduled maintenance. Please retry publishing the offer later.`,
            503,
          );
        }

        throw new AppError(
          `Offer validation for (${
            offerModel.offerCode
          }) was not started on ${targetEnv.toUpperCase()}, please try again in a few minutes.  ${
            err.message
          }`,
          400,
        );
      }

      if (buildResponse.buildResultKey) {
        // success
        offerModel.statusId = getValdnStatus(targetEnv, true);
        offerModel.bambooBuildKey = buildResponse.buildResultKey;
      } else {
        // fail
        offerModel.statusId = getValdnStatus(targetEnv, false);
      }
    } else {
      offerModel.statusId = getValidatedStatus(targetEnv);
    }
    // update db
    const updateDb = async () => {
      await offerModel.save();
      io.emit('offer-status-updated', offerModel.toJSON());
    };
    await pRetry(updateDb, pRetryOptions);
  };

  const isCouponReady: CheckCouponIsReadyResponse = await pRetry(
    () => checkCouponIsReady(offerModel, targetEnv),
    pRetryOptions,
  );

  if (
    isCouponReady.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
    !isCouponReady.ready
  ) {
    throw new AppError(
      `Offer on ${targetEnv.toUpperCase()} is generating unique codes, please try again later.`,
      400,
    );
  } else if (
    isCouponReady.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
    isCouponReady.ready
  ) {
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    try {
      await CmsApi.clearCmsApiCache(targetEnv);
    } catch (err) {
      logger.error(
        `${logPrefix(
          targetEnv,
        )} Clearing Contentful cache failed on ${targetEnv.toUpperCase()}, ${
          err.message
        }`,
        err,
      );
      updateSpinnerText('Validate offer failed, performing rollback...');
      if (!DISABLE_CAMPAIGN_ROLLBACK) {
        await rollbackOfferForValidate(offerModel, targetEnv, updatedBy);
      }
      await updateOfferValidationFailed();
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${store.regionCode.toUpperCase()}: ${appErr.message}`;
      errorMessages.push(appErr);
    }
  } else {
    // do nothing, continue with validations
  }

  // run step 3 - 6 together and if any reject will throw error
  try {
    await offerDIT(
      offerModel.offerCode,
      offerModel,
      null,
      store,
      targetEnv,
      uniqueOfferCode,
      true,
      false,
    );
    offerModel.statusId = getValidatedStatus(targetEnv);
    await offerModel.save();
  } catch (err) {
    logger.error(
      `${logPrefix(
        targetEnv,
      )} Validation failed on ${targetEnv.toUpperCase()}, ${err.message}`,
      err,
    );
    updateSpinnerText('Validate offer failed, performing rollback...');
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      try {
        await rollbackOfferForValidate(offerModel, targetEnv, updatedBy);
      } catch (e) {
        const appErr = processCampaignError(campaignId, e);
        appErr.message = `${store.regionCode.toUpperCase()}: ${appErr.message}`;
        errorMessages.push(appErr);
      }
    }
    await updateOfferValidationFailed();
    const appErr = processCampaignError(campaignId, err);
    appErr.message = `${store.regionCode.toUpperCase()}: ${appErr.message}`;
    errorMessages.push(appErr);
  }
};

const validateRetentionOffer = async (
  campaignId: string,
  offerModel: RetentionOfferModel,
  errorMessages: AppError[],
  updatedBy: string,
) => {
  // Step 1) find offer in database by offerId and find offer env
  const store = offerModel.Store;
  const prefix = store.regionCode.toUpperCase() + ': ';

  if (!isStatusAllowedForValidate(offerModel.statusId)) {
    return;
  }

  const targetEnv: Env = getTargetEnv(offerModel);
  httpContext.set('env', targetEnv);

  const updateOfferValidationFailed = async () => {
    logger.debug(`[${targetEnv}] Update offer status to Validation Failed`);
    await updateRetentionOfferStatus(offerModel, getValdnStatus(targetEnv));
    io.emit('offer-status-updated', offerModel.toJSON());
  };

  // Step 2) Check if bamboo is available with exported const checkBambooIsBusy
  const uniqueOfferCode = { code: '' };

  // run step 3 - 6 together and if any reject will throw error
  try {
    await offerDIT(
      offerModel.offerCode,
      null,
      offerModel,
      store,
      targetEnv,
      uniqueOfferCode,
      true,
      false,
    );
    offerModel.statusId = getValidatedStatus(targetEnv);
    await offerModel.save();
  } catch (err) {
    logger.error(
      `${logPrefix(
        targetEnv,
      )} Validation failed on ${targetEnv.toUpperCase()}, ${err.message}`,
      err,
    );
    updateSpinnerText(`${prefix}Validate offer failed, performing rollback...`);
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      try {
        await rollbackRetentionOfferForValidate(
          offerModel,
          targetEnv,
          updatedBy,
        );
      } catch (e) {
        const appErr = processCampaignError(campaignId, e);
        appErr.message = `${store.regionCode.toUpperCase()}: ${appErr.message}`;
        errorMessages.push(appErr);
      }
    }
    await updateOfferValidationFailed();
    const appErr = processCampaignError(campaignId, err);
    appErr.message = `${store.regionCode.toUpperCase()}: ${appErr.message}`;
    errorMessages.push(appErr);
  }
};

/**
 * GET /api/offers/campaign/:campaignId/validate
 * Validate an existing offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const validateCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(`Validate Campaign controller start`);
    const { campaignId } = req.params;
    const { updatedBy } = req.query;
    httpContext.set('campaign', campaignId);
    updateSpinnerText('Validating campaign...');

    let retentionOfferModels: RetentionOfferModel[] = null;
    const offerModels: OfferModel[] = await Offer.findAll({
      include: [{ model: Plan }],
      ...OFFER_QUERY_OPTS,
      where: { campaign: campaignId },
    });
    if (offerModels.length === 0) {
      retentionOfferModels = await RetentionOffer.findAll({
        ...RETENTION_OFFER_QUERY_OPTS,
        where: { campaign: campaignId },
      });
      if (retentionOfferModels.length === 0) {
        throw new AppError(`Campaign (${campaignId}) not found`, 404);
      }
    }

    const errorMessages: AppError[] = [];

    if (offerModels && offerModels.length) {
      const countryOffers = offerModels.filter((offer) =>
        isStatusAllowedForValidate(offer.statusId),
      );
      if (countryOffers.length > 0) {
        if (USE_PARALLEL_VALIDATION) {
          const allRegions = countryOffers.map((offerModel) =>
            validateOffer(
              campaignId,
              offerModel,
              errorMessages,
              updatedBy as string,
            ),
          );
          await Promise.all(allRegions);
        } else {
          for (const offerModel of countryOffers) {
            await validateOffer(
              campaignId,
              offerModel,
              errorMessages,
              updatedBy as string,
            );
          }
        }
      }
    }
    if (retentionOfferModels && retentionOfferModels.length) {
      const countryOffers = retentionOfferModels
        .filter((offer) => isStatusAllowedForValidate(offer.statusId))
        .map((offer) => {
          return {
            offer,
            statusId: offer.statusId,
            regionCode: offer.Store.regionCode,
            offers: offer.upgradeOfferCode
              ? [offer.offerCode, offer.upgradeOfferCode]
              : [offer.offerCode],
          };
        });
      if (countryOffers.length > 0) {
        let configValue: SavedRules[] = [];
        const env = getTargetEnv(countryOffers[0].offer);
        try {
          configValue = await addCatchAllRules(
            getTargetEnv(countryOffers[0].offer),
            countryOffers,
          );
          if (USE_PARALLEL_VALIDATION) {
            const allRegions = countryOffers.map((offer) =>
              validateRetentionOffer(
                campaignId,
                offer.offer,
                errorMessages,
                updatedBy as string,
              ),
            );
            await Promise.all(allRegions);
          } else {
            for (const offer of countryOffers) {
              await validateRetentionOffer(
                campaignId,
                offer.offer,
                errorMessages,
                updatedBy as string,
              );
            }
          }
        } finally {
          if (configValue) {
            await restoreConfigurationValue(env, configValue);
          }
        }
      }
    }

    if (errorMessages.length) {
      const statusCode = errorMessages[0].statusCode;
      const messages = errorMessages.map((m) => m.message).join('\n');
      return next(
        processCampaignError(campaignId, new AppError(messages, statusCode)),
      );
    }
    retWithSuccess(req, res, {
      message: `Campaign (${campaignId}) validated successfully`,
      data: null,
    });
  },
);
