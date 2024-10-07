import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import * as Contentful from '../../../services/Contentful';
import * as Recurly from '../../../services/Recurly';
import * as CmsApi from '../../../services/CmsApi';
import { Env, StatusEnum } from '../../../types/enum';
import { OfferRecurlyPayload } from '../../../types/payload';
import * as PlayAuth from '../../../services/PlayAuth';
import { OfferModel } from '../../../models/Offer';
import { retWithSuccess } from '../../../models/SamocResponse';
import { AppError } from '../../../util/errorHandler';
import Logger from '../../../util/logger';
import {
  getTargetEnv,
  OFFER_QUERY_OPTS,
  processCampaignError,
  RETENTION_OFFER_QUERY_OPTS,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../../util/utils';
import { io } from '../../../server';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../../util/config';
import { Campaign, Offer, Plan, RetentionOffer } from '../../../models';
import {
  rollbackDeletedOffer,
  rollbackDeletedRetentionOffer,
} from '../deleteOffer';
import { RetentionOfferModel } from '../../../models/RetentionOffer';
import { createOfferHistoryInDb } from '../offerHistory';
import { setOfferModelDraftDataErrMessage } from '..';
import * as GhostLocker from '../../../services/GhostLocker';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Retire Offer Controller:`;
  } else {
    return `Retire Offer Controller:`;
  }
};

/**
 * DELETE /api/offers/campaign/:campaignId
 * Delete a campaign by campaign ID
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Campaigns Controller - deleteCampaign');
    const { campaignId } = req.params;
    const updatedBy = req.query.updatedBy as string;
    const campaignModel = await Campaign.findByPk(campaignId);
    const offerModels: OfferModel[] = await Offer.findAll({
      include: [{ model: Plan }],
      ...OFFER_QUERY_OPTS,
      where: { campaign: campaignId },
    });
    if (offerModels.length === 0) {
      return deleteRetentionCampaign(req, res, updatedBy, next);
    }

    httpContext.set('campaignId', campaignId);
    let targetEnv: Env;
    let previousCoupon: OfferRecurlyPayload;
    let previousStatus: StatusEnum;
    let message: string;
    const errorMessages: AppError[] = [];
    let region = '';
    let dontDeleteCampaign = false;
    try {
      for (const offer of offerModels) {
        region = offer.Plan.Store.regionCode;
        try {
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
            dontDeleteCampaign = true;
            // 1. deactivate coupon in Recurly
            // save current coupon data (needed for restore)
            updateSpinnerText('Retiring Recurly coupon...');
            previousCoupon = await Recurly.getOfferRecurlyPayload(
              offer.offerCode,
              offer.Plan.Store,
              targetEnv,
            );
            // disable coupon in both stage and prod
            if (targetEnv === Env.PROD) {
              await Recurly.deactivateCoupon(
                offer,
                offer.offerCode,
                offer.Plan.Store,
                Env.PROD,
                updatedBy,
              );
            }
            await Recurly.deactivateCoupon(
              offer,
              offer.offerCode,
              offer.Plan.Store,
              Env.STG,
              updatedBy,
            );

            // delete from GhostLocker
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

            // retire stg/prod offer by updating status
            const newOffer = await updateOfferStatus(
              offer,
              targetEnv === Env.PROD
                ? StatusEnum.PROD_RETD
                : StatusEnum.STG_RETD,
            );
            // save offer in offers history
            const offerHistory = await createOfferHistoryInDb(
              newOffer,
              null,
              updatedBy,
            );
            message = `Campaign (${campaignId}) retired successfully on ${targetEnv.toUpperCase()}`;
          } else if (targetEnv === Env.DB) {
            // delete draft from DB
            await offer.destroy({ force: true });
            message = `Campaign (${campaignId}) deleted successfully from ${targetEnv.toUpperCase()}`;
          }

          io.emit('offer-deleted', offer.toJSON());
        } catch (err) {
          logger.error(
            `${logPrefix(targetEnv)} Failed to delete offer, ${err.message}`,
            err,
          );
          updateSpinnerText('Retire offer failed, performing rollback...');
          if (!DISABLE_ROLLBACK) {
            await rollbackDeletedOffer(err, offer, targetEnv, previousCoupon);
          }
          const appErr = processCampaignError(campaignId, err);
          if (region) {
            appErr.message = `${region}: ${appErr.message}`;
          }
          errorMessages.push(appErr);
          setOfferModelDraftDataErrMessage(offer, err.message);
          await updateOfferStatus(offer, previousStatus);
        }
      }
      if (!dontDeleteCampaign) {
        if (campaignModel) {
          await campaignModel.destroy({ force: true });
        }
        message = `Campaign (${campaignId}) deleted successfully from ${targetEnv.toUpperCase()}`;
      } else {
        // 5. Remove Cache
        updateSpinnerText(
          'Clearing Contentful cache, this may take a while...',
        );
        await CmsApi.clearCmsApiCache(targetEnv);
        message = `Campaign (${campaignId}) retired successfully on ${targetEnv.toUpperCase()}`;
      }

      if (errorMessages.length) {
        const statusCode = errorMessages[0].statusCode;
        const messages = errorMessages.map((m) => m.message).join('\n');
        return next(
          processCampaignError(campaignId, new AppError(messages, statusCode)),
        );
      }

      retWithSuccess(req, res, {
        message: message,
        data: null,
      });
    } catch (err) {
      logger.error(
        `${logPrefix(targetEnv)} Failed to delete campaign, ${err.message}`,
        err,
      );
      updateSpinnerText('Retire offer failed');
      return next(processCampaignError(campaignId, err));
    }
  },
);

export const deleteRetentionCampaign = async (
  req: Request,
  res: Response,
  updatedBy: string,
  next: NextFunction,
) => {
  logger.debug('Campaigns Controller - deleteCampaign');
  const { campaignId } = req.params;
  const campaignModel = await Campaign.findByPk(campaignId);
  const offerModels: RetentionOfferModel[] = await RetentionOffer.findAll({
    ...RETENTION_OFFER_QUERY_OPTS,
    where: { campaign: campaignId },
  });
  if (offerModels.length === 0) {
    throw new AppError(`Campaign (${campaignId}) not found`, 404);
  }

  httpContext.set('campaignId', campaignId);
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousStatus: StatusEnum;
  let message: string;
  const errorMessages: AppError[] = [];
  let region = '';
  let dontDeleteCampaign = false;
  try {
    for (const offer of offerModels) {
      region = offer.Store.regionCode;
      try {
        httpContext.set('storeCode', offer.storeCode);
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
          dontDeleteCampaign = true;
          // 1. deactivate coupon in Recurly
          // save current coupon data (needed for restore)
          updateSpinnerText('Retiring Recurly coupon...');
          previousCoupon = await Recurly.getOfferRecurlyPayload(
            offer.offerCode,
            offer.Store,
            targetEnv,
          );
          if (offer.upgradeCouponId) {
            previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
              offer.offerCode + '_upgrade',
              offer.Store,
              targetEnv,
            );
          }
          // disable coupon in both stage and prod
          if (targetEnv === Env.PROD) {
            await Recurly.deactivateCoupon(
              offer,
              offer.offerCode,
              offer.Store,
              Env.PROD,
              updatedBy,
            );
            if (offer.upgradeCouponId) {
              await Recurly.deactivateCoupon(
                offer,
                offer.upgradeOfferCode,
                offer.Store,
                Env.PROD,
                updatedBy,
              );
            }
          }
          await Recurly.deactivateCoupon(
            offer,
            offer.offerCode,
            offer.Store,
            Env.STG,
            updatedBy,
          );
          if (offer.upgradeCouponId) {
            await Recurly.deactivateCoupon(
              offer,
              offer.upgradeOfferCode,
              offer.Store,
              Env.STG,
              updatedBy,
            );
          }

          // 3. clear PlayAuth cache
          updateSpinnerText('Clearing PlayAuth cache...');
          await PlayAuth.clearOfferCache(offer.Store, targetEnv);

          // GL Validation is not required for Delete

          // 4. delete specialOffer entry in Contentful
          // updateSpinnerText('Archiving Contentful entry...');
          // await Contentful.archiveRetentionSpecialOffer(offer);

          // retire stg/prod offer by updating status
          await updateRetentionOfferStatus(
            offer,
            targetEnv === Env.PROD ? StatusEnum.PROD_RETD : StatusEnum.STG_RETD,
          );
        } else if (targetEnv === Env.DB) {
          // delete draft from DB
          await offer.destroy({ force: true });
        }

        io.emit('offer-deleted', offer.toJSON());
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
        const appErr = processCampaignError(campaignId, err);
        if (region) {
          appErr.message = `${region}: ${appErr.message}`;
        }
        errorMessages.push(appErr);
        await updateRetentionOfferStatus(offer, previousStatus);
      }
    }
    if (!dontDeleteCampaign) {
      if (campaignModel) {
        await campaignModel.destroy({ force: true });
      }
      message = `Campaign (${campaignId}) deleted successfully from ${targetEnv.toUpperCase()}`;
    } else {
      // 5. Remove Cache
      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(targetEnv);
      message = `Campaign (${campaignId}) retired successfully on ${targetEnv.toUpperCase()}`;
    }

    if (errorMessages.length) {
      const statusCode = errorMessages[0].statusCode;
      const messages = errorMessages.map((m) => m.message).join('\n');
      return next(
        processCampaignError(campaignId, new AppError(messages, statusCode)),
      );
    }

    retWithSuccess(req, res, {
      message: message,
      data: null,
    });
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} Failed to delete campaign, ${err.message}`,
      err,
    );
    updateSpinnerText('Retire offer failed');
    return next(processCampaignError(campaignId, err));
  }
};
