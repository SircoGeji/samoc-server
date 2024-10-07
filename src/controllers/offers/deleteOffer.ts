import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import * as Contentful from '../../services/Contentful';
import * as Recurly from '../../services/Recurly';
import * as CmsApi from '../../services/CmsApi';
import { Env, OfferTypes, RemoteSystem, StatusEnum } from '../../types/enum';
import { OfferRecurlyPayload } from '../../types/payload';
import * as PlayAuth from '../../services/PlayAuth';
import { OfferModel } from '../../models/Offer';
import { retWithSuccess } from '../../models/SamocResponse';
import {
  AppError,
  ContentfulError,
  CmsApiError,
  PlayAuthError,
} from '../../util/errorHandler';
import Logger from '../../util/logger';
import {
  getExtensionOfferModel,
  getOfferModel,
  getRetentionOfferModel,
  getTargetEnv,
  processOfferError,
  updateExtensionOfferStatus,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import { io } from '../../server';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { createOfferHistoryInDb } from './offerHistory';
import { setOfferModelDraftDataErrMessage } from '.';
import * as GhostLocker from '../../services/GhostLocker';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Retire Offer Controller:`;
  } else {
    return `Retire Offer Controller:`;
  }
};

/**
 * DELETE /api/offers/:offerId
 * Delete an offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - deleteOffer');
    const { offerId } = req.params;
    const { store, updatedBy } = req.query;
    const storeCode = store ? (store as string) : null;
    const offerTypeId = Number(req.query.offerTypeId);
    httpContext.set('offerCode', offerId);
    let offer: OfferModel;
    let targetEnv: Env;
    let previousCoupon: OfferRecurlyPayload;
    let previousStatus: StatusEnum;
    let message: string;
    try {
      // TODO: add store code
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          offer = await getOfferModel(storeCode, offerId);
          httpContext.set('planCode', offer.planCode);
          targetEnv = getTargetEnv(offer);
          updateSpinnerText(
            `${
              targetEnv === Env.STG || targetEnv === Env.PROD
                ? 'Retiring'
                : 'Deleting'
            } offer...`,
          );
          httpContext.set('env', targetEnv);
          previousStatus = offer.statusId;
          if (targetEnv === Env.STG || targetEnv === Env.PROD) {
            // 1. deactivate coupon in Recurly
            // save current coupon data (needed for restore)
            updateSpinnerText('Retiring Recurly coupon...');
            previousCoupon = await Recurly.getOfferRecurlyPayload(
              offerId,
              offer.Plan.Store,
              targetEnv,
            );
            // disable coupon in both stage and prod
            if (targetEnv === Env.PROD) {
              await Recurly.deactivateCoupon(
                offer,
                offerId,
                offer.Plan.Store,
                Env.PROD,
                updatedBy as string,
              );
            }
            await Recurly.deactivateCoupon(
              offer,
              offerId,
              offer.Plan.Store,
              Env.STG,
              updatedBy as string,
            );

            // Per doc:  https://confluence.flex.com/pages/viewpage.action?pageId=179571852
            // Suggested not to remove entries from GL config, commenting it out for now.
            // - - - - - - - - - -
            // Per ticket: https://flexent.atlassian.net/browse/SAMOC-1689
            // Suggested to return offer entries removal from GL config

            // 2. delete from GhostLocker
            updateSpinnerText('Removing GhostLocker config offer entry...');
            if (targetEnv === Env.PROD) {
              await GhostLocker.updateOfferConfig(
                offer.offerCode,
                offer.offerTypeId,
                offer.planCode,
                offer.Plan.Store.regionCode,
                true,
                Env.PROD,
              );
            }
            await GhostLocker.updateOfferConfig(
              offer.offerCode,
              offer.offerTypeId,
              offer.planCode,
              offer.Plan.Store.regionCode,
              true,
              Env.STG,
            );

            // 3. clear PlayAuth cache
            updateSpinnerText('Clearing PlayAuth cache...');
            await PlayAuth.clearOfferCache(offer.Plan.Store, targetEnv);

            // GL Validation is not required for Delete

            // 4. delete specialOffer entry in Contentful
            // updateSpinnerText('Archiving Contentful entry...');
            // await Contentful.archiveSpecialOffer(offer);

            // 5. Remove Cache
            updateSpinnerText(
              'Clearing Contentful cache, this may take a while...',
            );
            await CmsApi.clearCmsApiCache(targetEnv);

            // retire stg/prod offer by updating status
            const newOffer = await updateOfferStatus(
              offer,
              targetEnv === Env.PROD
                ? StatusEnum.PROD_RETD
                : StatusEnum.STG_RETD,
            );
            // 6. save offer in offers history
            const offerHistory = await createOfferHistoryInDb(
              newOffer,
              null,
              updatedBy as string,
            );
            message = `Offer (${offerId}) retired successfully on ${targetEnv.toUpperCase()}`;
          } else if (targetEnv === Env.DB) {
            // delete draft from DB
            await offer.destroy({ force: true });
            message = `Offer (${offerId}) deleted successfully from ${targetEnv.toUpperCase()}`;
          }

          io.emit('offer-deleted', offer.toJSON());

          retWithSuccess(req, res, {
            message: message,
            data: null,
          });
        case OfferTypes.RETENTION:
          return deleteRetentionOffer(
            storeCode,
            updatedBy as string,
            offerId,
            req,
            res,
            next,
          );
        case OfferTypes.EXTENSION:
          return deleteExtensionOffer(
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
        `${logPrefix(targetEnv)} Failed to delete offer, ${err.message}`,
        err,
      );
      updateSpinnerText('Retire offer failed, performing rollback...');
      if (!DISABLE_ROLLBACK) {
        await rollbackDeletedOffer(err, offer, targetEnv, previousCoupon);
      }
      await updateOfferStatus(offer, previousStatus);
      return next(processOfferError(err));
    }
  },
);

const deleteRetentionOffer = async (
  storeCode: string,
  updatedBy: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let offer: RetentionOfferModel;
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousStatus: StatusEnum;
  let message: string;
  try {
    offer = await getRetentionOfferModel(storeCode, offerId);
    if (!offer) {
      throw new AppError(`Offer (${offerId}) not found in the database`, 404);
    }
    targetEnv = getTargetEnv(offer);
    updateSpinnerText(
      `${
        targetEnv === Env.STG || targetEnv === Env.PROD
          ? 'Retiring'
          : 'Deleting'
      } offer...`,
    );
    httpContext.set('env', targetEnv);
    previousStatus = offer.statusId;
    if (targetEnv === Env.STG || targetEnv === Env.PROD) {
      // 1. deactivate coupon in Recurly
      // save current coupon data (needed for restore)
      updateSpinnerText('Retiring Recurly coupon...');
      previousCoupon = await Recurly.getOfferRecurlyPayload(
        offerId,
        offer.Store,
        targetEnv,
      );
      if (offer.upgradeCouponId) {
        previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
          offerId + '_upgrade',
          offer.Store,
          targetEnv,
        );
      }
      // disable coupon in both stage and prod
      if (targetEnv === Env.PROD) {
        await Recurly.deactivateCoupon(
          offer,
          offerId,
          offer.Store,
          Env.PROD,
          updatedBy,
        );
        if (offer.upgradeCouponId) {
          await Recurly.deactivateCoupon(
            offer,
            offerId + '_upgrade',
            offer.Store,
            Env.PROD,
            updatedBy,
          );
        }
      }
      await Recurly.deactivateCoupon(
        offer,
        offerId,
        offer.Store,
        Env.STG,
        updatedBy,
      );
      if (offer.upgradeCouponId) {
        await Recurly.deactivateCoupon(
          offer,
          offerId + '_upgrade',
          offer.Store,
          Env.STG,
          updatedBy,
        );
      }

      // Per doc:  https://confluence.flex.com/pages/viewpage.action?pageId=179571852
      // Suggested not to remove entries from GL config, commenting it out for now.
      // - - - - - - - - - -
      // Per ticket: https://flexent.atlassian.net/browse/SAMOC-1689
      // Suggested to return offer entries removal from GL config

      // 2. delete from GhostLocker
      updateSpinnerText('Removing GhostLocker config offer entry...');
      if (targetEnv === Env.PROD) {
        await GhostLocker.updateRetentionOfferConfig(
          [],
          offer.offerCode,
          offer.switchToPlan,
          false,
          offer.usersOnPlans ? offer.usersOnPlans.split(',') : null,
          offer.Store.regionCode,
          true,
          Env.PROD,
        );
      }
      await GhostLocker.updateRetentionOfferConfig(
        [],
        offer.offerCode,
        offer.switchToPlan,
        false,
        offer.usersOnPlans ? offer.usersOnPlans.split(',') : null,
        offer.Store.regionCode,
        true,
        Env.STG,
      );

      // 3. clear PlayAuth cache
      updateSpinnerText('Clearing PlayAuth cache...');
      await PlayAuth.clearOfferCache(offer.Store, targetEnv);

      // GL Validation is not required for Delete

      // 4. delete specialOffer entry in Contentful
      // updateSpinnerText('Archiving Contentful entry...');
      // await Contentful.archiveRetentionSpecialOffer(offer);

      // 5. Remove Cache
      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(targetEnv);

      // retire stg/prod offer by updating status
      const newOffer = await updateRetentionOfferStatus(
        offer,
        targetEnv === Env.PROD ? StatusEnum.PROD_RETD : StatusEnum.STG_RETD,
      );

      // 6. save offer in offers history
      const offerHistory = await createOfferHistoryInDb(
        newOffer,
        null,
        updatedBy,
      );
      message = `Offer (${offerId}) retired successfully on ${targetEnv.toUpperCase()}`;
    } else if (targetEnv === Env.DB) {
      // delete draft from DB
      await offer.destroy({ force: true });
      message = `Offer (${offerId}) deleted successfully from ${targetEnv.toUpperCase()}`;
    }

    io.emit('offer-deleted', offer.toJSON());

    retWithSuccess(req, res, {
      message: message,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} Failed to delete offer, ${err.message}`,
      err,
    );
    updateSpinnerText('Retire offer failed, performing rollback...');
    if (!DISABLE_ROLLBACK) {
      await rollbackDeletedRetentionOffer(
        err,
        offer,
        targetEnv,
        previousCoupon,
        previousUpgradeCoupon,
      );
    }
    await updateRetentionOfferStatus(offer, previousStatus);
    return next(processOfferError(err));
  }
};

