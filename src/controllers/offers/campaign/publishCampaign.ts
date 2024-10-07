import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { OfferModel } from '../../../models/Offer';
import {
  AppError,
  PreUpdateRemoteError,
  RecurlyError,
} from '../../../util/errorHandler';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../../types/enum';
import { retWithSuccess } from '../../../models/SamocResponse';
import Logger from '../../../util/logger';
import * as Recurly from '../../../services/Recurly';
import * as Contentful from '../../../services/Contentful';
import * as PlayAuth from '../../../services/PlayAuth';
import * as GhostLocker from '../../../services/GhostLocker';
import * as CmsApi from '../../../services/CmsApi';
import {
  getFlexSiteUrl,
  OFFER_QUERY_OPTS,
  processCampaignError,
  RETENTION_OFFER_QUERY_OPTS,
  retrieveRecurlyPlan,
  updateOfferStatus,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../../util/utils';
import * as httpContext from 'express-http-context';
import { DISABLE_CAMPAIGN_ROLLBACK } from '../../../util/config';
import { Offer, Plan, RetentionOffer } from '../../../models';
import {
  isPublishStatusAllowed,
  rollbackRetentionOfferPublish,
  rollbacOfferPublish,
} from '../publishOffer';
import { RetentionOfferModel } from '../../../models/RetentionOffer';
import {
  OfferRecurlyPayload,
  PlanRecurlyPayload,
} from '../../../types/payload';
import { GLSet } from '../../../services/GhostLocker';
import { createOfferHistoryInDb } from '../offerHistory';
import { setOfferModelDraftDataErrMessage } from '..';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Publish Offer Controller:`;
  } else {
    return `Publish Offer Controller:`;
  }
};

interface OfferPublishData {
  offer: OfferModel;
  recurlyPayload: OfferRecurlyPayload;
}
const publishOfferRecurlyContentful = async (
  campaignId: string,
  errorMessages: AppError[],
  foundOffer: OfferModel,
  updatedBy: string,
): Promise<OfferPublishData> => {
  let region = '';
  try {
    region = foundOffer.Plan.Store.regionCode.toUpperCase();
    if (!foundOffer.Plan.Store.rlyApiKeyProd) {
      await updateOfferStatus(foundOffer, StatusEnum.PROD);
      return null;
    }

    if (!isPublishStatusAllowed(foundOffer.statusId)) {
      return null;
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
    updateSpinnerText(`${region}: Creating Recurly coupon...`);
    const couponId = await Recurly.createCoupon(
      recurlyPayload,
      recurlyPlan,
      foundOffer.Plan.Store,
      Env.PROD,
    );
    foundOffer.set('couponId', couponId);

    // 5. update Offer in Contentful to Prod
    updateSpinnerText(`${region}: Processing Contentful entry...`);
    await Contentful.setEnvForSpecialOffer(
      foundOffer.Plan.Store.regionCode,
      foundOffer.offerCode,
      foundOffer.Plan.storeCode,
      Env.PROD,
    );
    return { offer: foundOffer, recurlyPayload };
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      await rollbacOfferPublish(err, foundOffer, updatedBy);
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
    const appErr = processCampaignError(campaignId, err);
    if (region) {
      appErr.message = `${region}: ${appErr.message}`;
    }
    errorMessages.push(appErr);
  }
  return null;
};

const publishOfferUpdateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: OfferPublishData,
  updatedBy: string,
): Promise<OfferPublishData> => {
  const foundOffer = data.offer;
  const recurlyPayload = data.recurlyPayload;

  let region = '';
  try {
    region = foundOffer.Plan.Store.regionCode.toUpperCase();
    // 2. publish to GhostLocker
    updateSpinnerText(`${region}: Updating GhostLocker config...`);
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
    return { offer: foundOffer, recurlyPayload };
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      await rollbacOfferPublish(err, foundOffer, updatedBy);
    }
    setOfferModelDraftDataErrMessage(foundOffer, err.message);
    await updateOfferStatus(foundOffer, StatusEnum.PROD_FAIL);
    const appErr = processCampaignError(campaignId, err);
    appErr.message = `${region}: ${appErr.message}`;
    errorMessages.push(appErr);
  }
  return null;
};

const publishOfferValidateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: OfferPublishData,
  updatedBy: string,
): Promise<OfferPublishData> => {
  const foundOffer = data.offer;
  const recurlyPayload = data.recurlyPayload;

  let region = '';
  try {
    region = foundOffer.Plan.Store.regionCode.toUpperCase();
    // 3. publish to PlayAuth
    updateSpinnerText(`${region}: Clearing PlayAuth cache...`);
    await PlayAuth.clearOfferCache(foundOffer.Plan.Store, Env.PROD);

    // 4. Validate GhostLocker (via PlayAuth)
    let uniqueOfferCode: string;
    if (
      recurlyPayload &&
      recurlyPayload.offerCodeType === CodeType.BULK_UNIQUE_CODE
    ) {
      uniqueOfferCode = await Recurly.fetchBulkCode(foundOffer, Env.PROD);
    }
    updateSpinnerText(`${region}: Validating GhostLocker...`);
    await PlayAuth.validateGl(
      foundOffer.Plan.Store.regionCode,
      getFlexSiteUrl(Env.PROD, foundOffer.Plan.Store.regionCode),
      Env.PROD,
      foundOffer.offerCode,
      uniqueOfferCode,
    );
    const newOffer = await updateOfferStatus(foundOffer, StatusEnum.PROD);

    // save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      null,
      updatedBy,
    );

    updateSpinnerText(`${region}: Offer published successfully`);
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      await rollbacOfferPublish(err, foundOffer, updatedBy);
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
    const appErr = processCampaignError(campaignId, err);
    if (region) {
      appErr.message = `${region}: ${appErr.message}`;
    }
    errorMessages.push(appErr);
  }
  return null;
};

/**
 * GET /api/campaign/:campaignId/publish
 * Publish an existing campaign to :env by campaign ID
 *
 * Publish to PROD
 *   Pre-requisite:  Status must be STG_VALDN_PASS
 *
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Campaigns Controller - publishCampaign');
    const { campaignId } = req.params;
    httpContext.set('campaign', campaignId);
    updateSpinnerText('Publishing campaign...');

    const errorMessages: AppError[] = [];
    try {
      const updatedBy = req.query.updatedBy as string;
      const offerModels: OfferModel[] = await Offer.findAll({
        include: [{ model: Plan }],
        ...OFFER_QUERY_OPTS,
        where: { campaign: campaignId },
      });
      if (offerModels.length === 0) {
        return publishRetentionCampaign(req, res, next);
      }
      const allPromises: Promise<OfferPublishData>[] = [];
      for (const offer of offerModels) {
        allPromises.push(
          publishOfferRecurlyContentful(
            campaignId,
            errorMessages,
            offer,
            updatedBy,
          ),
        );
      }

      const publishData = await Promise.all(allPromises);
      const validationData: OfferPublishData[] = [];
      for (const data of publishData) {
        if (data) {
          const valid = await publishOfferUpdateGl(
            campaignId,
            errorMessages,
            data,
            updatedBy,
          );
          if (valid) {
            validationData.push(valid);
          }
        }
      }
      await Promise.all(
        validationData.map((data) =>
          publishOfferValidateGl(campaignId, errorMessages, data, updatedBy),
        ),
      );
      // 6. Remove Cache
      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(Env.PROD);
    } catch (err) {
      logger.error(`${logPrefix(Env.PROD)} ${err.message}`, err);
      return next(processCampaignError(campaignId, err));
    }
    if (errorMessages.length) {
      const statusCode = errorMessages[0].statusCode;
      const messages = errorMessages.map((m) => m.message).join('\n');
      return next(
        processCampaignError(campaignId, new AppError(messages, statusCode)),
      );
    }
    retWithSuccess(req, res, {
      message: `Campaign (${campaignId}) published successfully`,
      status: 201,
      data: null,
    });
  },
);

const publishRetentionOfferRecurlyContentful = async (
  campaignId: string,
  errorMessages: AppError[],
  foundOffer: RetentionOfferModel,
  updatedBy: string,
): Promise<RetentionOfferModel> => {
  const region = foundOffer.Store.regionCode.toUpperCase();
  try {
    if (!foundOffer.Store.rlyApiKeyProd) {
      await updateRetentionOfferStatus(foundOffer, StatusEnum.PROD);
      return null;
    }

    if (!isPublishStatusAllowed(foundOffer.statusId)) {
      return null;
    }
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
    updateSpinnerText(`${region}: Creating Recurly coupon...`);
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
      updateSpinnerText(`${region}: Creating Recurly upgrade coupon...`);
      const upgradeCouponId = await Recurly.createRetentionCoupon(
        recurlyPayload,
        eligiblePlans,
        true,
        foundOffer.Store,
        Env.PROD,
      );
      foundOffer.set('upgradeCouponId', upgradeCouponId);
    }

    // 5. update Offer in Contentful to Prod
    updateSpinnerText(`${region}: Processing Contentful entry...`);
    await Contentful.setEnvForSpecialOffer(
      foundOffer.Store.regionCode,
      foundOffer.offerCode,
      foundOffer.storeCode,
      Env.PROD,
      false,
    );
    return foundOffer;
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
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
    const appErr = processCampaignError(campaignId, err);
    if (region) {
      appErr.message = `${region}: ${appErr.message}`;
    }
    errorMessages.push(appErr);
  }
  return null;
};

export const publishRetentionOfferUpdateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  foundOffer: RetentionOfferModel,
  updatedBy: string,
): Promise<RetentionOfferModel> => {
  const region = foundOffer.Store.regionCode.toUpperCase();
  try {
    // 2. publish to GhostLocker
    updateSpinnerText(`${region}: Updating GhostLocker config...`);
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
    return foundOffer;
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      await rollbackRetentionOfferPublish(err, foundOffer, updatedBy);
    }
    setOfferModelDraftDataErrMessage(foundOffer, err.message);
    await updateRetentionOfferStatus(foundOffer, StatusEnum.PROD_FAIL);
    const appErr = processCampaignError(campaignId, err);
    if (region) {
      appErr.message = `${region}: ${appErr.message}`;
    }
    errorMessages.push(appErr);
  }
  return null;
};

export const publishRetentionOfferValidateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  foundOffer: RetentionOfferModel,
  updatedBy: string,
): Promise<RetentionOfferModel> => {
  const region = foundOffer.Store.regionCode.toUpperCase();
  try {
    // 3. publish to PlayAuth
    updateSpinnerText(`${region}: Clearing PlayAuth cache...`);
    await PlayAuth.clearOfferCache(
      foundOffer.Store,
      Env.PROD,
      GLSet.RET_RECURLY_V2,
    );

    // 4. Validate GhostLocker (via PlayAuth)
    updateSpinnerText(`${region} Validating GhostLocker...`);
    await PlayAuth.validateGl(
      foundOffer.Store.regionCode,
      getFlexSiteUrl(Env.PROD, foundOffer.Store.regionCode),
      Env.PROD,
      foundOffer.offerCode,
      undefined,
      OfferTypes.RETENTION,
    );

    // 7. update offer status in DB
    const newOffer = await updateRetentionOfferStatus(
      foundOffer,
      StatusEnum.PROD,
    );
    // save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      null,
      updatedBy,
    );
    updateSpinnerText(`${region}: Offer published successfully`);
  } catch (err) {
    logger.error(
      `${logPrefix(Env.PROD)} publishOffer failed, ${err.message}`,
      err,
    );
    updateSpinnerText(
      `${region}: Publish offer failed, performing rollback...`,
    );
    if (!DISABLE_CAMPAIGN_ROLLBACK) {
      await rollbackRetentionOfferPublish(err, foundOffer, updatedBy);
    }
    setOfferModelDraftDataErrMessage(foundOffer, err.message);
    await updateRetentionOfferStatus(foundOffer, StatusEnum.PROD_FAIL);
    const appErr = processCampaignError(campaignId, err);
    if (region) {
      appErr.message = `${region}: ${appErr.message}`;
    }
    errorMessages.push(appErr);
  }
  return null;
};

export const publishRetentionCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  logger.debug('Campaigns Controller - publishCampaign');
  const { campaignId } = req.params;
  httpContext.set('campaign', campaignId);

  const errorMessages: AppError[] = [];
  try {
    const updatedBy = req.query.updatedBy as string;
    const offerModels: RetentionOfferModel[] = await RetentionOffer.findAll({
      ...RETENTION_OFFER_QUERY_OPTS,
      where: { campaign: campaignId },
    });
    if (offerModels.length === 0) {
      throw new AppError(`Campaign (${campaignId}) not found`, 404);
    }
    const allPromises: Promise<RetentionOfferModel>[] = [];
    for (const offer of offerModels) {
      allPromises.push(
        publishRetentionOfferRecurlyContentful(
          campaignId,
          errorMessages,
          offer,
          updatedBy,
        ),
      );
    }

    const publishData = await Promise.all(allPromises);
    const validationData: RetentionOfferModel[] = [];
    for (const offer of publishData) {
      if (offer) {
        const valid = await publishRetentionOfferUpdateGl(
          campaignId,
          errorMessages,
          offer,
          updatedBy,
        );
        if (valid) {
          validationData.push(valid);
        }
      }
    }
    await Promise.all(
      validationData.map((data) =>
        publishRetentionOfferValidateGl(
          campaignId,
          errorMessages,
          data,
          updatedBy,
        ),
      ),
    );

    // 6. Remove Cache
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.PROD);
  } catch (err) {
    logger.error(`${logPrefix(Env.PROD)} ${err.message}`, err);
    return next(processCampaignError(campaignId, err));
  }
  if (errorMessages.length) {
    const statusCode = errorMessages[0].statusCode;
    const messages = errorMessages.map((m) => m.message).join('\n');
    return next(
      processCampaignError(campaignId, new AppError(messages, statusCode)),
    );
  }
  retWithSuccess(req, res, {
    message: `Campaign (${campaignId}) published successfully`,
    status: 201,
    data: null,
  });
};
