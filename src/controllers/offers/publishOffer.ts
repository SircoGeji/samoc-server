import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { OfferModel } from '../../models/Offer';
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
import { CodeType, Env, OfferTypes, StatusEnum } from '../../types/enum';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as PlayAuth from '../../services/PlayAuth';
import * as GhostLocker from '../../services/GhostLocker';
import { GLSet } from '../../services/GhostLocker';
import * as CmsApi from '../../services/CmsApi';
import {
  getExtensionOfferModel,
  getOfferModel,
  getRetentionOfferModel,
  getFlexSiteUrl,
  getStoreModel,
  processOfferError,
  retrieveRecurlyPlan,
  updateExtensionOfferStatus,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { PlanRecurlyPayload } from '../../types/payload';
import { createOfferHistoryInDb } from './offerHistory';
import { setOfferModelDraftDataErrMessage } from '.';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Publish Offer Controller:`;
  } else {
    return `Publish Offer Controller:`;
  }
};

/**
 * GET /api/offers/:offerId/publish
 * Publish an existing offer to :env by OfferCode
 *
 * Publish to STG
 *   Pre-requisite:  Status must be in DRAFT
 *
 * Publish to PROD
 *   Pre-requisite:  Status must be one of STG (phase 0), or STG_VALDN_PASS, APV_APRVD, PROD_PEND (phase 1)
 *
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - publishOffer');
    const { offerId } = req.params;
    const { store, updatedBy } = req.query;
    const offerTypeId = Number(req.query.offerTypeId);
    const storeCode = store ? (store as string) : null;
    updateSpinnerText('Publishing offer...');
    httpContext.set('offerCode', offerId);
    let foundOffer: OfferModel;
    try {
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          const glHealth: any = await GhostLocker.getGLHealth(Env.PROD);
          if (glHealth.status !== 200) {
            return next(
              new AppError(
                `GhostLocker couldn't be accessed on PROD: ${glHealth.message}`,
                400,
              ),
            );
          }
          foundOffer = await getOfferModel(storeCode, offerId);
          if (!isPublishStatusAllowed(foundOffer.statusId)) {
            return next(
              new AppError(
                `Invalid status for Offer (${foundOffer.offerCode}): ${foundOffer.Status.description} (${foundOffer.Status.title})`,
                400,
              ),
            );
          }
          httpContext.set('planCode', foundOffer.planCode);
          httpContext.set('env', Env.PROD);
          // get Recurly plan info
          const recurlyPlan = await retrieveRecurlyPlan(
            foundOffer.planCode,
            foundOffer.Plan.Store,
            Env.PROD,
          );

          // 1. get Coupon from STG and publish to Recurly
          // 1a) get Coupon from STG
          const recurlyPayload = await Recurly.getOfferRecurlyPayload(
            foundOffer.offerCode,
            foundOffer.Plan.Store,
            Env.STG,
          );

          // 1b) create one on recurly PROD
          updateSpinnerText('Creating Recurly coupon...');
          const couponId = await Recurly.createCoupon(
            recurlyPayload,
            recurlyPlan,
            foundOffer.Plan.Store,
            Env.PROD,
          );
          foundOffer.set('couponId', couponId);

          // 2. publish to GhostLocker
          updateSpinnerText('Updating GhostLocker config...');
          const response = await GhostLocker.updateOfferConfig(
            foundOffer.offerCode,
            foundOffer.offerTypeId,
            foundOffer.planCode,
            foundOffer.Plan.Store.regionCode,
            false,
            Env.PROD,
          );
          // save the rollback config version to model
          foundOffer.glRollbackVersion = response.configurationVersion - 1;

          // 3. publish to PlayAuth
          updateSpinnerText('Clearing PlayAuth cache...');
          await PlayAuth.clearOfferCache(foundOffer.Plan.Store, Env.PROD);

          // 4. Validate GhostLocker (via PlayAuth)
          let uniqueOfferCode: string;
          if (
            recurlyPayload &&
            recurlyPayload.offerCodeType === CodeType.BULK_UNIQUE_CODE
          ) {
            uniqueOfferCode = await Recurly.fetchBulkCode(foundOffer, Env.PROD);
          }
          updateSpinnerText('Validating GhostLocker...');
          await PlayAuth.validateGl(
            foundOffer.Plan.Store.regionCode,
            getFlexSiteUrl(Env.PROD, foundOffer.Plan.Store.regionCode),
            Env.PROD,
            foundOffer.offerCode,
            uniqueOfferCode,
          );

          // 5. update Offer in Contentful to Prod
          updateSpinnerText('Processing Contentful entry...');
          await Contentful.setEnvForSpecialOffer(
            foundOffer.Plan.Store.regionCode,
            foundOffer.offerCode,
            foundOffer.Plan.storeCode,
            Env.PROD,
          );

          // 6. Remove Cache
          updateSpinnerText(
            'Clearing Contentful cache, this may take a while...',
          );
          await CmsApi.clearCmsApiCache(Env.PROD);

          // 7. update offer status in DB
          const newOffer = await updateOfferStatus(foundOffer, StatusEnum.PROD);

          // 8. save offer in offers history
          const offerHistory = await createOfferHistoryInDb(
            newOffer,
            null,
            updatedBy as string,
          );
          updateSpinnerText('Offer published successfully');

          retWithSuccess(req, res, {
            message: `Offer (${offerId}) published successfully`,
            data: null,
          });
        case OfferTypes.RETENTION:
          return publishRetentionOffer(
            storeCode,
            updatedBy as string,
            offerId,
            req,
            res,
            next,
          );
        case OfferTypes.EXTENSION:
          return publishExtensionOffer(
            storeCode,
            updatedBy as string,
            offerId,
            req,
            res,
            next,
          );
      }
    } catch (err) {
      logger.error(
        `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
        err,
      );
      updateSpinnerText('Publish offer failed, performing rollback...');
      if (!DISABLE_ROLLBACK) {
        await rollbacOfferPublish(err, foundOffer, updatedBy as string);
      }
      let rollbackToStatus;
      if (err instanceof PreUpdateRemoteError || err instanceof RecurlyError) {
        rollbackToStatus = StatusEnum.STG_VALDN_PASS;
      } else {
        // once Recurly is changed, the offer code can't be retried
        rollbackToStatus = StatusEnum.PROD_FAIL;
      }
      setOfferModelDraftDataErrMessage(foundOffer, err.message);
      await updateOfferStatus(foundOffer, rollbackToStatus);
      return next(processOfferError(err));
    }
  },
);

const publishRetentionOffer = async (
  storeCode: string,
  updatedBy: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let foundOffer: RetentionOfferModel;
  try {
    foundOffer = await getRetentionOfferModel(storeCode, offerId);
    if (!foundOffer) {
      return next(new AppError(`Offer (${offerId}) not found.`, 404));
    } else if (!isPublishStatusAllowed(foundOffer.statusId)) {
      return next(
        new AppError(
          `Invalid status for Offer (${foundOffer.offerCode}): ${foundOffer.Status.description} (${foundOffer.Status.title})`,
          400,
        ),
      );
    }
    httpContext.set('env', Env.PROD);
    // get Recurly plan info
    const eligiblePlans: PlanRecurlyPayload[] = [];
    for (const planCode of foundOffer.eligiblePlans.split(',')) {
      const plan = await retrieveRecurlyPlan(
        planCode,
        foundOffer.Store,
        Env.STG,
      );
      eligiblePlans.push(plan);
    }

    // 1. get Coupon from STG and publish to Recurly
    // 1a) get Coupon from STG
    const recurlyPayload = await Recurly.getRetentionOfferRecurlyPayload(
      foundOffer.offerCode,
      foundOffer.Store,
      Env.STG,
    );

    // 1b) create one on recurly PROD
    updateSpinnerText('Creating Recurly coupon...');
    const couponId = await Recurly.createRetentionCoupon(
      recurlyPayload,
      eligiblePlans,
      false,
      foundOffer.Store,
      Env.PROD,
    );
    foundOffer.set('couponId', couponId);

    // 1. create upgrade coupon on Recurly
    if (foundOffer.upgradeOfferCode) {
      updateSpinnerText('Creating Recurly upgrade coupon...');
      const upgradeCouponId = await Recurly.createRetentionCoupon(
        recurlyPayload,
        eligiblePlans,
        true,
        foundOffer.Store,
        Env.PROD,
      );
      foundOffer.set('upgradeCouponId', upgradeCouponId);
    }

    // 2. publish to GhostLocker
    updateSpinnerText('Updating GhostLocker config...');
    const response = await GhostLocker.updateRetentionOfferConfig(
      [],
      foundOffer.offerCode,
      foundOffer.switchToPlan,
      false,
      foundOffer.usersOnPlans ? foundOffer.usersOnPlans.split(',') : null,
      foundOffer.Store.regionCode,
      false,
      Env.PROD,
    );
    // save the rollback config version to model
    foundOffer.glRollbackVersion = response.configurationVersion - 1;

    // 3. publish to PlayAuth
    updateSpinnerText('Clearing PlayAuth cache...');
    await PlayAuth.clearOfferCache(foundOffer.Store, Env.PROD, GLSet.RET_RECURLY_V2);

    // 4. Validate GhostLocker (via PlayAuth)
    updateSpinnerText('Validating GhostLocker...');
    await PlayAuth.validateGl(
      foundOffer.Store.regionCode,
      getFlexSiteUrl(Env.PROD, foundOffer.Store.regionCode),
      Env.PROD,
      foundOffer.offerCode,
      undefined,
      OfferTypes.RETENTION,
    );

    // 5. update Offer in Contentful to Prod
    updateSpinnerText('Processing Contentful entry...');
    await Contentful.setEnvForSpecialOffer(
      foundOffer.Store.regionCode,
      foundOffer.offerCode,
      foundOffer.storeCode,
      Env.PROD,
      false,
    );

    // 6. Remove Cache
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.PROD);

    // 7. update offer status in DB
    const newOffer = await updateRetentionOfferStatus(
      foundOffer,
      StatusEnum.PROD,
    );

    // 8. save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      null,
      updatedBy,
    );
    updateSpinnerText('Offer published successfully');

    retWithSuccess(req, res, {
      message: `Offer (${offerId}) published successfully`,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText('Publish offer failed, performing rollback...');
    if (!DISABLE_ROLLBACK) {
      await rollbackRetentionOfferPublish(err, foundOffer, updatedBy);
    }
    let rollbackToStatus;
    if (err instanceof PreUpdateRemoteError || err instanceof RecurlyError) {
      rollbackToStatus = StatusEnum.STG_VALDN_PASS;
    } else {
      // once Recurly is changed, the offer code can't be retried
      rollbackToStatus = StatusEnum.PROD_FAIL;
    }
    setOfferModelDraftDataErrMessage(foundOffer, err.message);
    await updateRetentionOfferStatus(foundOffer, rollbackToStatus);
    return next(processOfferError(err));
  }
};

const publishExtensionOffer = async (
  storeCode: string,
  updatedBy: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let foundOffer: ExtensionOfferModel;
  try {
    const storeModel = await getStoreModel(storeCode);
    foundOffer = await getExtensionOfferModel(storeCode, offerId);
    if (!foundOffer) {
      return next(new AppError(`Offer (${offerId}) not found.`, 404));
    } else if (foundOffer.statusId !== StatusEnum.STG) {
      return next(
        new AppError(
          `Invalid status for Offer (${foundOffer.offerCode}): ${foundOffer.Status.description} (${foundOffer.Status.title})`,
          400,
        ),
      );
    }
    httpContext.set('env', Env.PROD);
    // get Recurly plan info
    const eligibleCharges: PlanRecurlyPayload[] = [];
    for (const planCode of foundOffer.eligibleCharges.split(',')) {
      const plan = await retrieveRecurlyPlan(
        planCode,
        foundOffer.Store,
        Env.STG,
      );
      eligibleCharges.push(plan);
    }

    // 1. get Coupon from STG and publish to Recurly
    // 1a) get Coupon from STG
    const recurlyPayload = await Recurly.getExtensionOfferRecurlyPayload(
      foundOffer.offerCode,
      foundOffer.Store,
      Env.STG,
    );

    // 1b) create one on recurly PROD
    updateSpinnerText('Creating Recurly coupon...');
    const couponId = await Recurly.createExtensionCoupon(
      recurlyPayload,
      eligibleCharges,
      false,
      foundOffer.Store,
      Env.PROD,
    );
    foundOffer.set('couponId', couponId);

    // 1. create upgrade coupon on Recurly
    if (foundOffer.upgradeOfferCode) {
      updateSpinnerText('Creating Recurly upgrade coupon...');
      const upgradePlan: PlanRecurlyPayload[] = [];

      const plan = await retrieveRecurlyPlan(
        foundOffer.switchToPlan,
        storeModel,
        Env.STG,
      );
      upgradePlan.push(plan);

      const upgradeCouponId = await Recurly.createExtensionCoupon(
        recurlyPayload,
        upgradePlan,
        true,
        foundOffer.Store,
        Env.PROD,
        foundOffer.switchToPlan,
      );
      foundOffer.set('upgradeCouponId', upgradeCouponId);
    }

    // 5. update Offer in Contentful to Prod
    updateSpinnerText('Processing Contentful entry...');
    await Contentful.setEnvForSpecialOffer(
      foundOffer.Store.regionCode,
      foundOffer.offerCode,
      foundOffer.storeCode,
      Env.PROD,
      false,
    );

    // 6. Remove Cache
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.PROD);

    // 7. update offer status in DB
    const newOffer = await updateExtensionOfferStatus(
      foundOffer,
      StatusEnum.PROD,
    );

    // 8. save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      null,
      updatedBy,
    );
    updateSpinnerText('Offer published successfully');

    retWithSuccess(req, res, {
      message: `Offer (${offerId}) published successfully`,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText('Publish offer failed, performing rollback...');
    let rollbackToStatus;
    if (err instanceof PreUpdateRemoteError || err instanceof RecurlyError) {
      rollbackToStatus = StatusEnum.STG_VALDN_PASS;
    } else {
      // once Recurly is changed, the offer code can't be retried
      rollbackToStatus = StatusEnum.PROD_FAIL;
    }
    setOfferModelDraftDataErrMessage(foundOffer, err.message);
    await updateExtensionOfferStatus(foundOffer, rollbackToStatus);
    return next(processOfferError(err));
  }
};

export const isPublishStatusAllowed = (status: StatusEnum): boolean => {
  const allowableStatus = [StatusEnum.STG_VALDN_PASS, StatusEnum.PROD_ERR_PUB];
  return allowableStatus.includes(status);
};

export const rollbacOfferPublish = async (
  err: AppError,
  offer: OfferModel,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(Env.PROD)} Rollback triggered for ${offer.offerCode} due to '${
      err.name || 'Undefined error'
    }'' with statusCode: '${err.statusCode || 500}'`,
    err,
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
        await Contentful.setEnvForSpecialOffer(
          offer.Plan.Store.regionCode,
          offer.offerCode,
          offer.Plan.storeCode,
          Env.STG,
        );
      }
      if (!(err instanceof GhostLockerError)) {
        // rollback GL and expire recurly coupon
        await GhostLocker.rollbackToVersion(
          GLSet.PROMO_RECURLY,
          offer.offerCode,
          offer.glRollbackVersion,
          Env.PROD,
        );
      }
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Plan.Store,
        Env.PROD,
        updatedBy,
      );

      // deactivate and archive STG offers -- to accommodate new CmsAPI of 1000 active offers allowed
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Plan.Store,
        Env.STG,
        updatedBy,
      );
      await Contentful.archiveSpecialOffer(offer);
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(Env.PROD)} Rollback failed for publishOffer, ${
        rbErr.message
      }`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status
    await updateOfferStatus(offer, StatusEnum.PROD_RB_FAIL);
    throw new AppError(
      `Rollback failed for Publish Offer on ${Env.PROD.toUpperCase()}: ${
        rbErr.message
      }`,
      rbErr.statusCode ? rbErr.statusCode : 500,
    );
  } finally {
    logger.debug(
      `${logPrefix(Env.PROD)} Rollback task completed for (${
        offer.offerCode
      }).`,
    );
  }
};

export const rollbackRetentionOfferPublish = async (
  err: AppError,
  offer: RetentionOfferModel,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(Env.PROD)} Rollback triggered for ${offer.offerCode} due to '${
      err.name || 'Undefined error'
    }'' with statusCode: '${err.statusCode || 500}'`,
    err,
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
        await Contentful.setEnvForSpecialOffer(
          offer.Store.regionCode,
          offer.offerCode,
          offer.storeCode,
          Env.STG,
          false,
        );
      }
      if (!(err instanceof GhostLockerError)) {
        // rollback GL and expire recurly coupon
        await GhostLocker.rollbackToVersion(
          GLSet.RET_RECURLY_V2,
          offer.offerCode,
          offer.glRollbackVersion,
          Env.PROD,
        );
      }
      await Recurly.deactivateCoupon(offer, offer.offerCode, offer.Store, Env.PROD, updatedBy);

      // deactivate and archive STG offers -- to accommodate new CmsAPI of 1000 active offers allowed
      await Recurly.deactivateCoupon(offer, offer.offerCode, offer.Store, Env.STG, updatedBy);
      await Contentful.archiveRetentionSpecialOffer(offer);
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(Env.PROD)} Rollback failed for publishOffer, ${
        rbErr.message
      }`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status
    await updateRetentionOfferStatus(offer, StatusEnum.PROD_RB_FAIL);
    throw new AppError(
      `Rollback failed for Publish Offer on ${Env.PROD.toUpperCase()}: ${
        rbErr.message
      }`,
      rbErr.statusCode ? rbErr.statusCode : 500,
    );
  } finally {
    logger.debug(
      `${logPrefix(Env.PROD)} Rollback task completed for (${
        offer.offerCode
      }).`,
    );
  }
};
