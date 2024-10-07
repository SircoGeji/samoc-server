import { NextFunction, Request, Response } from 'express';
import Logger from '../../../util/logger';
import {
  AppError,
  PreUpdateRemoteError,
  RecurlyError,
} from '../../../util/errorHandler';
import {
  getExtensionOfferModel,
  getStoreModel,
  pRetryOptions,
  processOfferError,
  retrieveRecurlyPlan,
  updateExtensionOfferDbProperties,
  updateExtensionOfferStatus,
  updateSpinnerText,
} from '../../../util/utils';
import { ExtensionOffer } from '../../../models';
import { retWithSuccess } from '../../../models/SamocResponse';
import { Env, StatusEnum } from '../../../types/enum';
import {
  PlanRecurlyPayload,
  ExtensionOfferContentfulPayload,
  ExtensionOfferDbPayload,
  ExtensionOfferRecurlyPayload,
} from '../../../types/payload';
import pRetry from 'p-retry';
import * as Recurly from '../../../services/Recurly';
import * as Contentful from '../../../services/Contentful';
import * as CmsApi from '../../../services/CmsApi';
import * as httpContext from 'express-http-context';
import { ExtensionOfferModel } from '../../../models/web/ExtensionOffer';
import { createOfferHistoryInDb } from '../offerHistory';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Create Offer Controller:`;
  } else {
    return `Create Offer Controller:`;
  }
};

/**
 * Create a new extension offer
 * @param {Request}     req
 * @param {Response}    res
 * @param next
 */
export const createNewExtensionOffer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  updateSpinnerText('Creating offer...');
  let offerModel: ExtensionOfferModel;
  const dbPayload = req.body;
  try {
    // create offer in STG
    const contentfulPayload = dbPayload as ExtensionOfferContentfulPayload;
    const recurlyPayload = dbPayload as ExtensionOfferRecurlyPayload;

    const useUpgradePlan = dbPayload.useUpgradePlan as boolean;

    httpContext.set('offerCode', dbPayload.offerCode);
    httpContext.set('storeCode', dbPayload.storeCode);
    httpContext.set('env', Env.STG);

    const storeModel = await getStoreModel(dbPayload.storeCode);
    offerModel = await getExtensionOfferModel(
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
      offerModel = updateExtensionOfferDbProperties(offerModel, dbPayload);
    } else {
      try {
        offerModel = await createExtensionOfferInDb(dbPayload, StatusEnum.STG);
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

    const eligibleCharges: PlanRecurlyPayload[] = [];
    for (const planCode of recurlyPayload.eligibleCharges) {
      const plan = await retrieveRecurlyPlan(planCode, storeModel, Env.STG);
      eligibleCharges.push(plan);
    }

    const upgradePlan: PlanRecurlyPayload[] = [];
    if (useUpgradePlan) {
      const plan = await retrieveRecurlyPlan(
        offerModel.switchToPlan,
        storeModel,
        Env.STG,
      );
      upgradePlan.push(plan);
    }

    // 1. create coupon on Recurly
    const couponId = await Recurly.createExtensionCoupon(
      recurlyPayload,
      eligibleCharges,
      false,
      storeModel,
      Env.STG,
    );
    offerModel.set('couponId', couponId);

    // 1. create upgrade coupon on Recurly
    if (!!dbPayload.createUpgradeOffer) {
      updateSpinnerText('Creating Recurly upgrade coupon...');
      const upgradeCouponId = await Recurly.createExtensionCoupon(
        recurlyPayload,
        upgradePlan,
        true,
        storeModel,
        Env.STG,
        offerModel.switchToPlan,
      );
      offerModel.set('upgradeCouponId', upgradeCouponId);
    }

    // 5. publish to Contentful
    updateSpinnerText('Processing Contentful entry...');
    await Contentful.createExtensionSpecialOffer(
      contentfulPayload,
      eligibleCharges[0],
      storeModel.regionCode,
      Env.STG,
      !!dbPayload.createUpgradeOffer,
    );

    // 6. Remove Cache
    updateSpinnerText('Clearing Contentful cache, this may take a while...');
    await CmsApi.clearCmsApiCache(Env.STG);

    // 7. update offer status in DB
    const newOffer = await updateExtensionOfferStatus(
      offerModel,
      StatusEnum.STG,
    );
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
    // update status if rollback succeed
    let status;
    if (err instanceof PreUpdateRemoteError || err instanceof RecurlyError) {
      status = StatusEnum.STG_ERR_CRT;
    } else {
      status = StatusEnum.STG_FAIL;
    }
    await updateExtensionOfferStatus(offerModel, status);
    return next(processOfferError(err));
  }
};

export const createExtensionOfferInDb = async (
  payload: any,
  statusId: StatusEnum,
): Promise<ExtensionOfferModel> => {
  let result: ExtensionOfferModel = null;
  const switchToPlan = !!payload.upgradePlan;
  if (!!payload.usersOnPlans && !!payload.usersOnPlans.length) {
    const usersOnPlansArr = payload.usersOnPlans.filter(
      (elem: string) => elem !== '-',
    );
    payload.usersOnPlans = !!usersOnPlansArr.length
      ? usersOnPlansArr.join(',')
      : null;
  } else {
    payload.usersOnPlans = null;
  }
  const dbOfferOp = async () => {
    const dbPayload = {
      offerCode: payload.offerCode,
      storeCode: payload.storeCode,
      statusId: statusId,
      eligibleCharges: payload.eligibleCharges.join(','),
      durationType: payload.durationType,
      durationAmount: payload.durationAmount,
      durationUnit: payload.durationUnit,
      discountAmount: payload.discountAmount,
      offerTitle: payload.offerTitle,
      offerDescription: payload.offerDescription,
      offerTerms: payload.offerTerms,
      bannerText: payload.bannerText,
      offerBusinessOwner: payload.offerBusinessOwner,
      draftData: { ...payload },
    } as any;
    if (!!switchToPlan) {
      dbPayload.upgradeOfferCode = `${payload.offerCode}_upgrade`;
      dbPayload.usersOnPlans = payload.usersOnPlans;
      dbPayload.switchToPlan = payload.upgradePlan;
    }
    if (statusId === StatusEnum.DFT) {
      result = await ExtensionOffer.create(dbPayload);
    } else {
      result = await ExtensionOffer.build({
        ...dbPayload,
        switchToPlan: payload.upgradePlan ?? null,
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
