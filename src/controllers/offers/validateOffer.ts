import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Offer, RetentionOffer } from '../../models';
import {
  CodeType,
  ContentfulEntryState,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../types/enum';
import { retWithSuccess } from '../../models/SamocResponse';
import {
  AppError,
  BambooIsBusyError,
  BambooIsOfflineError,
  CmsApiError,
  ContentfulError,
  GhostLockerError,
  RecurlyError,
} from '../../util/errorHandler';
import Logger from '../../util/logger';
import { build, BuildResponse } from '../../services/Bamboo';
import { OfferModel } from '../../models/Offer';
import pRetry from 'p-retry';
import {
  getOfferModel,
  getRetentionOfferModel,
  getFlexSiteUrl,
  getTargetEnv,
  pRetryOptions,
  processOfferError,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import * as CmsApi from '../../services/CmsApi';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as GhostLocker from '../../services/GhostLocker';
import { GLSet } from '../../services/GhostLocker';
import * as PlayAuth from '../../services/PlayAuth';
import { io } from '../../server';
import { Op } from 'sequelize';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { StoreModel } from '../../models/Store';
import { setOfferModelDraftDataErrMessage } from '.';

const logger = Logger(module);
const logPrefix = (env: Env) => {
  return `[${env.toUpperCase()}] Validate Offer Controller:`;
};

export const offerDIT = (
  offerCode: string,
  offerModel: OfferModel,
  retentionOfferModel: RetentionOfferModel,
  store: StoreModel,
  targetEnv: Env,
  uniqueOfferCode: { code: string },
  isVerification: boolean,
  catchAll: boolean,
): Promise<void[]> => {
  const prefix = store.regionCode.toUpperCase() + ': ';

  // Step 3) Find and validate offer in recurly
  const recurlyCouponPayload = async () => {
    updateSpinnerText(prefix + 'Performing Recurly validation...');
    const result = await Recurly.getOfferRecurlyPayload(
      offerCode,
      store,
      targetEnv,
    );
    if (result.couponState === 'expired') {
      throw new RecurlyError(
        `Validation failed on ${targetEnv.toUpperCase()}: Offer (${offerCode}) expired on Recurly.`,
      );
    }
  };

  // Step 4) Find and validate offer in contentful
  const contentfulPayload = async () => {
    updateSpinnerText(prefix + 'Performing Contentful validation...');
    const result = await Contentful.fetchSpecialOffer(
      store.regionCode,
      offerCode,
      store.storeCode,
      !!retentionOfferModel,
    );
    if (result.entryState !== ContentfulEntryState.PUBLISHED) {
      throw new ContentfulError(
        `Validation failed on ${targetEnv.toUpperCase()}: Offer (${offerCode}) is ${
          result.entryState
        } on Contentful.`,
      );
    }
    // is in Published entryState, now check for Environment field
    if (targetEnv === Env.PROD && !result.environments.includes('Prod')) {
      throw new ContentfulError(
        `Validation failed on ${targetEnv.toUpperCase()}: Offer (${offerCode})'s environment field does not contain \"Prod\" on Contentful.`,
      );
    } else if (targetEnv === Env.STG && !result.environments.includes('Dev')) {
      throw new ContentfulError(
        `Validation failed on ${targetEnv.toUpperCase()}: Offer (${offerCode})'s environment field does contain \"Dev\" on Contentful.`,
      );
    }
  };

  // Step 5) Find and validate on GL
  const promoOfferExists = async () => {
    updateSpinnerText(prefix + 'Performing GhostLocker validation...');
    let result: boolean;
    if (offerModel) {
      result = await GhostLocker.promoOfferExists(
        offerCode,
        store.regionCode,
        targetEnv,
      );
    } else {
      result = await GhostLocker.retentionOfferExists(
        offerCode,
        store.regionCode,
        targetEnv,
      );
    }
    if (!result) {
      throw new GhostLockerError(
        `Validation failed on ${targetEnv.toUpperCase()}: Offer (${offerCode}) not found on GhostLocker.`,
      );
    }
  };

  // Step 6) Cms api validations
  const cmsApiValidation = async () => {
    updateSpinnerText(prefix + 'Validating offer, this may take a while...');
    try {
      const result = await Recurly.getOfferRecurlyPayload(
        offerCode,
        store,
        targetEnv,
      );
      if (result.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
        uniqueOfferCode.code = await Recurly.fetchBulkCode(
          offerModel,
          targetEnv,
        );
        if (!uniqueOfferCode.code) {
          throw new RecurlyError(
            `Validation failed on ${targetEnv.toUpperCase()}: Recurly - Cannot validate, all unique codes for this bulk offer have been redeemed.`,
            400,
          );
        }
        await CmsApi.verifyOffer(
          store.regionCode,
          offerCode,
          null,
          offerModel.planCode,
          targetEnv,
          uniqueOfferCode.code,
          OfferTypes.ACQUISITION,
          isVerification,
          catchAll,
          [],
        );
      } else {
        await CmsApi.verifyOffer(
          store.regionCode,
          offerCode,
          retentionOfferModel ? retentionOfferModel.upgradeOfferCode : null,
          retentionOfferModel
            ? retentionOfferModel.eligiblePlans.split(',')[0]
            : offerModel.planCode,
          targetEnv,
          null,
          offerModel ? offerModel.OfferType.offerTypeId : OfferTypes.RETENTION,
          isVerification,
          catchAll,
          retentionOfferModel && retentionOfferModel.usersOnPlans
            ? retentionOfferModel.usersOnPlans.split(',')
            : null,
        );
      }
    } catch (err) {
      logger.error(
        `${logPrefix(targetEnv)} cmsApiValidation failed, ${err.message}`,
        err,
      );
      if (err.statusCode === 400) {
        throw err;
      } else {
        throw new CmsApiError(
          `Validation failed on ${targetEnv.toUpperCase()}: CmsAPI validation for Offer (${offerCode}) failed.`,
        );
      }
    }
  };

  return Promise.all([
    recurlyCouponPayload(),
    contentfulPayload(),
    promoOfferExists(),
    cmsApiValidation(),
  ]);
};

/**
 * GET /api/offers/:offerId/validate
 * Validate an existing offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const validateOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(`Validate Offer controller start`);
    const { offerId } = req.params;
    const { store, updatedBy, retire } = req.query;
    const storeCode = store ? (store as string) : null;
    const skipRetire = retire ? retire === 'false' : false;
    httpContext.set('offerCode', offerId);
    updateSpinnerText('Validating offer...');

    // Step 1) find offer in database by offerId and find offer env
    // TODO: replace offerType and targetEvn from database lookup in the future
    let offer: OfferModel | RetentionOfferModel;
    const offerModel: OfferModel = await getOfferModel(storeCode, offerId);
    let retentionOfferModel: RetentionOfferModel;
    if (offerModel) {
      offer = offerModel;
    } else {
      retentionOfferModel = await getRetentionOfferModel(storeCode, offerId);
      if (!retentionOfferModel) {
        return next(new AppError(`Offer (${offerId}) not found`, 404));
      }
      offer = retentionOfferModel;
    }
    const offerType: OfferTypes = offerModel
      ? offerModel.OfferType.offerTypeId
      : OfferTypes.RETENTION;
    let planCode: string;
    let storeModel: StoreModel;
    if (offerModel) {
      planCode = offerModel.planCode;
      storeModel = offerModel.Plan.Store;
    } else {
      planCode = retentionOfferModel.eligiblePlans.split(',')[0];
      storeModel = retentionOfferModel.Store;
    }

    if (!isStatusAllowedForValidate(offer.statusId)) {
      return next(
        new AppError(
          `Invalid status for Offer (${offer.offerCode}): ${offer.Status.description} (${offer.Status.title})`,
          400,
        ),
      );
    }

    httpContext.set('planCode', planCode);
    const targetEnv: Env = getTargetEnv(offer);
    httpContext.set('env', targetEnv);

    const updateOfferValidationFailed = async (err: any) => {
      logger.debug(`[${targetEnv}] Update offer status to Validation Failed`);
      if (offerModel) {
        setOfferModelDraftDataErrMessage(offerModel, err.message);
        await updateOfferStatus(offerModel, getValdnStatus(targetEnv));
      } else {
        setOfferModelDraftDataErrMessage(retentionOfferModel, err.message);
        await updateRetentionOfferStatus(
          retentionOfferModel,
          getValdnStatus(targetEnv),
        );
      }
      io.emit('offer-status-updated', offer.toJSON());
    };

    // Step 2) Check if bamboo is available with exported const checkBambooIsBusy

    const uniqueOfferCode = { code: '' };
    // Step 7) Trigger bamboo build
    const bamBooValidation = async () => {
      updateSpinnerText('Triggering Bamboo validation...');
      const offerCode = uniqueOfferCode.code
        ? uniqueOfferCode.code
        : offer.offerCode;
      const cfg = {
        valdnEnv: targetEnv,
        offersUrl: getFlexSiteUrl(
          targetEnv,
          storeCode.slice(-2),
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
          return next(
            new AppError(
              `Another offer on ${targetEnv.toUpperCase()} is being validated on Bamboo, please try again in a few minutes.`,
              400,
            ),
          );
        }

        if (err instanceof BambooIsOfflineError) {
          // do not rollback, can try again
          return next(
            new AppError(
              `${targetEnv.toUpperCase()} Bamboo may be down for scheduled maintenance. Please retry publishing the offer later.`,
              503,
            ),
          );
        }

        return next(
          new AppError(
            `Offer validation for (${offerId}) was not started on ${targetEnv.toUpperCase()}, please try again in a few minutes.  ${
              err.message
            }`,
            400,
          ),
        );
      }

      if (buildResponse.buildResultKey) {
        // success
        offer.statusId = getValdnStatus(targetEnv, true);
        offer.bambooBuildKey = buildResponse.buildResultKey;
      } else {
        // fail
        offer.statusId = getValdnStatus(targetEnv, false);
      }

      // update db
      const updateDb = async () => {
        await offer.save();
        io.emit('offer-status-updated', offer.toJSON());
      };
      await pRetry(updateDb, pRetryOptions);

      // return response
      retWithSuccess(req, res, {
        message: `Offer (${offerId}) validation started on ${targetEnv.toUpperCase()}`,
        data: buildResponse,
      });
    };

    if (offerType != OfferTypes.RETENTION) {
      const isBambooBusy: boolean = await pRetry(
        checkBambooIsBusy,
        pRetryOptions,
      );

      if (isBambooBusy) {
        return next(
          new AppError(
            `Another offer on ${targetEnv.toUpperCase()} is being validated on Bamboo, please try again in a few minutes.`,
            400,
          ),
        );
      }
    }
    if (offerModel) {
      const isCouponReady: CheckCouponIsReadyResponse = await pRetry(
        () => checkCouponIsReady(offerModel, targetEnv),
        pRetryOptions,
      );

      if (
        isCouponReady.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
        !isCouponReady.ready
      ) {
        return next(
          new AppError(
            `Offer on ${targetEnv.toUpperCase()} is generating unique codes, please try again later.`,
            400,
          ),
        );
      } else if (
        isCouponReady.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
        isCouponReady.ready
      ) {
        updateSpinnerText(
          'Clearing Contentful cache, this may take a while...',
        );
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
          if (!DISABLE_ROLLBACK && !skipRetire) {
            await rollbackOfferForValidate(
              offerModel,
              targetEnv,
              updatedBy as string,
            );
          }
          await updateOfferValidationFailed(err);
          return next(processOfferError(err));
        }
      } else {
        // do nothing, continue with validations
      }
    }

    // run step 3 - 6 together and if any reject will throw error
    try {
      const offerDITOp = async () => {
        await offerDIT(
          offerId,
          offerModel,
          retentionOfferModel,
          storeModel,
          targetEnv,
          uniqueOfferCode,
          true,
          true,
        );
      };
      await pRetry(offerDITOp, pRetryOptions);

      if (offerType !== OfferTypes.RETENTION) {
        offerModel.statusId = getValidatedStatus(targetEnv);
        await offerModel.save();
        retWithSuccess(req, res, {
          message: `Offer (${offerId}) successfully validated on ${targetEnv.toUpperCase()}`,
          data: {},
        });
      } else {
        retentionOfferModel.statusId = getValidatedStatus(targetEnv);
        await retentionOfferModel.save();
        retWithSuccess(req, res, {
          message: `Retention Offer (${offerId}) successfully validated on ${targetEnv.toUpperCase()}`,
          data: {},
        });
      }
    } catch (err) {
      logger.error(
        `${logPrefix(
          targetEnv,
        )} Validation failed on ${targetEnv.toUpperCase()}, ${err.message}`,
        err,
      );
      updateSpinnerText('Validate offer failed, performing rollback...');
      if (!DISABLE_ROLLBACK && !skipRetire) {
        if (offerModel) {
          await rollbackOfferForValidate(
            offerModel,
            targetEnv,
            updatedBy as string,
          );
        } else {
          await rollbackRetentionOfferForValidate(
            retentionOfferModel,
            targetEnv,
            updatedBy as string,
          );
        }
      }
      await updateOfferValidationFailed(err);
      return next(processOfferError(err));
    }
  },
);

export const getOfferTypeKey = (offerTypeId: number): string => {
  let result = 'default';
  if (offerTypeId === OfferTypes.ACQUISITION) {
    result = 'acquisition';
  } else if (offerTypeId === OfferTypes.WINBACK) {
    result = 'winback';
  } else if (offerTypeId === OfferTypes.RETENTION) {
    result = 'retention';
  }
  return result;
};

export const getValdnStatus = (targetEnv: Env, pass?: boolean): StatusEnum => {
  if (pass) {
    return targetEnv === Env.PROD
      ? StatusEnum.PROD_VALDN_PEND
      : StatusEnum.STG_VALDN_PEND;
  } else {
    return targetEnv === Env.PROD
      ? StatusEnum.PROD_VALDN_FAIL
      : StatusEnum.STG_VALDN_FAIL;
  }
};

export const getValidatedStatus = (targetEnv: Env): StatusEnum => {
  return targetEnv === Env.PROD
    ? StatusEnum.PROD_VALDN_PASS
    : StatusEnum.STG_VALDN_PASS;
};

export const isStatusAllowedForValidate = (status: StatusEnum): boolean => {
  const allowableStatus = [
    StatusEnum.STG,
    StatusEnum.STG_VALDN_FAIL,
    StatusEnum.PROD,
    StatusEnum.PROD_VALDN_FAIL,
  ];
  return allowableStatus.includes(status);
};

export const rollbackOfferForValidate = async (
  offer: OfferModel,
  env: Env,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    await Recurly.deactivateCoupon(
      offer,
      offer.offerCode,
      offer.Plan.Store,
      env,
      updatedBy,
    );
    if (env === Env.PROD) {
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Plan.Store,
        Env.STG,
        updatedBy,
      );
    }
    await Contentful.archiveSpecialOffer(offer);
    await CmsApi.clearCmsApiCache(env);
    await GhostLocker.rollbackToVersion(
      GLSet.PROMO_RECURLY,
      offer.offerCode,
      offer.glRollbackVersion,
      env,
    );
    await PlayAuth.clearOfferCache(offer.Plan.Store, env);
  } catch (rbErr) {
    logger.error(
      `${logPrefix(
        env,
      )} Rollback failed for Validate Offer on ${env.toUpperCase()}, ${
        rbErr.message
      }`,
      rbErr,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Validate Offer on ${env.toUpperCase()}: ${
        rbErr.message
      }`,
      rbErr.statusCode ? rbErr.statusCode : 500,
    );
  } finally {
    logger.debug(
      `${logPrefix(env)} Rollback task completed for (${offer.offerCode}).`,
    );
  }
};

export const rollbackRetentionOfferForValidate = async (
  offer: RetentionOfferModel,
  env: Env,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    await Recurly.deactivateCoupon(
      offer,
      offer.offerCode,
      offer.Store,
      env,
      updatedBy,
    );
    if (env === Env.PROD) {
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Store,
        Env.STG,
        updatedBy,
      );
    }
    await Contentful.archiveRetentionSpecialOffer(offer);
    await CmsApi.clearCmsApiCache(env);
    await GhostLocker.rollbackToVersion(
      GLSet.RET_RECURLY_V2,
      offer.offerCode,
      offer.glRollbackVersion,
      env,
    );
    await PlayAuth.clearOfferCache(offer.Store, env);
  } catch (rbErr) {
    logger.error(
      `${logPrefix(
        env,
      )} Rollback failed for Validate Offer on ${env.toUpperCase()}, ${
        rbErr.message
      }`,
      rbErr,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateRetentionOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Validate Offer on ${env.toUpperCase()}: ${
        rbErr.message
      }`,
      rbErr.statusCode ? rbErr.statusCode : 500,
    );
  } finally {
    logger.debug(
      `${logPrefix(env)} Rollback task completed for (${offer.offerCode}).`,
    );
  }
};

export const checkBambooIsBusy = async (): Promise<boolean> => {
  const count = await Offer.count({
    where: {
      statusId: {
        [Op.or]: [StatusEnum.STG_VALDN_PEND, StatusEnum.PROD_VALDN_PEND],
      },
    },
  });
  const retentionCount = await RetentionOffer.count({
    where: {
      statusId: {
        [Op.or]: [StatusEnum.STG_VALDN_PEND, StatusEnum.PROD_VALDN_PEND],
      },
    },
  });
  return count + retentionCount > 0;
};

export interface CheckCouponIsReadyResponse {
  offerCodeType: CodeType;
  ready: boolean;
}

export const checkCouponIsReady = async (
  offer: OfferModel,
  targetEnv: Env,
): Promise<CheckCouponIsReadyResponse> => {
  updateSpinnerText('Checking Recurly coupon readiness...');
  const result = await Recurly.getOfferRecurlyPayload(
    offer.offerCode,
    offer.Plan.Store,
    targetEnv,
  );
  if (result.offerCodeType === CodeType.SINGLE_CODE) {
    return {
      offerCodeType: result.offerCodeType,
      ready: true,
    } as CheckCouponIsReadyResponse;
  } else {
    return {
      offerCodeType: result.offerCodeType,
      ready: result.totalUniqueCodes > offer.totalUniqueCodes,
    } as CheckCouponIsReadyResponse;
  }
};

export interface BambooApiCfg {
  offersUrl: string;
  valdnEnv: Env;
  offerType: string;
  offerCode: string;
}