const deleteExtensionOffer = async (
  storeCode: string,
  updatedBy: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let offer: ExtensionOfferModel;
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousStatus: StatusEnum;
  let message: string;
  try {
    offer = await getExtensionOfferModel(storeCode, offerId);
    if (!offer) {
      throw new AppError(`Offer (${offerId}) not found in the database`, 404);
    }
    targetEnv = getTargetEnv(offer);
    updateSpinnerText(
      `${
        targetEnv === Env.STG || targetEnv === Env.PROD
          ? 'Retiring'
          : 'Deleting'
      } offer...`,
    );
    httpContext.set('env', targetEnv);
    previousStatus = offer.statusId;
    if (targetEnv === Env.STG || targetEnv === Env.PROD) {
      // 1. deactivate coupon in Recurly
      // save current coupon data (needed for restore)
      updateSpinnerText('Retiring Recurly coupon...');
      previousCoupon = await Recurly.getOfferRecurlyPayload(
        offerId,
        offer.Store,
        targetEnv,
      );
      if (offer.upgradeCouponId) {
        previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
          offerId + '_upgrade',
          offer.Store,
          targetEnv,
        );
      }
      // disable coupon in both stage and prod
      if (targetEnv === Env.PROD) {
        await Recurly.deactivateCoupon(
          offer,
          offerId,
          offer.Store,
          Env.PROD,
          updatedBy,
        );
        if (offer.upgradeCouponId) {
          await Recurly.deactivateCoupon(
            offer,
            offerId + '_upgrade',
            offer.Store,
            Env.PROD,
            updatedBy,
          );
        }
      }
      await Recurly.deactivateCoupon(
        offer,
        offerId,
        offer.Store,
        Env.STG,
        updatedBy,
      );
      if (offer.upgradeCouponId) {
        await Recurly.deactivateCoupon(
          offer,
          offerId + '_upgrade',
          offer.Store,
          Env.STG,
          updatedBy,
        );
      }

      // 4. delete specialOffer entry in Contentful
      // updateSpinnerText('Archiving Contentful entry...');
      // await Contentful.archiveRetentionSpecialOffer(offer);

      // 5. Remove Cache
      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(targetEnv);

      // retire stg/prod offer by updating status
      const newOffer = await updateExtensionOfferStatus(
        offer,
        targetEnv === Env.PROD ? StatusEnum.PROD_RETD : StatusEnum.STG_RETD,
      );

      // 6. save offer in offers history
      const offerHistory = await createOfferHistoryInDb(
        newOffer,
        null,
        updatedBy,
      );
      message = `Offer (${offerId}) retired successfully on ${targetEnv.toUpperCase()}`;
    } else if (targetEnv === Env.DB) {
      // delete draft from DB
      await offer.destroy({ force: true });
      message = `Offer (${offerId}) deleted successfully from ${targetEnv.toUpperCase()}`;
    }

    io.emit('offer-deleted', offer.toJSON());

    retWithSuccess(req, res, {
      message: message,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} Failed to delete offer, ${err.message}`,
      err,
    );
    updateSpinnerText('Retire offer failed, performing rollback...');
    await updateExtensionOfferStatus(offer, previousStatus);
    return next(processOfferError(err));
  }
};

export const rollbackDeletedOffer = async (
  err: AppError,
  offer: OfferModel,
  env: Env,
  previousCoupon: OfferRecurlyPayload,
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
        await Contentful.restoreSpecialOffer(offer);
      }
      if (env === Env.PROD) {
        await Recurly.restoreCoupon(
          previousCoupon,
          offer.offerCode,
          offer.Plan.Store,
          Env.PROD,
        );
      }
      await Recurly.restoreCoupon(
        previousCoupon,
        offer.offerCode,
        offer.Plan.Store,
        Env.STG,
      );
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(env)} Rollback failed for Retire Offer, ${rbErr.message}`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Retire Offer on ${env.toUpperCase()}: ${
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

export const rollbackDeletedRetentionOffer = async (
  err: AppError,
  offer: RetentionOfferModel,
  env: Env,
  previousCoupon: OfferRecurlyPayload,
  previousUpgradeCoupon: OfferRecurlyPayload | null,
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
        await Contentful.restoreRetentionSpecialOffer(offer);
      }
      if (env === Env.PROD) {
        await Recurly.restoreCoupon(
          previousCoupon,
          offer.offerCode,
          offer.Store,
          Env.PROD,
        );
        if (previousUpgradeCoupon) {
          await Recurly.restoreCoupon(
            previousUpgradeCoupon,
            offer.offerCode + '_upgrade',
            offer.Store,
            Env.PROD,
          );
        }
      }
      await Recurly.restoreCoupon(
        previousCoupon,
        offer.offerCode,
        offer.Store,
        Env.STG,
      );
      if (previousUpgradeCoupon) {
        await Recurly.restoreCoupon(
          previousUpgradeCoupon,
          offer.offerCode + '_upgrade',
          offer.Store,
          Env.STG,
        );
      }
    }
  } catch (rbErr) {
    logger.error(
      `${logPrefix(env)} Rollback failed for Retire Offer, ${rbErr.message}`,
      err,
    );
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    // rollback failed - mark offer with special status and leave things as is so admin can clean up manually
    await updateRetentionOfferStatus(
      offer,
      env === Env.PROD ? StatusEnum.PROD_RB_FAIL : StatusEnum.STG_RB_FAIL,
    );
    throw new AppError(
      `Rollback failed for Retire Offer on ${env.toUpperCase()}: ${
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
