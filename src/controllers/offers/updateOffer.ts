import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import {
  AppError,
  ContentfulError,
  CmsApiError,
  PlayAuthError,
} from '../../util/errorHandler';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../types/enum';
import {
  commitExtensionOfferToDb,
  commitOfferToDb,
  commitRetentionOfferToDb,
  getExtensionOfferModel,
  getOfferModel,
  getPlanModel,
  getRetentionOfferModel,
  getTargetEnv,
  processOfferError,
  removeExtraCodes,
  retrieveRecurlyPlan,
  updateExtensionOfferDbProperties,
  updateExtensionOfferStatus,
  updateOfferDbProperties,
  updateOfferStatus,
  updateRetentionOfferDbProperties,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import {
  ExtensionOfferContentfulPayload,
  ExtensionOfferDbPayload,
  ExtensionOfferRecurlyPayload,
  OfferContentfulPayload,
  OfferDbPayload,
  OfferRecurlyPayload,
  PlanRecurlyPayload,
  RetentionOfferContentfulPayload,
  RetentionOfferDbPayload,
  RetentionOfferRecurlyPayload,
} from '../../types/payload';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as CmsApi from '../../services/CmsApi';
import { OfferModel } from '../../models/Offer';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import * as PlayAuth from '../../services/PlayAuth';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { createOfferHistoryInDb } from './offerHistory';
import { setOfferModelDraftDataErrMessage } from '.';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Update Offer Controller:`;
  } else {
    return `Update Offer Controller:`;
  }
};

/**
 * PUT /api/offers/:offerId
 * Update an existing offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - updateOffer');
    const { offerId } = req.params;
    const offerTypeId = Number(req.query.offerTypeId);
    updateSpinnerText('Updating offer...');
    httpContext.set('offerCode', offerId);
    let foundOffer: OfferModel;
    let targetEnv: Env;
    let previousCoupon: OfferRecurlyPayload;
    let previousEntry: OfferContentfulPayload;
    let planRecurlyPayload: PlanRecurlyPayload;
    try {
      const plan = await getPlanModel((req.body as OfferDbPayload).planCode);
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          foundOffer = await getOfferModel(plan?.storeCode, offerId);
          const dbPayload = req.body as OfferDbPayload;
          // offerCode and planCode are not expected to be in the payload because they cannot be updated
          // so these 2 fields need to be re-inserted into the payload
          dbPayload.offerCode = foundOffer.offerCode;
          dbPayload.planCode = foundOffer.planCode;
          httpContext.set('planCode', foundOffer.planCode);
          targetEnv = getTargetEnv(foundOffer);
          httpContext.set('env', targetEnv);
          foundOffer.set('draftData', JSON.parse(JSON.stringify(dbPayload)));
          if (targetEnv === Env.DB) {
            foundOffer.set('offerTypeId', dbPayload.offerTypeId);
            await commitOfferToDb(foundOffer);
          } else if (targetEnv === Env.STG || targetEnv === Env.PROD) {
            // retrieve plan
            planRecurlyPayload = await retrieveRecurlyPlan(
              foundOffer.planCode,
              foundOffer.Plan.Store,
              targetEnv,
            );

            // 1. Recurly update
            updateSpinnerText('Updating Recurly coupon...');
            previousCoupon = await Recurly.getOfferRecurlyPayload(
              offerId,
              foundOffer.Plan.Store,
              targetEnv,
            );
            const offerRecurlyPayload = req.body as OfferRecurlyPayload;
            if (
              offerRecurlyPayload.offerCodeType === CodeType.BULK_UNIQUE_CODE
            ) {
              // We added extra codes for Bamboo validation, need to remove it here
              offerRecurlyPayload.totalUniqueCodes = removeExtraCodes(
                offerRecurlyPayload.totalUniqueCodes,
              );
            }
            await Recurly.updateCoupon(
              offerRecurlyPayload,
              offerId,
              foundOffer.Plan.Store,
              targetEnv,
            );

            // GL is not required for Update

            // 2. clear PlayAuth cache
            updateSpinnerText('Clearing PlayAuth cache...');
            await PlayAuth.clearOfferCache(foundOffer.Plan.Store, targetEnv);

            // GL Validation is not required for Update

            // 3. Contentful update
            updateSpinnerText('Updating Contentful entry...');
            previousEntry = await Contentful.fetchSpecialOffer(
              foundOffer.Plan.Store.regionCode,
              offerId,
              foundOffer.Plan.storeCode,
            );
            await Contentful.updateSpecialOffer(
              req.body as OfferContentfulPayload,
              offerId,
              foundOffer.Plan,
              targetEnv,
              planRecurlyPayload,
            );

            updateSpinnerText(
              'Clearing Contentful cache, this may take a while...',
            );
            await CmsApi.clearCmsApiCache(targetEnv);

            // 5. update other DB data
            foundOffer = updateOfferDbProperties(foundOffer, dbPayload);
            await foundOffer.save();

            // 6. save offer in offers history
            const updatedBy = req.body.updatedBy;
            const offerHistory = await createOfferHistoryInDb(
              foundOffer,
              null,
              updatedBy,
            );
          }
          retWithSuccess(req, res, {
            message: `Offer (${offerId}) updated successfully`,
            data: null,
          });
          break;
        case OfferTypes.RETENTION:
          return updateRetentionOffer(
            (req.body as RetentionOfferDbPayload).storeCode,
            offerId,
            req,
            res,
            next,
          );
        case OfferTypes.EXTENSION:
          return updateExtensionOffer(
            (req.body as ExtensionOfferDbPayload).storeCode,
            offerId,
            req,
            res,
            next,
          );
      }
    } catch (err) {
      logger.error(
        `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
        err,
      );
      updateSpinnerText('Update offer failed, performing rollback...');
      if (!DISABLE_ROLLBACK) {
        await rollbackOfferForUpdate(
          err,
          foundOffer,
          targetEnv,
          previousCoupon,
          previousEntry,
          planRecurlyPayload,
        );
      }
      return next(processOfferError(err));
    }
  },
);

