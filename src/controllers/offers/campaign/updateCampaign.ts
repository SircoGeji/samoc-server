import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../util/errorHandler';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../../types/enum';
import {
  commitOfferToDb,
  commitRetentionOfferToDb,
  getOfferModel,
  getPlanModel,
  getRetentionOfferModel,
  getTargetEnv,
  processCampaignError,
  processOfferError,
  removeExtraCodes,
  retrieveRecurlyPlan,
  updateOfferDbProperties,
  updateRetentionOfferDbProperties,
  updateSpinnerText,
} from '../../../util/utils';
import {
  OfferContentfulPayload,
  OfferRecurlyPayload,
  OfferResponsePayload,
  PlanRecurlyPayload,
  RetentionOfferResponsePayload,
} from '../../../types/payload';
import * as Recurly from '../../../services/Recurly';
import * as Contentful from '../../../services/Contentful';
import { OfferModel } from '../../../models/Offer';
import { retWithSuccess } from '../../../models/SamocResponse';
import Logger from '../../../util/logger';
import * as PlayAuth from '../../../services/PlayAuth';
import * as httpContext from 'express-http-context';
import { DISABLE_CAMPAIGN_ROLLBACK } from '../../../util/config';
import {
  isStatusAllowedForUpdate,
  rollbackOfferForUpdate,
  rollbackRetentionOfferForUpdate,
} from '../updateOffer';
import { CampaignPayload } from './payloads';
import {
  convertFromCampaign,
  convertOrUpdateCampaignInDb,
  retentionConvertFromCampaign,
} from './utils';
import {
  createCampaignOffer,
  createCampaignRetentionOffer,
} from './createNewCampaign';
import { createOfferInDb } from '../createNewOffer';
import { Offer, RetentionOffer, Store } from '../../../models';
import { RetentionOfferModel } from '../../../models/RetentionOffer';
import { createRetentionOfferInDb } from '../createNewRetentionOffer';
import * as CmsApi from '../../../services/CmsApi';
import { createOfferHistoryInDb } from '../offerHistory';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Update Campaign Controller:`;
  } else {
    return `Update Campaign Controller:`;
  }
};

/**
 * PUT /api/offers/campaign/:campaignId
 * Update an existing campaign by campaign ID
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Campaigns Controller - updateCampaign');
    const { campaignId } = req.params;
    updateSpinnerText('Updating campaign...');
    httpContext.set('offerCode', campaignId);
    let targetEnv: Env;
    let previousCoupon: OfferRecurlyPayload;
    let previousEntry: OfferContentfulPayload;
    let planRecurlyPayload: PlanRecurlyPayload;

    try {
      const campaignPayload = req.body as CampaignPayload;
      const updatedBy = req.body.updatedBy;
      if (campaignPayload.offerTypeId === OfferTypes.RETENTION) {
        return updateRetentionCampaign(req, res, next);
      }
      campaignPayload.campaign = campaignId;
      const offers = await convertFromCampaign(campaignPayload);

      await convertOrUpdateCampaignInDb(campaignPayload);

      const errorMessages: AppError[] = [];
      let region = '';

      const campaignOffersByStoreCode = new Map<string, OfferModel>(
        (await Offer.findAll({ where: { campaign: campaignId } })).map((o) => [
          o.storeCode,
          o,
        ]),
      );
      const clearCache = new Set<Env>();
      const offersToUpdate: {
        offer: OfferResponsePayload;
        offerModel: OfferModel;
      }[] = [];
      for (const offer of offers) {
        campaignOffersByStoreCode.delete(offer.storeCode);
        let foundOffer: OfferModel;
        try {
          region = '';
          const plan = await getPlanModel(offer.planCode);
          region = plan.Store.regionCode.toUpperCase();
          foundOffer = await getOfferModel(plan.storeCode, offer.offerCode);
          if (!foundOffer) {
            if (campaignPayload.statusId === StatusEnum.DFT) {
              // Try to find an existing offer with the given store and campaign
              const existingOffer = await Offer.findOne({
                where: { campaign: campaignId, storeCode: offer.storeCode },
              });
              if (existingOffer) {
                if (existingOffer.statusId == StatusEnum.DFT) {
                  await existingOffer.destroy({ force: true });
                } else {
                  throw new AppError(
                    `Updating a non-draft offer as draft on ${Env.STG.toUpperCase()}`,
                  );
                }
              }
              await createOfferInDb(offer, StatusEnum.DFT);
            } else {
              await createCampaignOffer(campaignId, errorMessages, offer, null, updatedBy);
            }
            continue;
          }
          if (!isStatusAllowedForUpdate(foundOffer.statusId)) {
            continue;
          }
          offersToUpdate.push({ offer, offerModel: foundOffer });
        } catch (err) {
          logger.error(
            `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
            err,
          );
          updateSpinnerText(
            `${region}: Update offer failed, performing rollback...`,
          );
          if (!DISABLE_CAMPAIGN_ROLLBACK) {
            await rollbackOfferForUpdate(
              err,
              foundOffer,
              targetEnv,
              previousCoupon,
              previousEntry,
              planRecurlyPayload,
            );
          }
          const appErr = processCampaignError(campaignId, err);
          if (region) {
            appErr.message = `${region}: ${appErr.message}`;
          }
          errorMessages.push(appErr);
        }
      }
      const allPromises: Promise<void>[] = [];
      for (const data of offersToUpdate) {
        const op = async () => {
          const offer = data.offer;
          let foundOffer = data.offerModel;
          try {
            httpContext.set('planCode', foundOffer.planCode);
            targetEnv = getTargetEnv(foundOffer);
            httpContext.set('env', targetEnv);
            foundOffer.set('draftData', JSON.parse(JSON.stringify(offer)));
            if (targetEnv === Env.DB) {
              foundOffer.set('offerTypeId', offer.offerTypeId);
              foundOffer.set('offerCode', offer.offerCode);
              foundOffer.set('planCode', offer.planCode);
              await commitOfferToDb(foundOffer);
            } else if (targetEnv === Env.STG || targetEnv === Env.PROD) {
              // offerCode and planCode are not expected to be in the payload because they cannot be updated
              // so these 2 fields need to be re-inserted into the payload
              offer.offerCode = foundOffer.offerCode;
              offer.planCode = foundOffer.planCode;

              clearCache.add(targetEnv);

              // retrieve plan
              planRecurlyPayload = await retrieveRecurlyPlan(
                foundOffer.planCode,
                foundOffer.Plan.Store,
                targetEnv,
              );

              // 1. Recurly update
              updateSpinnerText(`${region}: Updating Recurly coupon...`);
              previousCoupon = await Recurly.getOfferRecurlyPayload(
                foundOffer.offerCode,
                foundOffer.Plan.Store,
                targetEnv,
              );
              const offerRecurlyPayload = offer;
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
                foundOffer.offerCode,
                foundOffer.Plan.Store,
                targetEnv,
              );

              // GL is not required for Update

              // 2. clear PlayAuth cache
              updateSpinnerText(`${region}: Clearing PlayAuth cache...`);
              await PlayAuth.clearOfferCache(foundOffer.Plan.Store, targetEnv);

              // GL Validation is not required for Update

              // 3. Contentful update
              updateSpinnerText(`${region}: Updating Contentful entry...`);
              previousEntry = await Contentful.fetchSpecialOffer(
                foundOffer.Plan.Store.regionCode,
                foundOffer.offerCode,
                foundOffer.Plan.storeCode,
              );
              await Contentful.updateSpecialOffer(
                offer,
                foundOffer.offerCode,
                foundOffer.Plan,
                targetEnv,
                planRecurlyPayload,
              );

              // 5. update other DB data
              foundOffer = updateOfferDbProperties(foundOffer, offer);
              await foundOffer.save();

              // save offer in offers history
              const offerHistory = await createOfferHistoryInDb(foundOffer, null, updatedBy);
            }
          } catch (err) {
            logger.error(
              `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
              err,
            );
            updateSpinnerText(
              `${region}: Update offer failed, performing rollback...`,
            );
            if (!DISABLE_CAMPAIGN_ROLLBACK) {
              await rollbackOfferForUpdate(
                err,
                foundOffer,
                targetEnv,
                previousCoupon,
                previousEntry,
                planRecurlyPayload,
              );
            }
            const appErr = processCampaignError(campaignId, err);
            if (region) {
              appErr.message = `${region}: ${appErr.message}`;
            }
            errorMessages.push(appErr);
          }
        };
        allPromises.push(op());
      }
      await Promise.all(allPromises);

      for (const [store, offerModel] of campaignOffersByStoreCode) {
        if (offerModel.statusId == StatusEnum.DFT) {
          await offerModel.destroy({ force: true });
        } else {
          throw new AppError(
            `Can't delete a non-draft offer in store ${store} on ${Env.STG.toUpperCase()}`,
          );
        }
      }

      for (const env of clearCache) {
        updateSpinnerText(
          `Clearing ${env.toUpperCase()} Contentful cache, this may take a while...`,
        );
        await CmsApi.clearCmsApiCache(env);
      }

      if (errorMessages.length) {
        const statusCode = errorMessages[0].statusCode;
        const messages = errorMessages.map((m) => m.message).join('\n');
        return next(
          processCampaignError(campaignId, new AppError(messages, statusCode)),
        );
      }
      retWithSuccess(req, res, {
        message: `Campaign (${campaignId}) updated successfully`,
        data: null,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

const updateRetentionCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.debug('Campaigns Controller - updateCampaign');
  const { campaignId } = req.params;
  updateSpinnerText('Updating campaign...');
  httpContext.set('offerCode', campaignId);
  let targetEnv: Env;
  let previousCoupon: OfferRecurlyPayload;
  let previousUpgradeCoupon: OfferRecurlyPayload;
  let previousEntry: OfferContentfulPayload;

  try {
    const campaignPayload = req.body as CampaignPayload;
    const updatedBy = req.body.updatedBy;
    campaignPayload.campaign = campaignId;
    const offers = await retentionConvertFromCampaign(campaignPayload);

    await convertOrUpdateCampaignInDb(campaignPayload);

    const errorMessages: AppError[] = [];
    let region = '';

    const campaignOffersByStoreCode = new Map<string, RetentionOfferModel>(
      (
        await RetentionOffer.findAll({ where: { campaign: campaignId } })
      ).map((o) => [o.storeCode, o]),
    );
    const clearCache = new Set<Env>();
    const offersToUpdate: {
      offer: RetentionOfferResponsePayload;
      offerModel: RetentionOfferModel;
    }[] = [];
    for (const offer of offers) {
      campaignOffersByStoreCode.delete(offer.storeCode);
      let foundOffer: RetentionOfferModel;
      try {
        region = '';
        const storeModel = await Store.findByPk(offer.storeCode);
        region = storeModel.regionCode.toUpperCase();
        foundOffer = await getRetentionOfferModel(
          offer.storeCode,
          offer.offerCode,
        );
        if (!foundOffer) {
          if (campaignPayload.statusId === StatusEnum.DFT) {
            // Try to find an existing offer with the given store and campaign
            const existingOffer = await RetentionOffer.findOne({
              where: { campaign: campaignId, storeCode: offer.storeCode },
            });
            if (existingOffer) {
              if (existingOffer.statusId == StatusEnum.DFT) {
                await existingOffer.destroy({ force: true });
              } else {
                throw new AppError(
                  `Updating a non-draft offer as draft on ${Env.STG.toUpperCase()}`,
                );
              }
            }
            await createRetentionOfferInDb(offer, StatusEnum.DFT);
          } else {
            await createCampaignRetentionOffer(
              campaignId,
              errorMessages,
              offer,
              null,
              updatedBy,
            );
          }
          continue;
        }
        if (!isStatusAllowedForUpdate(foundOffer.statusId)) {
          continue;
        }
        offersToUpdate.push({ offer, offerModel: foundOffer });
      } catch (err) {
        logger.error(
          `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
          err,
        );
        updateSpinnerText(
          `${region}: Update offer failed, performing rollback...`,
        );
        if (!DISABLE_CAMPAIGN_ROLLBACK) {
          await rollbackRetentionOfferForUpdate(
            err,
            foundOffer,
            targetEnv,
            previousCoupon,
            previousUpgradeCoupon,
            previousEntry,
          );
        }
        const appErr = processCampaignError(campaignId, err);
        if (region) {
          appErr.message = `${region}: ${appErr.message}`;
        }
        errorMessages.push(appErr);
      }
    }
    const allPromises: Promise<void>[] = [];
    for (const data of offersToUpdate) {
      const op = async () => {
        const offer = data.offer;
        let foundOffer = data.offerModel;
        try {
          targetEnv = getTargetEnv(foundOffer);
          httpContext.set('env', targetEnv);
          foundOffer.set('draftData', JSON.parse(JSON.stringify(offer)));
          if (targetEnv === Env.DB) {
            foundOffer.set('eligiblePlans', offer.eligiblePlans.join(','));
            foundOffer.set('offerCode', offer.offerCode);
            await commitRetentionOfferToDb(foundOffer);
          } else if (targetEnv === Env.STG || targetEnv === Env.PROD) {
            // offerCode and planCode are not expected to be in the payload because they cannot be updated
            // so these 2 fields need to be re-inserted into the payload
            offer.offerCode = foundOffer.offerCode;

            clearCache.add(targetEnv);

            // retrieve plan
            await retrieveRecurlyPlan(
              foundOffer.eligiblePlans.split(',')[0],
              foundOffer.Store,
              targetEnv,
            );

            // 1. Recurly update
            updateSpinnerText(`${region}: Updating Recurly coupon...`);
            previousCoupon = await Recurly.getOfferRecurlyPayload(
              offer.offerCode,
              foundOffer.Store,
              targetEnv,
            );
            if (offer.upgradePlan) {
              previousUpgradeCoupon = await Recurly.getOfferRecurlyPayload(
                offer.offerCode + '_upgrade',
                foundOffer.Store,
                targetEnv,
              );
            }
            const offerRecurlyPayload = offer;
            await Recurly.updateRetentionCoupon(
              offerRecurlyPayload,
              offer.offerCode,
              false,
              foundOffer.Store,
              targetEnv,
            );
            if (offer.upgradePlan) {
              await Recurly.updateRetentionCoupon(
                offerRecurlyPayload,
                offer.offerCode,
                true,
                foundOffer.Store,
                targetEnv,
              );
            }

            // GL is not required for Update

            // 2. clear PlayAuth cache
            updateSpinnerText(`${region}: Clearing PlayAuth cache...`);
            await PlayAuth.clearOfferCache(foundOffer.Store, targetEnv);

            // GL Validation is not required for Update

            // 3. Contentful update
            updateSpinnerText(`${region}: Updating Contentful entry...`);
            previousEntry = await Contentful.fetchSpecialOffer(
              foundOffer.Store.regionCode,
              offer.offerCode,
              foundOffer.storeCode,
              true,
            );
            await Contentful.updateRetentionSpecialOffer(
              offer,
              offer.storeCode,
              offer.offerCode,
              targetEnv,
              foundOffer.Store.regionCode,
            );

            // 5. update other DB data
            foundOffer = updateRetentionOfferDbProperties(foundOffer, offer);
            await foundOffer.save();

            // save offer in offers history
            const offerHistory = await createOfferHistoryInDb(foundOffer, null, updatedBy);
          }
        } catch (err) {
          logger.error(
            `${logPrefix(targetEnv)} updateOffer failed, ${err.message}`,
            err,
          );
          updateSpinnerText(
            `${region}: Update offer failed, performing rollback...`,
          );
          if (!DISABLE_CAMPAIGN_ROLLBACK) {
            await rollbackRetentionOfferForUpdate(
              err,
              foundOffer,
              targetEnv,
              previousCoupon,
              previousUpgradeCoupon,
              previousEntry,
            );
          }
          const appErr = processCampaignError(campaignId, err);
          if (region) {
            appErr.message = `${region}: ${appErr.message}`;
          }
          errorMessages.push(appErr);
        }
      };
      allPromises.push(op());
    }
    await Promise.all(allPromises);

    for (const [store, offerModel] of campaignOffersByStoreCode) {
      if (offerModel.statusId == StatusEnum.DFT) {
        await offerModel.destroy({ force: true });
      } else {
        throw new AppError(
          `Can't delete a non-draft offer in store ${store} on ${Env.STG.toUpperCase()}`,
        );
      }
    }

    for (const env of clearCache) {
      updateSpinnerText(
        `Clearing ${env.toUpperCase()} Contentful cache, this may take a while...`,
      );
      await CmsApi.clearCmsApiCache(env);
    }

    if (errorMessages.length) {
      const statusCode = errorMessages[0].statusCode;
      const messages = errorMessages.map((m) => m.message).join('\n');
      return next(
        processCampaignError(campaignId, new AppError(messages, statusCode)),
      );
    }
    retWithSuccess(req, res, {
      message: `Campaign (${campaignId}) updated successfully`,
      data: null,
    });
  } catch (err) {
    return next(processOfferError(err));
  }
};
