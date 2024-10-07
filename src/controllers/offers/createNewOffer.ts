import { NextFunction, Request, Response } from 'express';
import Logger from '../../util/logger';
import {
  AppError,
  CmsApiError,
  ContentfulError,
  GhostLockerError,
  PlayAuthError,
  PreUpdateRemoteError,
  RecurlyError,
  ValidateGhostLockerError,
} from '../../util/errorHandler';
import {
  getOfferModel,
  getPlanModel,
  getFlexSiteUrl,
  pRetryOptions,
  processOfferError,
  retrieveRecurlyPlan,
  updateOfferDbProperties,
  updateOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import { Offer, OfferHistory, OfferType } from '../../models';
import { OfferModel } from '../../models/Offer';
import { retWithSuccess } from '../../models/SamocResponse';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../types/enum';
import {
  OfferContentfulPayload,
  OfferDbPayload,
  OfferRecurlyPayload,
} from '../../types/payload';
import asyncHandler from 'express-async-handler';
import pRetry from 'p-retry';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as PlayAuth from '../../services/PlayAuth';
import * as GhostLocker from '../../services/GhostLocker';
import { GLSet } from '../../services/GhostLocker';
import * as CmsApi from '../../services/CmsApi';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { createNewRetentionOffer } from './createNewRetentionOffer';
import { uniqueCampaignId } from './campaign/utils';
import { createOfferHistoryInDb } from './offerHistory';
import { setOfferModelDraftDataErrMessage } from '.';
import { createNewExtensionOffer } from './extension/createNewExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Create Offer Controller:`;
  } else {
    return `Create Offer Controller:`;
  }
};