export const updateRetentionOffer = async (
  storeCode: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let foundOffer: RetentionOfferModel;
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousEntry: OfferContentfulPayload;
  let planRecurlyPayload: PlanRecurlyPayload;
  try {
    foundOffer = await getRetentionOfferModel(storeCode, offerId);
    if (!foundOffer) {
      return next(new AppError(`Offer (${offerId}) not found`, 404));
    } else if (!isStatusAllowedForUpdate(foundOffer.statusId)) {
      return next(
        new AppError(
          `Invalid status for Offer (${foundOffer.offerCode}): ${foundOffer.Status.description} (${foundOffer.Status.title})`,
          400,
        ),
      );
    }
    const dbPayload = req.body as RetentionOfferDbPayload;
    // offerCode and planCode are not expected to be in the payload because they cannot be updated
    // so these 2 fields need to be re-inserted into the payload
    dbPayload.offerCode = foundOffer.offerCode;
    targetEnv = getTargetEnv(foundOffer);
    httpContext.set('env', targetEnv);
    foundOffer.set('draftData', JSON.parse(JSON.stringify(dbPayload)));
    if (targetEnv === Env.DB) {
      foundOffer.set('eligiblePlans', dbPayload.eligiblePlans.join(','));
      await commitRetentionOfferToDb(foundOffer);
    } else if (targetEnv === Env.STG || targetEnv === Env.PROD) {
      // retrieve plan
      planRecurlyPayload = await retrieveRecurlyPlan(
        foundOffer.eligiblePlans.split(',')[0],
        foundOffer.Store,
        targetEnv,
      );

      // 1. Recurly update
      updateSpinnerText('Updating Recurly coupon...');
      previousCoupon = await Recurly.getOfferRecurlyPayload(
        offerId,
        foundOffer.Store,
        targetEnv,
      );
      if (dbPayload.upgradePlan) {
        previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
          offerId + '_upgrade',
          foundOffer.Store,
          targetEnv,
        );
      }
      const offerRecurlyPayload = req.body as RetentionOfferRecurlyPayload;
      await Recurly.updateRetentionCoupon(
        offerRecurlyPayload,
        offerId,
        false,
        foundOffer.Store,
        targetEnv,
      );
      if (dbPayload.upgradePlan) {
        await Recurly.updateRetentionCoupon(
          offerRecurlyPayload,
          offerId,
          true,
          foundOffer.Store,
          targetEnv,
        );
      }

      // GL is not required for Update

      // 2. clear PlayAuth cache
      updateSpinnerText('Clearing PlayAuth cache...');
      await PlayAuth.clearOfferCache(foundOffer.Store, targetEnv);

      // GL Validation is not required for Update

      // 3. Contentful update
      updateSpinnerText('Updating Contentful entry...');
      previousEntry = await Contentful.fetchSpecialOffer(
        foundOffer.Store.regionCode,
        offerId,
        foundOffer.storeCode,
        true,
      );
      await Contentful.updateRetentionSpecialOffer(
        req.body as RetentionOfferContentfulPayload,
        dbPayload.storeCode,
        offerId,
        targetEnv,
        foundOffer.Store.regionCode,
      );

      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(targetEnv);

      // 5. update other DB data
      foundOffer = updateRetentionOfferDbProperties(foundOffer, dbPayload);
      await foundOffer.save();

      // save offer in offers history
      const updatedBy = req.body.updatedBy;
      const offerHistory = await createOfferHistoryInDb(
        foundOffer,
        null,
        updatedBy,
      );
    }
    retWithSuccess(req, res, {
      message: `Offer (${offerId}) updated successfully`,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText('Update offer failed, performing rollback...');
    if (!DISABLE_ROLLBACK) {
      await rollbackRetentionOfferForUpdate(
        err,
        foundOffer,
        targetEnv,
        previousCoupon,
        previousUpgradeCoupon,
        previousEntry,
      );
    }
    return next(processOfferError(err));
  }
};

export const updateExtensionOffer = async (
  storeCode: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let foundOffer: ExtensionOfferModel;
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousEntry: OfferContentfulPayload;
  let planRecurlyPayload: PlanRecurlyPayload;
  try {
    foundOffer = await getExtensionOfferModel(storeCode, offerId);
    if (!foundOffer) {
      return next(new AppError(`Offer (${offerId}) not found`, 404));
    } else if (!isStatusAllowedForUpdate(foundOffer.statusId)) {
      return next(
        new AppError(
          `Invalid status for Offer (${foundOffer.offerCode}): ${foundOffer.Status.description} (${foundOffer.Status.title})`,
          400,
        ),
      );
    }
    const dbPayload = req.body as ExtensionOfferDbPayload;
    // offerCode and planCode are not expected to be in the payload because they cannot be updated
    // so these 2 fields need to be re-inserted into the payload
    dbPayload.offerCode = foundOffer.offerCode;
    targetEnv = getTargetEnv(foundOffer);
    httpContext.set('env', targetEnv);
    foundOffer.set('draftData', JSON.parse(JSON.stringify(dbPayload)));
    if (targetEnv === Env.DB) {
      foundOffer.set('eligibleCharges', dbPayload.eligibleCharges.join(','));
      updateExtensionOfferDbProperties(foundOffer, dbPayload);
      await commitExtensionOfferToDb(foundOffer);
    } else if (targetEnv === Env.STG || targetEnv === Env.PROD) {
      // retrieve plan
      planRecurlyPayload = await retrieveRecurlyPlan(
        foundOffer.eligibleCharges.split(',')[0],
        foundOffer.Store,
        targetEnv,
      );

      // 1. Recurly update
      updateSpinnerText('Updating Recurly coupon...');
      previousCoupon = await Recurly.getOfferRecurlyPayload(
        offerId,
        foundOffer.Store,
        targetEnv,
      );
      if (dbPayload.upgradeOfferCode) {
        previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
          offerId + '_upgrade',
          foundOffer.Store,
          targetEnv,
        );
      }
      const offerRecurlyPayload = req.body as ExtensionOfferRecurlyPayload;
      await Recurly.updateExtensionCoupon(
        offerRecurlyPayload,
        offerId,
        false,
        foundOffer.Store,
        targetEnv,
      );
      if (dbPayload.upgradeOfferCode) {
        await Recurly.updateExtensionCoupon(
          offerRecurlyPayload,
          offerId,
          true,
          foundOffer.Store,
          targetEnv,
        );
      }

      // GL is not required for Update

      // 2. clear PlayAuth cache
      updateSpinnerText('Clearing PlayAuth cache...');
      await PlayAuth.clearOfferCache(foundOffer.Store, targetEnv);

      // GL Validation is not required for Update

      // 3. Contentful update
      updateSpinnerText('Updating Contentful entry...');
      previousEntry = await Contentful.fetchSpecialOffer(
        foundOffer.Store.regionCode,
        offerId,
        foundOffer.storeCode,
        true,
      );
      await Contentful.updateExtensionSpecialOffer(
        req.body as ExtensionOfferContentfulPayload,
        dbPayload.storeCode,
        offerId,
        targetEnv,
        foundOffer.Store.regionCode,
      );

      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(targetEnv);

      // 5. update other DB data
      foundOffer = updateExtensionOfferDbProperties(foundOffer, dbPayload);
      await foundOffer.save();

      // save offer in offers history
      const updatedBy = req.body.updatedBy;
      const offerHistory = await createOfferHistoryInDb(
        foundOffer,
        null,
        updatedBy,
      );
    }
    retWithSuccess(req, res, {
      message: `Offer (${offerId}) updated successfully`,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText('Update offer failed, performing rollback...');
    if (!DISABLE_ROLLBACK) {
      await rollbackExtensionOfferForUpdate(
        err,
        foundOffer,
        targetEnv,
        previousCoupon,
        previousUpgradeCoupon,
        previousEntry,
      );
    }
    return next(processOfferError(err));
  }
};

export const isStatusAllowedForUpdate = (status: StatusEnum): boolean => {
  const allowableStatus = [
    StatusEnum.DFT,
    StatusEnum.STG_ERR_UPD,
    StatusEnum.STG,
    StatusEnum.STG_VALDN_FAIL,
    StatusEnum.STG_VALDN_PASS,
    StatusEnum.PROD_ERR_UPD,
    StatusEnum.PROD,
    StatusEnum.PROD_VALDN_FAIL,
    StatusEnum.PROD_VALDN_PASS,
  ];
  return allowableStatus.includes(status);
};

export const rollbackOfferForUpdate = async (
  err: AppError,
  offer: OfferModel,
  env: Env,
  previousCoupon: OfferRecurlyPayload,
  previousEntry: OfferContentfulPayload,
  planRecurlyPayload: PlanRecurlyPayload,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (
      err instanceof PlayAuthError ||
      err instanceof ContentfulError ||
      err instanceof CmsApiError
    ) {
      if (err instanceof CmsApiError) {
        await Contentful.updateSpecialOffer(
          patchContentfulPayload(offer, previousCoupon, previousEntry),
          offer.offerCode,
          offer.Plan,
          env,
          planRecurlyPayload,
        );
      }
      await Recurly.updateCoupon(
        previousCoupon,
        offer.offerCode,
        offer.Plan.Store,
        env,
      );
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(env)} Rollback failed for Update Offer, ${rbErr.message}`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Update Offer on ${env.toUpperCase()}: ${
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

export const rollbackRetentionOfferForUpdate = async (
  err: AppError,
  offer: RetentionOfferModel,
  env: Env,
  previousCoupon: OfferRecurlyPayload,
  previousUpgradeCoupon: OfferRecurlyPayload,
  previousEntry: OfferContentfulPayload,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (
      err instanceof PlayAuthError ||
      err instanceof ContentfulError ||
      err instanceof CmsApiError
    ) {
      if (err instanceof CmsApiError) {
        await Contentful.updateRetentionSpecialOffer(
          (previousEntry as any) as RetentionOfferContentfulPayload,
          offer.offerCode,
          offer.storeCode,
          env,
          offer.Store.regionCode,
        );
      }
      await Recurly.updateRetentionCoupon(
        (previousCoupon as any) as RetentionOfferRecurlyPayload,
        offer.offerCode,
        false,
        offer.Store,
        env,
      );
      if (previousUpgradeCoupon) {
        await Recurly.updateRetentionCoupon(
          (previousUpgradeCoupon as any) as RetentionOfferRecurlyPayload,
          offer.offerCode,
          true,
          offer.Store,
          env,
        );
      }
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(env)} Rollback failed for Update Offer, ${rbErr.message}`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateRetentionOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Update Offer on ${env.toUpperCase()}: ${
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

export const rollbackExtensionOfferForUpdate = async (
  err: AppError,
  offer: ExtensionOfferModel,
  env: Env,
  previousCoupon: OfferRecurlyPayload,
  previousUpgradeCoupon: OfferRecurlyPayload,
  previousEntry: OfferContentfulPayload,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (
      err instanceof PlayAuthError ||
      err instanceof ContentfulError ||
      err instanceof CmsApiError
    ) {
      if (err instanceof CmsApiError) {
        await Contentful.updateExtensionSpecialOffer(
          (previousEntry as any) as ExtensionOfferContentfulPayload,
          offer.offerCode,
          offer.storeCode,
          env,
          offer.Store.regionCode,
        );
      }
      await Recurly.updateExtensionCoupon(
        (previousCoupon as any) as ExtensionOfferRecurlyPayload,
        offer.offerCode,
        false,
        offer.Store,
        env,
      );
      if (previousUpgradeCoupon) {
        await Recurly.updateExtensionCoupon(
          (previousUpgradeCoupon as any) as ExtensionOfferRecurlyPayload,
          offer.offerCode,
          true,
          offer.Store,
          env,
        );
      }
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(env)} Rollback failed for Update Offer, ${rbErr.message}`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateExtensionOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Update Offer on ${env.toUpperCase()}: ${
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

// there is data that Contentful depends on but is stored in DB or Recurly
const patchContentfulPayload = (
  offer: OfferModel,
  recurly: OfferRecurlyPayload,
  contentful: OfferContentfulPayload,
): OfferContentfulPayload => {
  return {
    ...contentful,
    offerTypeId: offer.offerTypeId,
    planCode: offer.planCode,
    discountType: recurly.discountType,
  };
};
