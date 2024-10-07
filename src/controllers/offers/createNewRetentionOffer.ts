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
  getRetentionOfferModel,
  getFlexSiteUrl,
  getStoreModel,
  pRetryOptions,
  processOfferError,
  retrieveRecurlyPlan,
  updateRetentionOfferDbProperties,
  updateRetentionOfferStatus,
  updateSpinnerText,
} from '../../util/utils';
import { RetentionOffer } from '../../models';
import { retWithSuccess } from '../../models/SamocResponse';
import { Env, OfferTypes, StatusEnum } from '../../types/enum';
import {
  OfferContentfulPayload,
  PlanRecurlyPayload,
  RetentionOfferContentfulPayload,
  RetentionOfferDbPayload,
  RetentionOfferRecurlyPayload,
} from '../../types/payload';
import pRetry from 'p-retry';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as PlayAuth from '../../services/PlayAuth';
import * as GhostLocker from '../../services/GhostLocker';
import { GLSet } from '../../services/GhostLocker';
import * as CmsApi from '../../services/CmsApi';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../../util/config';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { uniqueCampaignId } from './campaign/utils';
import { createOfferHistoryInDb } from './offerHistory';
import { setOfferModelDraftDataErrMessage } from '.';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Create Offer Controller:`;
  } else {
    return `Create Offer Controller:`;
  }
};

/**
 * Create a new retention offer
 * @param {Request}     req
 * @param {Response}    res
 * @param next
 */
export const createNewRetentionOffer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  updateSpinnerText('Creating offer...');
  let offerModel: RetentionOfferModel;
  const dbPayload = req.body as RetentionOfferDbPayload;
  const updatedBy = req.body.updatedBy as string;
  try {
    // create offer in STG
    const contentfulPayload = req.body as RetentionOfferContentfulPayload;
    const recurlyPayload = req.body as RetentionOfferRecurlyPayload;

    const useUpgradePlan = req.body.useUpgradePlan as boolean;

    httpContext.set('offerCode', dbPayload.offerCode);
    httpContext.set('storeCode', dbPayload.storeCode);
    httpContext.set('env', Env.STG);

    const storeModel = await getStoreModel(dbPayload.storeCode);
    offerModel = await getRetentionOfferModel(
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
      offerModel = updateRetentionOfferDbProperties(offerModel, dbPayload);
    } else {
      try {
        offerModel = await createRetentionOfferInDb(dbPayload, StatusEnum.STG);
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
      offerModel.Store = await getStoreModel(dbPayload.storeCode);
    }

    // check if the plan exists in Recurly stg
    updateSpinnerText('Creating Recurly coupon...');

    const eligiblePlans: PlanRecurlyPayload[] = [];
    for (const planCode of recurlyPayload.eligiblePlans) {
      const plan = await retrieveRecurlyPlan(planCode, storeModel, Env.STG);
      eligiblePlans.push(plan);
    }

    const upgradePlan: PlanRecurlyPayload[] = [];
    if (useUpgradePlan) {
      const plan = await retrieveRecurlyPlan(
        recurlyPayload.upgradePlan,
        storeModel,
        Env.STG,
      );
      upgradePlan.push(plan);
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
    if (dbPayload.upgradePlan) {
      updateSpinnerText('Creating Recurly upgrade coupon...');
      const upgradeCouponId = await Recurly.createRetentionCoupon(
        recurlyPayload,
        useUpgradePlan ? upgradePlan : eligiblePlans,
        true,
        storeModel,
        Env.STG,
        useUpgradePlan ? recurlyPayload.upgradePlan : null,
      );
      offerModel.set('upgradeCouponId', upgradeCouponId);
    }

    // 2. publish to GhostLocker
    // offerModel.glConfigVersion = null;
    updateSpinnerText('Updating GhostLocker config...');
    const response = await GhostLocker.updateRetentionOfferConfig(
      [],
      dbPayload.offerCode,
      dbPayload.upgradePlan,
      false,
      dbPayload.usersOnPlans,
      storeModel.regionCode,
      false,
      Env.STG,
    );
    // save the rollback config version to model
    offerModel.glRollbackVersion = response.configurationVersion - 1;

    // 3. clear PlayAuth cache
    updateSpinnerText('Clearing PlayAuth cache...');
    await PlayAuth.clearOfferCache(storeModel, Env.STG, GLSet.RET_RECURLY_V2);

    // 4. Validate GhostLocker (via PlayAuth)
    updateSpinnerText('Validating GhostLocker...');
    await PlayAuth.validateGl(
      storeModel.regionCode,
      getFlexSiteUrl(Env.STG, storeModel.regionCode),
      Env.STG,
      dbPayload.offerCode,
      undefined,
      OfferTypes.RETENTION,
    );

    // 5. publish to Contentful
    updateSpinnerText('Processing Contentful entry...');
    await Contentful.createRetentionSpecialOffer(
      contentfulPayload,
      eligiblePlans[0],
      storeModel.regionCode,
      Env.STG,
      !!dbPayload.upgradePlan,
    );

    // 6. Remove Cache
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.STG);

    // 7. update offer status in DB
    offerModel.draftData = req.body;
    if (req.body.offerBoldedText === '') {
      (offerModel.draftData as any).offerBoldedText = Contentful.getFormattedTotal(
        req.body as OfferContentfulPayload,
        eligiblePlans[0],
      )
        .replace('<span>', '')
        .replace('</span>', '');
    }
    const newOffer = await updateRetentionOfferStatus(
      offerModel,
      StatusEnum.STG,
    );
    updateSpinnerText('Offer created successfully');

    // 8. save offer in offers history
    const createdBy = req.body.updatedBy;
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
      await rollbackRetentionOfferOnCreate(err, offerModel, updatedBy);
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
    await updateRetentionOfferStatus(offerModel, status);
    return next(processOfferError(err));
  }
};

export const createRetentionOfferInDb = async (
  payload: RetentionOfferDbPayload,
  statusId: StatusEnum,
): Promise<RetentionOfferModel> => {
  let result: RetentionOfferModel = null;
  const switchToPlan = payload.upgradePlan;
  if (payload.usersOnPlans) {
    payload.usersOnPlans = payload.usersOnPlans.filter((val) => val !== '-');
  }
  if (!payload.campaign) {
    payload.campaign = await uniqueCampaignId(payload.offerCode);
    payload.campaignName = '';
  }
  const dbOfferOp = async () => {
    const commonPayload = {
      offerCode: payload.offerCode,
      storeCode: payload.storeCode,
      campaign: payload.campaign,
      campaignName: '',
      statusId: statusId,
      eligiblePlans: payload.eligiblePlans.join(','),
    } as any;
    if (switchToPlan) {
      commonPayload.upgradeOfferCode = `${payload.offerCode}_upgrade`;
      commonPayload.usersOnPlans = payload.usersOnPlans
        ? payload.usersOnPlans.join(',')
        : null;
    }
    if (statusId === StatusEnum.DFT) {
      const draftPayload = {
        ...commonPayload,
        draftData: payload,
        isCouponless: false,
      } as any;
      result = await RetentionOffer.create(draftPayload);
    } else {
      result = await RetentionOffer.build({
        ...commonPayload,
        draftData: null, // clear previously saved data
        businessOwner: payload.offerBusinessOwner,
        switchToPlan: switchToPlan ?? null,
        isCouponless: payload.isCouponless ?? false,
        // onTime is currently not used in Phase 2
        // onTime: new Date(payload.publishDateTime),
      });
    }
  };
  // setup retry mechanism
  await pRetry(dbOfferOp, pRetryOptions);
  return result;
};

const isStatusAllowed = (status: StatusEnum): boolean => {
  const allowableStatus = [
    StatusEnum.DFT,
    StatusEnum.STG_ERR_CRT,
    StatusEnum.STG_FAIL,
  ];
  return allowableStatus.includes(status);
};

export const rollbackRetentionOfferOnCreate = async (
  err: AppError,
  offer: RetentionOfferModel,
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
        await Contentful.archiveRetentionSpecialOffer(offer);
      }
      if (!(err instanceof GhostLockerError)) {
        // rollback GL and expire recurly coupon
        await GhostLocker.rollbackToVersion(
          GLSet.RET_RECURLY_V2,
          offer.offerCode,
          offer.glRollbackVersion,
          Env.STG,
        );
      }
      await Recurly.deactivateCoupon(
        offer,
        offer.offerCode,
        offer.Store,
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
    await updateRetentionOfferStatus(offer, StatusEnum.STG_RB_FAIL);
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
