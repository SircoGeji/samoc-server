import { NextFunction, Request, Response } from 'express';
import Logger from '../../../util/logger';
import { AppError } from '../../../util/errorHandler';
import {
  getOfferModel,
  getPlanModel,
  getRetentionOfferModel,
  getFlexSiteUrl,
  getStoreModel,
  processCampaignError,
  retrieveRecurlyPlan,
  updateOfferDbProperties,
  updateOfferStatus,
  updateRetentionOfferDbProperties,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../../util/utils';
import { OfferModel } from '../../../models/Offer';
import { retWithSuccess } from '../../../models/SamocResponse';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../../types/enum';
import {
  OfferDbPayload,
  OfferResponsePayload,
  PlanRecurlyPayload,
  RetentionOfferContentfulPayload,
  RetentionOfferRecurlyPayload,
  RetentionOfferResponsePayload,
} from '../../../types/payload';
import asyncHandler from 'express-async-handler';
import * as Recurly from '../../../services/Recurly';
import * as Contentful from '../../../services/Contentful';
import * as PlayAuth from '../../../services/PlayAuth';
import * as GhostLocker from '../../../services/GhostLocker';
import * as CmsApi from '../../../services/CmsApi';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../../util/config';
import { createRetentionOfferInDb } from '../createNewRetentionOffer';
import { CampaignPayload } from './payloads';
import {
  convertFromCampaign,
  convertOrUpdateCampaignInDb,
  retentionConvertFromCampaign,
  uniqueCampaignId,
} from './utils';
import { createOfferInDb, isStatusAllowed } from '../createNewOffer';
import { GLSet } from '../../../services/GhostLocker';
import { RetentionOfferModel } from '../../../models/RetentionOffer';
import { createOfferHistoryInDb } from '../offerHistory';
import { setOfferModelDraftDataErrMessage } from '..';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Create Offer Controller:`;
  } else {
    return `Create Offer Controller:`;
  }
};

export const rollbackCampaignOffer = async (
  err: AppError,
  offer: OfferModel,
  env: Env,
  rollbackRecurly: boolean,
  rollbackContentful: boolean,
  rollbackGl: boolean,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (rollbackGl) {
      // rollback GL and expire recurly coupon
      await GhostLocker.rollbackToVersion(
        GLSet.PROMO_RECURLY,
        offer.offerCode,
        offer.glRollbackVersion,
        env,
      );
    }
    if (rollbackContentful) {
      await Contentful.archiveSpecialOffer(offer);
    }
    if (rollbackRecurly) {
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Plan.Store,
        env,
        updatedBy,
      );
    }
  } catch (rbErr) {
    logger.error(`${logPrefix(env)} Rollback failed, ${err.message}`, rbErr);
    // rollback failed - mark offer with special status
    setOfferModelDraftDataErrMessage(offer, rbErr.message);
    await updateOfferStatus(offer, StatusEnum.STG_RB_FAIL);
    throw new AppError(
      `Rollback failed for Create Offer on ${env.toUpperCase()}: ${
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

interface OfferCreationData {
  offer: OfferResponsePayload;
  offerModel: OfferModel;
  regionPrefix: string;
}

const createCampaignOfferExternal = async (
  campaignId: string,
  errorMessages: AppError[],
  offer: OfferResponsePayload,
  updatedBy: string,
): Promise<OfferCreationData> => {
  const contentfulPayload = offer;
  const recurlyPayload = offer;

  const plan = await getPlanModel(offer.planCode);
  const regionPrefix = plan.Store.regionCode.toUpperCase() + ': ';
  let offerModel = await getOfferModel(plan.Store.storeCode, offer.offerCode);
  if (offerModel) {
    if (!isStatusAllowed(offerModel.statusId)) {
      return null;
    }
    offerModel = updateOfferDbProperties(offerModel, offer);
  } else {
    try {
      offerModel = await createOfferInDb(offer, StatusEnum.STG);
    } catch (err) {
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw new AppError(
          `${regionPrefix}The offer could not be saved. DB error: Invalid value for ${err.fields}`,
          err.statusCode ? err.statusCode : 500,
        );
      } else {
        throw new AppError(
          `${regionPrefix}The offer could not be saved. DB error: ${err.message}`,
          err.statusCode ? err.statusCode : 500,
        );
      }
    }
    offerModel.Plan = plan;
  }
  let rollbackRecurly = false;
  try {
    // check if the plan exists in Recurly stg
    updateSpinnerText(`${regionPrefix}Creating Recurly coupon...`);
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
    rollbackRecurly = true;

    // 5. publish to Contentful
    updateSpinnerText(`${regionPrefix}Processing Contentful entry...`);
    await Contentful.createSpecialOffer(
      contentfulPayload,
      offerModel.Plan,
      recurlyPlan,
      Env.STG,
    );

    return { offer, offerModel, regionPrefix };
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    try {
      if (!DISABLE_ROLLBACK) {
        await rollbackCampaignOffer(
          err,
          offerModel,
          Env.STG,
          rollbackRecurly,
          false,
          false,
          updatedBy,
        );
      }
      const status = rollbackRecurly ? StatusEnum.STG_FAIL : StatusEnum.DFT;
      offerModel.draftData = JSON.parse(JSON.stringify(offer));
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateOfferStatus(offerModel, status);
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${regionPrefix}${appErr.message}`;
      errorMessages.push(appErr);
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    } catch (rbErr) {
      logger.error(
        `${logPrefix(Env.STG)} Offer recovery failed, ${err.message}`,
        rbErr,
      );
    }
  }
  return null;
};

const createCampaignOfferUpdateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: OfferCreationData,
  updatedBy: string,
): Promise<OfferCreationData> => {
  const offerModel = data.offerModel;
  const offer = data.offer;
  const regionPrefix = data.regionPrefix;
  try {
    updateSpinnerText(`${regionPrefix}Updating GhostLocker config...`);
    const response = await GhostLocker.updateOfferConfig(
      offer.offerCode,
      offer.offerTypeId,
      offer.planCode,
      offerModel.Plan.Store.regionCode,
      false,
      Env.STG,
    );
    // save the rollback config version to model
    offerModel.glRollbackVersion = response.configurationVersion - 1;
    return data;
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    try {
      if (!DISABLE_ROLLBACK) {
        await rollbackCampaignOffer(
          err,
          offerModel,
          Env.STG,
          true,
          true,
          false,
          updatedBy,
        );
      }
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateOfferStatus(offerModel, StatusEnum.STG_FAIL);
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${regionPrefix}${appErr.message}`;
      errorMessages.push(appErr);
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    } catch (rbErr) {
      logger.error(
        `${logPrefix(Env.STG)} Offer recovery failed, ${err.message}`,
        rbErr,
      );
    }
  }
  return null;
};

const createCampaignOfferValidateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: OfferCreationData,
  createdBy: string,
  updatedBy: string,
): Promise<void> => {
  const offerModel = data.offerModel;
  const offer = data.offer;
  const regionPrefix = data.regionPrefix;
  try {
    // 3. clear PlayAuth cache
    updateSpinnerText(`${regionPrefix}Clearing PlayAuth cache...`);
    await PlayAuth.clearOfferCache(offerModel.Plan.Store, Env.STG);

    // 4. Validate GhostLocker (via PlayAuth)
    let uniqueOfferCode: string;
    if (offer.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
      uniqueOfferCode = await Recurly.fetchBulkCode(offerModel, Env.STG);
    }
    updateSpinnerText(`${regionPrefix}Validating GhostLocker...`);
    await PlayAuth.validateGl(
      offerModel.Plan.Store.regionCode,
      getFlexSiteUrl(Env.STG, offerModel.Plan.Store.regionCode),
      Env.STG,
      offer.offerCode,
      uniqueOfferCode,
    );
    offerModel.draftData = JSON.parse(JSON.stringify(offer));
    const newOffer = await updateOfferStatus(offerModel, StatusEnum.STG);
    // save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      createdBy,
      updatedBy,
    );
    updateSpinnerText(`${regionPrefix}Offer created successfully`);
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    if (!DISABLE_ROLLBACK) {
      await rollbackCampaignOffer(
        err,
        offerModel,
        Env.STG,
        true,
        true,
        true,
        updatedBy,
      );
    }
    setOfferModelDraftDataErrMessage(offerModel, err.message);
    await updateOfferStatus(offerModel, StatusEnum.STG_FAIL);
    const appErr = processCampaignError(campaignId, err);
    appErr.message = `${regionPrefix}${appErr.message}`;
    errorMessages.push(appErr);
    logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
  }
};