/**
 * POST /api/offers/create
 * Create a new offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const createNewOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - createNewOffer');
    const offerTypeId = (req.body as OfferDbPayload).offerTypeId;
    if (offerTypeId == OfferTypes.RETENTION) {
      return createNewRetentionOffer(req, res, next);
    } else if (offerTypeId == OfferTypes.EXTENSION) {
      return createNewExtensionOffer(req, res, next);
    }
    updateSpinnerText('Creating offer...');
    let offerModel: OfferModel;
    const dbPayload = req.body as OfferDbPayload;
    let updatedBy;
    try {
      // create offer in STG
      const contentfulPayload = req.body as OfferContentfulPayload;
      const recurlyPayload = req.body as OfferRecurlyPayload;

      httpContext.set('offerCode', dbPayload.offerCode);
      httpContext.set('planCode', dbPayload.planCode);
      httpContext.set('env', Env.STG);
      const plan = await getPlanModel(dbPayload.planCode);
      if (!dbPayload.campaign) {
        dbPayload.campaign = await uniqueCampaignId(dbPayload.offerCode);
        dbPayload.campaignName = '';
      }
      if (!dbPayload.storeCode) {
        dbPayload.storeCode = plan.storeCode;
      }
      offerModel = await getOfferModel(
        dbPayload.storeCode,
        dbPayload.offerCode,
      );
      if (offerModel) {
        if (!isStatusAllowed(offerModel.statusId)) {
          return next(
            new AppError(
              `Invalid status for Offer (${offerModel.offerCode}): ${offerModel.Status.description} (${offerModel.Status.title})`,
            ),
          );
        }
        offerModel = updateOfferDbProperties(offerModel, dbPayload);
      } else {
        try {
          offerModel = await createOfferInDb(dbPayload, StatusEnum.STG);
        } catch (err) {
          logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
          if (err.name === 'SequelizeForeignKeyConstraintError') {
            return next(
              new AppError(
                `The offer could not be saved. DB error: Invalid value for ${err.fields}`,
                err.statusCode ? err.statusCode : 500,
              ),
            );
          }
          return next(
            new AppError(
              `The offer could not be saved. DB error: ${err.message}`,
              err.statusCode ? err.statusCode : 500,
            ),
          );
        }
        offerModel.Plan = plan;
      }

      // check if the plan exists in Recurly stg
      updateSpinnerText('Creating Recurly coupon...');
      const recurlyPlan = await retrieveRecurlyPlan(
        offerModel.planCode,
        offerModel.Plan.Store,
        Env.STG,
      );

      // 1. create coupon on Recurly
      const couponId = await Recurly.createCoupon(
        recurlyPayload,
        recurlyPlan,
        offerModel.Plan.Store,
        Env.STG,
        offerModel.statusId,
      );
      offerModel.set('couponId', couponId);

      // 2. publish to GhostLocker
      // offerModel.glConfigVersion = null;
      updateSpinnerText('Updating GhostLocker config...');
      const response = await GhostLocker.updateOfferConfig(
        dbPayload.offerCode,
        dbPayload.offerTypeId,
        dbPayload.planCode,
        offerModel.Plan.Store.regionCode,
        false,
        Env.STG,
      );
      // save the rollback config version to model
      offerModel.glRollbackVersion = response.configurationVersion - 1;

      // 3. clear PlayAuth cache
      updateSpinnerText('Clearing PlayAuth cache...');
      await PlayAuth.clearOfferCache(offerModel.Plan.Store, Env.STG);

      // 4. Validate GhostLocker (via PlayAuth)
      let uniqueOfferCode: string;
      if (recurlyPayload.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
        uniqueOfferCode = await Recurly.fetchBulkCode(offerModel, Env.STG);
      }
      updateSpinnerText('Validating GhostLocker...');
      await PlayAuth.validateGl(
        offerModel.Plan.Store.regionCode,
        getFlexSiteUrl(Env.STG, offerModel.Plan.Store.regionCode),
        Env.STG,
        dbPayload.offerCode,
        uniqueOfferCode,
      );

      // 5. publish to Contentful
      updateSpinnerText('Processing Contentful entry...');
      await Contentful.createSpecialOffer(
        req.body,
        offerModel.Plan,
        recurlyPlan,
        Env.STG,
      );

      // 6. Remove Cache
      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(Env.STG);

      // 7. update offer status in DB
      offerModel.draftData = req.body;
      if (req.body.offerBoldedText === '') {
        (offerModel.draftData as any).offerBoldedText = Contentful.getFormattedTotal(
          req.body as OfferContentfulPayload,
          recurlyPlan,
        )
          .replace('<span>', '')
          .replace('</span>', '');
      }
      const newOffer = await updateOfferStatus(offerModel, StatusEnum.STG);
      updateSpinnerText('Offer created successfully');

      // 8. save offer in offers history
      const createdBy = req.body.updatedBy;
      const updatedBy = req.body.updatedBy;
      const offerHistory = await createOfferHistoryInDb(
        newOffer,
        createdBy,
        updatedBy,
      );

      retWithSuccess(req, res, {
        message: `Offer (${
          offerModel.offerCode
        }) created successfully on ${Env.STG.toUpperCase()}`,
        status: 201,
        data: null,
      });
    } catch (err) {
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
      updateSpinnerText('Create offer failed, performing rollback...');
      if (!DISABLE_ROLLBACK) {
        await rollbackOffer(err, offerModel, updatedBy);
      }
      // update status if rollback succeed
      let status;
      if (err instanceof PreUpdateRemoteError || err instanceof RecurlyError) {
        status = StatusEnum.STG_ERR_CRT;
      } else {
        status = StatusEnum.STG_FAIL;
      }
      offerModel.draftData = req.body;
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateOfferStatus(offerModel, status);
      return next(processOfferError(err));
    }
  },
);

export const createOfferInDb = async (
  payload: OfferDbPayload,
  statusId: StatusEnum,
): Promise<OfferModel> => {
  let result: OfferModel = null;
  if (!payload.campaign) {
    payload.campaign = await uniqueCampaignId(payload.offerCode);
    payload.campaignName = '';
  }
  const dbOfferOp = async () => {
    const commonPayload = {
      offerCode: payload.offerCode,
      storeCode: payload.storeCode,
      campaign: payload.campaign,
      campaignName: payload.campaignName,
      offerTypeId: payload.offerTypeId,
      planCode: payload.planCode,
      statusId: statusId,
    } as any;
    if (statusId === StatusEnum.DFT) {
      const draftPayload = {
        ...commonPayload,
        draftData: payload,
      } as any;
      result = await Offer.create(draftPayload);
    } else {
      result = await Offer.build({
        ...commonPayload,
        draftData: null, // clear previously saved data
        cta: payload.offerCTA,
        businessOwner: payload.offerBusinessOwner,
        vanityUrl: payload.offerVanityUrl,
        totalUniqueCodes: payload.totalUniqueCodes || null,
        // onTime is currently not used in Phase 2
        // onTime: new Date(payload.publishDateTime),
      });
    }
  };
  // setup retry mechanism
  await pRetry(dbOfferOp, pRetryOptions);
  return result;
};

export const isStatusAllowed = (status: StatusEnum): boolean => {
  const allowableStatus = [
    StatusEnum.DFT,
    StatusEnum.STG_ERR_CRT,
    StatusEnum.STG_FAIL,
  ];
  return allowableStatus.includes(status);
};

export const rollbackOffer = async (
  err: AppError,
  offer: OfferModel,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(Env.STG)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (
      err instanceof GhostLockerError ||
      err instanceof PlayAuthError ||
      err instanceof ValidateGhostLockerError ||
      err instanceof ContentfulError ||
      err instanceof CmsApiError
    ) {
      if (err instanceof CmsApiError) {
        await Contentful.archiveSpecialOffer(offer);
      }
      if (!(err instanceof GhostLockerError)) {
        // rollback GL and expire recurly coupon
        await GhostLocker.rollbackToVersion(
          GLSet.PROMO_RECURLY,
          offer.offerCode,
          offer.glRollbackVersion,
          Env.STG,
        );
      }
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Plan.Store,
        Env.STG,
        updatedBy,
      );
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(Env.STG)} Rollback failed, ${err.message}`,
      rbErr,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status
    await updateOfferStatus(offer, StatusEnum.STG_RB_FAIL);
    throw new AppError(
      `Rollback failed for Create Offer on ${Env.STG.toUpperCase()}: ${
        rbErr.message
      }`,
      rbErr.statusCode ? rbErr.statusCode : 500,
    );
  } finally {
    logger.debug(
      `${logPrefix(Env.STG)} Rollback task completed for (${offer.offerCode}).`,
    );
  }
};