export const createCampaignOffer = async (
  campaignId: string,
  errorMessages: AppError[],
  offer: OfferResponsePayload,
  createdBy: string,
  updatedBy: string,
): Promise<void> => {
  let data = await createCampaignOfferExternal(
    campaignId,
    errorMessages,
    offer,
    updatedBy,
  );
  if (data) {
    data = await createCampaignOfferUpdateGl(
      campaignId,
      errorMessages,
      data,
      updatedBy,
    );
  }
  if (data) {
    await createCampaignOfferValidateGl(
      campaignId,
      errorMessages,
      data,
      createdBy,
      updatedBy,
    );
  }
};

interface RetentionOfferCreationData {
  offer: RetentionOfferResponsePayload;
  offerModel: RetentionOfferModel;
  regionPrefix: string;
}

export const rollbackRetentionCampaignOffer = async (
  err: AppError,
  offer: RetentionOfferModel,
  env: Env,
  rollbackRecurly: boolean,
  rollbackContentful: boolean,
  rollbackGl: boolean,
  updatedBy: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Rollback triggered for (${offer.offerCode}).`,
  );
  try {
    if (rollbackGl) {
      // rollback GL and expire recurly coupon
      await GhostLocker.rollbackToVersion(
        GLSet.RET_RECURLY_V2,
        offer.offerCode,
        offer.glRollbackVersion,
        env,
      );
    }
    if (rollbackContentful) {
      await Contentful.archiveRetentionSpecialOffer(offer);
    }
    if (rollbackRecurly) {
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Store,
        env,
        updatedBy,
      );
    }
  } catch (rbErr) {
    logger.error(`${logPrefix(env)} Rollback failed, ${err.message}`, rbErr);
    // rollback failed - mark offer with special status
    setOfferModelDraftDataErrMessage(offer, err.message);
    await updateRetentionOfferStatus(offer, StatusEnum.STG_RB_FAIL);
    throw new AppError(
      `Rollback failed for Create Offer on ${env.toUpperCase()}: ${
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

const createCampaignRetentionOfferExternal = async (
  campaignId: string,
  errorMessages: AppError[],
  offer: RetentionOfferResponsePayload,
  updatedBy: string,
): Promise<RetentionOfferCreationData> => {
  const contentfulPayload: RetentionOfferContentfulPayload = offer;
  const recurlyPayload: RetentionOfferRecurlyPayload = offer;

  const storeModel = await getStoreModel(offer.storeCode);
  const regionPrefix = storeModel.regionCode.toUpperCase() + ': ';
  let offerModel = await getRetentionOfferModel(
    offer.storeCode,
    offer.offerCode,
  );
  if (offerModel) {
    if (!isStatusAllowed(offerModel.statusId)) {
      return;
    }
    offerModel = updateRetentionOfferDbProperties(offerModel, offer);
  } else {
    try {
      offerModel = await createRetentionOfferInDb(offer, StatusEnum.STG);
    } catch (err) {
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw new AppError(
          `${regionPrefix}The offer could not be saved. DB error: Invalid value for ${err.fields}`,
          err.statusCode ? err.statusCode : 500,
        );
      } else {
        throw new AppError(
          `${regionPrefix}The offer could not be saved. DB error: ${err.message}`,
          err.statusCode ? err.statusCode : 500,
        );
      }
    }
    offerModel.Store = await getStoreModel(offer.storeCode);
  }
  let rollbackRecurly = false;
  try {
    // check if the plan exists in Recurly stg
    updateSpinnerText(`${regionPrefix}Creating Recurly coupon...`);

    const eligiblePlans: PlanRecurlyPayload[] = [];
    for (const planCode of recurlyPayload.eligiblePlans) {
      const plan = await retrieveRecurlyPlan(planCode, storeModel, Env.STG);
      eligiblePlans.push(plan);
    }

    // 1. create coupon on Recurly
    const couponId = await Recurly.createRetentionCoupon(
      recurlyPayload,
      eligiblePlans,
      false,
      storeModel,
      Env.STG,
    );
    offerModel.set('couponId', couponId);

    // 1. create upgrade coupon on Recurly
    if (offer.upgradePlan) {
      updateSpinnerText(`${regionPrefix}Creating Recurly upgrade coupon...`);
      const upgradeCouponId = await Recurly.createRetentionCoupon(
        recurlyPayload,
        eligiblePlans,
        true,
        storeModel,
        Env.STG,
      );
      offerModel.set('upgradeCouponId', upgradeCouponId);
    }
    rollbackRecurly = true;

    // 5. publish to Contentful
    updateSpinnerText(`${regionPrefix}Processing Contentful entry...`);
    await Contentful.createRetentionSpecialOffer(
      contentfulPayload,
      eligiblePlans[0],
      storeModel.regionCode,
      Env.STG,
      !!offer.upgradePlan,
    );

    return { offer, offerModel, regionPrefix };
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    try {
      if (!DISABLE_ROLLBACK) {
        await rollbackRetentionCampaignOffer(
          err,
          offerModel,
          Env.STG,
          rollbackRecurly,
          false,
          false,
          updatedBy,
        );
      }
      const status = rollbackRecurly ? StatusEnum.STG_FAIL : StatusEnum.DFT;
      offerModel.draftData = JSON.parse(JSON.stringify(offer));
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateRetentionOfferStatus(offerModel, status);
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${regionPrefix}${appErr.message}`;
      errorMessages.push(appErr);
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    } catch (rbErr) {
      logger.error(
        `${logPrefix(Env.STG)} Offer recovery failed, ${err.message}`,
        rbErr,
      );
    }
  }

  return null;
};

const createCampaignRetentionOfferUpdateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: RetentionOfferCreationData,
  updatedBy: string,
): Promise<RetentionOfferCreationData> => {
  const offerModel = data.offerModel;
  const offer = data.offer;
  const regionPrefix = data.regionPrefix;
  try {
    updateSpinnerText(`${regionPrefix}Updating GhostLocker config...`);
    const response = await GhostLocker.updateRetentionOfferConfig(
      [],
      offer.offerCode,
      offer.upgradePlan,
      false,
      offer.usersOnPlans,
      offerModel.Store.regionCode,
      false,
      Env.STG,
    );
    // save the rollback config version to model
    offerModel.glRollbackVersion = response.configurationVersion - 1;
    return data;
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    try {
      if (!DISABLE_ROLLBACK) {
        await rollbackRetentionCampaignOffer(
          err,
          offerModel,
          Env.STG,
          true,
          true,
          false,
          updatedBy,
        );
      }
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateRetentionOfferStatus(offerModel, StatusEnum.STG_FAIL);
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${regionPrefix}${appErr.message}`;
      errorMessages.push(appErr);
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    } catch (rbErr) {
      logger.error(
        `${logPrefix(Env.STG)} Offer recovery failed, ${err.message}`,
        rbErr,
      );
    }
  }
  return null;
};

const createCampaignRetentionOfferValidateGl = async (
  campaignId: string,
  errorMessages: AppError[],
  data: RetentionOfferCreationData,
  createdBy: string,
  updatedBy: string,
): Promise<void> => {
  const offerModel = data.offerModel;
  const offer = data.offer;
  const regionPrefix = data.regionPrefix;
  try {
    // 3. clear PlayAuth cache
    updateSpinnerText(`${regionPrefix}Clearing PlayAuth cache...`);
    await PlayAuth.clearOfferCache(offerModel.Store, Env.STG, GLSet.RET_RECURLY_V2);

    // 4. Validate GhostLocker (via PlayAuth)
    updateSpinnerText(`${regionPrefix}Validating GhostLocker...`);
    await PlayAuth.validateGl(
      offerModel.Store.regionCode,
      getFlexSiteUrl(Env.STG, offerModel.Store.regionCode),
      Env.STG,
      offer.offerCode,
      undefined,
      OfferTypes.RETENTION,
    );

    offerModel.draftData = JSON.parse(JSON.stringify(offer));
    const newOffer = await updateRetentionOfferStatus(
      offerModel,
      StatusEnum.STG,
    );
    // save offer in offers history
    const offerHistory = await createOfferHistoryInDb(
      newOffer,
      createdBy,
      updatedBy,
    );
    updateSpinnerText(`${regionPrefix}Offer created successfully`);
  } catch (err) {
    updateSpinnerText(
      `${regionPrefix}Create offer failed, performing rollback...`,
    );
    try {
      if (!DISABLE_ROLLBACK) {
        await rollbackRetentionCampaignOffer(
          err,
          offerModel,
          Env.STG,
          true,
          true,
          true,
          updatedBy,
        );
      }
      setOfferModelDraftDataErrMessage(offerModel, err.message);
      await updateRetentionOfferStatus(offerModel, StatusEnum.STG_FAIL);
      const appErr = processCampaignError(campaignId, err);
      appErr.message = `${regionPrefix}${appErr.message}`;
      errorMessages.push(appErr);
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    } catch (rbErr) {
      logger.error(
        `${logPrefix(Env.STG)} Offer recovery failed, ${err.message}`,
        rbErr,
      );
    }
  }
};

export const createCampaignRetentionOffer = async (
  campaignId: string,
  errorMessages: AppError[],
  offer: RetentionOfferResponsePayload,
  createdBy: string,
  updatedBy: string,
): Promise<void> => {
  let data = await createCampaignRetentionOfferExternal(
    campaignId,
    errorMessages,
    offer,
    updatedBy,
  );
  if (data) {
    data = await createCampaignRetentionOfferUpdateGl(
      campaignId,
      errorMessages,
      data,
      updatedBy,
    );
  }
  if (data) {
    await createCampaignRetentionOfferValidateGl(
      campaignId,
      errorMessages,
      data,
      createdBy,
      updatedBy,
    );
  }
};

/**
 * POST /api/offers/campaign/create
 * Create a new campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const createNewCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - createNewOffer');

    const createdBy = req.body.updatedBy;
    const updatedBy = req.body.updatedBy;
    if ((req.body as OfferDbPayload).offerTypeId == OfferTypes.RETENTION) {
      return createNewRetentionCampaign(req, res, next);
    }
    updateSpinnerText('Creating campaign...');
    const campaignPayload = req.body as CampaignPayload;
    const campaignId = await uniqueCampaignId(
      campaignPayload.regions[0].offerCode,
    );
    if (!campaignPayload.campaign) {
      campaignPayload.campaign = campaignId;
    }

    const offers = await convertFromCampaign(campaignPayload, true);
    httpContext.set('env', Env.STG);

    const errorMessages: AppError[] = [];
    try {
      await convertOrUpdateCampaignInDb(campaignPayload);
      // create offer in STG
      const allPromises: Promise<OfferCreationData>[] = [];
      for (const offer of offers) {
        allPromises.push(
          createCampaignOfferExternal(
            campaignId,
            errorMessages,
            offer,
            updatedBy,
          ),
        );
      }

      const creationData = await Promise.all(allPromises);
      const validationData: OfferCreationData[] = [];
      for (const data of creationData) {
        if (data) {
          const valid = await createCampaignOfferUpdateGl(
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
          createCampaignOfferValidateGl(
            campaignId,
            errorMessages,
            data,
            createdBy,
            updatedBy,
          ),
        ),
      );

      updateSpinnerText('Clearing Contentful cache, this may take a while...');
      await CmsApi.clearCmsApiCache(Env.STG);

      if (errorMessages.length) {
        const statusCode = errorMessages[0].statusCode;
        const messages = errorMessages.map((m) => m.message).join('\n');
        return next(
          processCampaignError(campaignId, new AppError(messages, statusCode)),
        );
      }
      retWithSuccess(req, res, {
        message: `Campaign (${
          campaignPayload.campaignName
        }) created successfully on ${Env.STG.toUpperCase()}`,
        status: 201,
        data: {
          campaign: campaignId,
        },
      });
    } catch (err) {
      logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
      return next(processCampaignError(campaignId, err));
    }
  },
);

export const createNewRetentionCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  updateSpinnerText('Creating campaign...');
  const campaignPayload = req.body as CampaignPayload;
  const campaignId = await uniqueCampaignId(
    campaignPayload.regions[0].offerCode,
  );
  if (!campaignPayload.campaign) {
    campaignPayload.campaign = campaignId;
  }

  const offers = await retentionConvertFromCampaign(campaignPayload, true);
  httpContext.set('env', Env.STG);
  const createdBy = req.body.updatedBy;
  const updatedBy = req.body.updatedBy;

  const errorMessages: AppError[] = [];
  try {
    await convertOrUpdateCampaignInDb(campaignPayload);
    // create offer in STG
    const allPromises: Promise<RetentionOfferCreationData>[] = [];
    for (const offer of offers) {
      allPromises.push(
        createCampaignRetentionOfferExternal(
          campaignId,
          errorMessages,
          offer,
          updatedBy,
        ),
      );
    }

    const creationData = await Promise.all(allPromises);
    const validationData: RetentionOfferCreationData[] = [];
    for (const data of creationData) {
      if (data) {
        const valid = await createCampaignRetentionOfferUpdateGl(
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
        createCampaignRetentionOfferValidateGl(
          campaignId,
          errorMessages,
          data,
          createdBy,
          updatedBy,
        ),
      ),
    );

    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.STG);

    if (errorMessages.length) {
      const statusCode = errorMessages[0].statusCode;
      const messages = errorMessages.map((m) => m.message).join('\n');
      return next(
        processCampaignError(campaignId, new AppError(messages, statusCode)),
      );
    }
    retWithSuccess(req, res, {
      message: `Campaign (${
        campaignPayload.campaignName
      }) created successfully on ${Env.STG.toUpperCase()}`,
      status: 201,
      data: {
        campaign: campaignId,
      },
    });
  } catch (err) {
    logger.error(`${logPrefix(Env.STG)} ${err.message}`, err);
    return next(processCampaignError(campaignId, err));
  }
};
