import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Store } from '../../models';
import { CodeType, Env, OfferTypes, StatusEnum } from '../../types/enum';
import { retWithSuccess } from '../../models/SamocResponse';
import { AppError } from '../../util/errorHandler';
import Logger from '../../util/logger';
import {
  addExtraCodes,
  checkOfferInWorkflowQueue,
  generateOfferUrl,
  getExtensionOfferModel,
  getOfferModel,
  getPlanModel,
  getRegionDefaultLang,
  getRetentionOfferModel,
  getStoreModel,
  processOfferError,
  updateSpinnerText,
} from '../../util/utils';
import * as Recurly from '../../services/Recurly';
import * as Contentful from '../../services/Contentful';
import * as GhostLocker from '../../services/GhostLocker';
import { createOfferInDb } from './createNewOffer';
import {
  ExtensionOfferDbPayload,
  OfferDbPayload,
  PlanRecurlyPayload,
  RetentionOfferDbPayload,
} from 'src/types/payload';
import { createRetentionOfferInDb } from './createNewRetentionOffer';
import { createOfferHistoryInDb } from './offerHistory';
import {
  getCsvFileNameIfExists,
  getDiscountAmount,
  getOfferResponsePayload,
  getRetentionOfferResponsePayload,
} from '.';
import { createExtensionOfferInDb } from './extension/createNewExtensionOffer';

const logger = Logger(module);

/**
 * POST /api/offers/synchronize-offer
 * Save the offer model by offerType, offerCode, storeCode and service data
 * @param {Request}     req
 * @param {Response}    res
 */
export const synchronizeOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - synchronizeOffer');
    const {
      offerType,
      offerCode,
      storeCode,
      offerBusinessOwner,
      updatedBy,
    } = req.body;
    if (!offerType || !offerCode || !storeCode || !offerBusinessOwner) {
      throw new AppError(
        `OfferType, offerCode, storeCode and offerBusinessOwner are required in the body of the request`,
        400,
      );
    }
    // search for Store model by storeCode
    const storeModel = await Store.findByPk(storeCode);
    if (!storeModel) {
      throw new AppError(`Store model not found`, 404);
    }

    const isOfferRetentionOrExtension =
      offerType === OfferTypes.RETENTION || offerType === OfferTypes.EXTENSION;

    // check if offer with the same offerCode already exists in DB
    let offerModel;
    switch (offerType) {
      case OfferTypes.ACQUISITION:
      case OfferTypes.WINBACK:
        offerModel = await getOfferModel(storeModel.storeCode, offerCode);
        break;
      case OfferTypes.RETENTION:
        offerModel = await getRetentionOfferModel(
          storeModel.storeCode,
          offerCode,
        );
        break;
      case OfferTypes.EXTENSION:
        offerModel = await getExtensionOfferModel(
          storeModel.storeCode,
          offerCode,
        );
        break;
    }
    if (offerModel) {
      throw new AppError(`Offer model is available in DB`, 400);
    }

    // search service data by offerCode
    try {
      const targetEnvs = [Env.STG, Env.PROD];
      const prefix = storeModel.regionCode.toUpperCase() + ': ';
      // Step 1) Find offer in Recurly
      let searchEnv;
      let recurlyCouponResult;
      for (let targetEnv of targetEnvs) {
        const recurlyResult = await recurlyCouponPayload(
          offerType,
          prefix,
          offerCode,
          storeModel,
          targetEnv,
        );
        if (recurlyResult) {
          searchEnv = targetEnv;
          recurlyCouponResult = recurlyResult;
        } else if (!recurlyResult && targetEnv === Env.STG) {
          throw new AppError(
            `Recurly: Coupon not found on ${targetEnv.toUpperCase()}`,
            404,
          );
        }
        if (isOfferRetentionOrExtension) {
          const upgradeRecurlyResult = await recurlyCouponPayload(
            offerType,
            prefix,
            offerCode + '_upgrade',
            storeModel,
            targetEnv,
          );
          if (upgradeRecurlyResult) {
            recurlyCouponResult = {
              ...recurlyCouponResult,
              upgradeRecurlyResult,
            };
          }
        }
      }
      // Step 2) Find offer in Contentful
      const contentfulResult = await contentfulPayload(
        prefix,
        storeModel,
        offerCode,
        isOfferRetentionOrExtension,
      );
      // Step 3) Find offerCode in GhostLocker
      let ghostLockerResult = null;
      if (offerType !== OfferTypes.EXTENSION) {
        ghostLockerResult = await ghostLockerPayload(
          prefix,
          offerType,
          offerCode,
          storeModel,
          searchEnv,
        );
        if (offerType === OfferTypes.RETENTION) {
          const upgradeGhostLockerResult = await ghostLockerPayload(
            prefix,
            offerType,
            offerCode + '_upgrade',
            storeModel,
            searchEnv,
          );
          if (upgradeGhostLockerResult) {
            ghostLockerResult = {
              ...ghostLockerResult,
              upgradeGhostLockerResult,
            };
          }
        }
      }

      if (
        offerType !== OfferTypes.RETENTION &&
        !!ghostLockerResult &&
        !ghostLockerResult.found
      ) {
        throw new AppError(`GhostLocker: config not found`, 404);
      }

      if (
        (offerType === OfferTypes.WINBACK &&
          ghostLockerResult.found &&
          ghostLockerResult.found.isForNewUser === true) ||
        (offerType === OfferTypes.ACQUISITION &&
          ghostLockerResult.found &&
          ghostLockerResult.found.isForNewUser === false)
      ) {
        throw new AppError(`Wrong offer type for such offerCode`, 400);
      }

      const statusId =
        searchEnv === Env.PROD ? StatusEnum.PROD : StatusEnum.STG;
      let offerModelResult;
      let data = null;
      switch (offerType) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          offerModelResult = await createOfferModel(
            statusId,
            offerType,
            recurlyCouponResult,
            contentfulResult,
            ghostLockerResult,
            offerBusinessOwner,
            updatedBy,
            searchEnv,
          );
          break;
        case OfferTypes.RETENTION:
          offerModelResult = await createRetentionOfferModel(
            statusId,
            recurlyCouponResult,
            contentfulResult,
            ghostLockerResult,
            offerBusinessOwner,
            updatedBy,
            searchEnv,
          );
          break;
        case OfferTypes.EXTENSION: 
          offerModelResult = await createExtensionOfferModel(
            statusId,
            recurlyCouponResult,
            contentfulResult,
            offerBusinessOwner,
            updatedBy,
            searchEnv,
          );
          break;
      }

      if (!offerModelResult) {
        throw new AppError(`Failed to create offer model in DB`, 400);
      }

      retWithSuccess(req, res, {
        message: `Offer (${offerCode}) synchronized successfully`,
        data: offerModelResult,
      });
    } catch (err) {
      logger.error(
        `Offer (${offerCode}) synchronization failed: ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

const recurlyCouponPayload = async (
  offerType: number,
  prefix: string,
  offerCode: string,
  store: any,
  targetEnv: Env,
) => {
  updateSpinnerText(prefix + 'Performing Recurly data search...');
  switch (offerType) {
    case OfferTypes.ACQUISITION:
    case OfferTypes.WINBACK:
      return await Recurly.getOfferRecurlyPayload(
        offerCode,
        store,
        targetEnv,
        true,
        true,
      );
    case OfferTypes.RETENTION:
      return await Recurly.getRetentionOfferRecurlyPayload(
        offerCode,
        store,
        targetEnv,
        null,
        true,
        true,
      );
    case OfferTypes.EXTENSION:
      return await Recurly.getExtensionOfferRecurlyPayload(
        offerCode,
        store,
        targetEnv,
        null,
        true,
        true,
      );
  }
};

const contentfulPayload = async (
  prefix: string,
  store: any,
  offerCode: string,
  ignoreImage: boolean,
) => {
  updateSpinnerText(prefix + 'Performing Contentful data search...');
  return await Contentful.fetchSpecialOffer(
    store.regionCode,
    offerCode,
    store.storeCode,
    ignoreImage,
  );
};

const ghostLockerPayload = async (
  prefix: string,
  offerType: number,
  offerCode: string,
  store: any,
  targetEnv: Env,
) => {
  updateSpinnerText(prefix + 'Performing GhostLocker data search...');
  switch (offerType) {
    case OfferTypes.ACQUISITION:
    case OfferTypes.WINBACK:
      return await GhostLocker.promoOfferExists(
        offerCode,
        store.regionCode,
        targetEnv,
        null,
        true,
      );
    case OfferTypes.RETENTION:
      return await GhostLocker.retentionOfferExists(
        offerCode,
        store.regionCode,
        targetEnv,
        null,
        true,
      );
  }
};

const createOfferModel = async (
  statusId: number,
  offerTypeId: number,
  recurlyCouponResult: any,
  contentfulResult: any,
  ghostLockerResult: any,
  offerBusinessOwner: string,
  updatedBy: string,
  searchEnv: string,
) => {
  const payload: OfferDbPayload = {
    offerCode: recurlyCouponResult.offerCode,
    storeCode: recurlyCouponResult.storeCode,
    campaign: null,
    campaignName: null,
    offerTypeId,
    planCode: recurlyCouponResult.planCode,
    offerCTA: null,
    offerBusinessOwner,
    totalUniqueCodes: recurlyCouponResult.totalUniqueCodes,
    dataIntegrityStatus: null,
    dataIntegrityCheckTime: null,
    dataIntegrityErrorMessage: null,
  };
  let offerResult: any = await createOfferInDb(payload, statusId);
  if (offerResult) {
    offerResult.set('couponId', recurlyCouponResult.coupon.id);
    offerResult.set('statusId', statusId);
    offerResult.set(
      'glRollbackVersion',
      ghostLockerResult.config.configurationVersion - 1,
    );
    const planObj = await getPlanModel(
      recurlyCouponResult.eligiblePlanCodes[0],
    );
    const storeObj = await getStoreModel(recurlyCouponResult.storeCode);
    offerResult.set(
      'draftData',
      await getOfferDraftData(
        { ...offerResult.dataValues, Plan: planObj, Store: storeObj },
        recurlyCouponResult,
        contentfulResult,
        offerBusinessOwner,
        searchEnv,
      ),
    );
    await offerResult.save();

    // save offer in offers history
    const createdBy =
      offerResult.statusId === StatusEnum.STG ? updatedBy : null;
    const offerHistory = await createOfferHistoryInDb(
      offerResult,
      createdBy,
      updatedBy,
    );
  }
  return offerResult;
};

const createRetentionOfferModel = async (
  statusId: number,
  recurlyCouponResult: any,
  contentfulResult: any,
  ghostLockerResult: any,
  offerBusinessOwner: string,
  updatedBy: string,
  searchEnv: string,
) => {
  const payload: RetentionOfferDbPayload = {
    offerCode: recurlyCouponResult.offerCode,
    storeCode: recurlyCouponResult.storeCode,
    campaign: null,
    campaignName: null,
    eligiblePlans: recurlyCouponResult.eligiblePlans,
    upgradePlan:
      ghostLockerResult.upgradeGhostLockerResult &&
      ghostLockerResult.upgradeGhostLockerResult.found
        ? ghostLockerResult.upgradeGhostLockerResult.found.forceUserToPlanCode
        : null,
    isCouponless: false,
    usersOnPlans:
      ghostLockerResult.upgradeGhostLockerResult &&
      ghostLockerResult.upgradeGhostLockerResult.found
        ? ghostLockerResult.upgradeGhostLockerResult.found.appliesToUsersOnPlans
          ? ghostLockerResult.upgradeGhostLockerResult.found
              .appliesToUsersOnPlans
          : ['-']
        : null,
    offerBusinessOwner,
  };
  let retentionOfferResult: any = await createRetentionOfferInDb(
    payload,
    statusId,
  );
  if (retentionOfferResult) {
    retentionOfferResult.set('couponId', recurlyCouponResult.coupon.id);
    retentionOfferResult.set(
      'upgradeCouponId',
      recurlyCouponResult.upgradeRecurlyResult
        ? recurlyCouponResult.upgradeRecurlyResult.coupon.id
        : null,
    );
    retentionOfferResult.set(
      'upgradeOfferCode',
      recurlyCouponResult.upgradeRecurlyResult
        ? recurlyCouponResult.upgradeRecurlyResult.offerCode
        : null,
    );
    retentionOfferResult.set('statusId', statusId);
    retentionOfferResult.set(
      'glRollbackVersion',
      ghostLockerResult.config.configurationVersion - 1,
    );
    const storeObj = await getStoreModel(recurlyCouponResult.storeCode);
    retentionOfferResult.set(
      'draftData',
      await getRetentionOfferDraftData(
        { ...retentionOfferResult.dataValues, Store: storeObj },
        recurlyCouponResult,
        contentfulResult,
        offerBusinessOwner,
        searchEnv,
      ),
    );
    await retentionOfferResult.save();

    // save offer in offers history
    const createdBy =
      retentionOfferResult.statusId === StatusEnum.STG ? updatedBy : null;
    const offerHistory = await createOfferHistoryInDb(
      retentionOfferResult,
      createdBy,
      updatedBy,
    );
  }
  return retentionOfferResult;
};

const createExtensionOfferModel = async (
  statusId: number,
  recurlyCouponResult: any,
  contentfulResult: any,
  offerBusinessOwner: string,
  updatedBy: string,
  searchEnv: string,
) => {
  const storeObj = await getStoreModel(recurlyCouponResult.storeCode);
  const recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
    recurlyCouponResult.eligibleCharges[0],
    storeObj,
    searchEnv as Env,
  );
  const payload: ExtensionOfferDbPayload = {
    offerCode: recurlyCouponResult.offerCode,
    storeCode: recurlyCouponResult.storeCode,
    eligibleCharges: recurlyCouponResult.eligibleCharges,
    upgradePlan: recurlyCouponResult.upgradeRecurlyResult
      ? recurlyCouponResult.upgradeRecurlyResult.eligibleCharges[0]
      : null,
    usersOnPlans: ['-'],
    statusId,
    createdBy: updatedBy,
    discountAmount: getDiscountAmount(recurlyPlanPayload, recurlyCouponResult),
    durationType: recurlyCouponResult.durationType,
    durationAmount: recurlyCouponResult.durationAmount,
    durationUnit: recurlyCouponResult.durationUnit,
    offerTitle: contentfulResult.offerHeader,
    offerDescription: contentfulResult.offerBodyText,
    offerTerms: contentfulResult.legalDisclaimer,
    offerBusinessOwner,
    bannerText: contentfulResult.offerAppliedBannerText,
  };
  let extensionOfferResult: any = await createExtensionOfferInDb(
    payload,
    statusId,
  );
  if (extensionOfferResult) {
    extensionOfferResult.set('couponId', recurlyCouponResult.coupon.id);
    extensionOfferResult.set(
      'upgradeCouponId',
      recurlyCouponResult.upgradeRecurlyResult
        ? recurlyCouponResult.upgradeRecurlyResult.coupon.id
        : null,
    );
    extensionOfferResult.set(
      'upgradeOfferCode',
      recurlyCouponResult.upgradeRecurlyResult
        ? recurlyCouponResult.upgradeRecurlyResult.offerCode
        : null,
    );
    extensionOfferResult.set('statusId', statusId);
    extensionOfferResult.set(
      'draftData',
      await getExtensionOfferDraftData(
        { ...extensionOfferResult.dataValues, Store: storeObj },
        recurlyPlanPayload,
        recurlyCouponResult,
        contentfulResult,
        offerBusinessOwner,
        searchEnv,
      ),
    );
    await extensionOfferResult.save();

    // save offer in offers history
    const createdBy =
      extensionOfferResult.statusId === StatusEnum.STG ? updatedBy : null;
    const offerHistory = await createOfferHistoryInDb(
      extensionOfferResult,
      createdBy,
      updatedBy,
    );
  }
  return extensionOfferResult;
};

const getOfferDraftData = async (
  model: any,
  recurlyCouponResult: any,
  contentfulResult: any,
  offerBusinessOwner: string,
  searchEnv: string,
): Promise<any> => {
  const recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
    recurlyCouponResult.eligiblePlanCodes[0],
    model.Plan.Store,
    searchEnv as Env,
  );
  const languageCode = await getRegionDefaultLang(model.Store.regionCode);
  const result = {
    origTotalUniqueCodes: !!recurlyCouponResult
      ? recurlyCouponResult.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
        recurlyCouponResult.totalUniqueCodes
        ? addExtraCodes(recurlyCouponResult.totalUniqueCodes)
        : null
      : null,
    couponCreatedAt: recurlyCouponResult.couponCreatedAt,
    offerBgImageUrl: contentfulResult.offerBgImageUrl,
    noEndDate: recurlyCouponResult.noEndDate,
    offerCode: recurlyCouponResult.offerCode,
    offerName: recurlyCouponResult.offerName,
    storeCode: contentfulResult.storeCode,
    offerHeader: contentfulResult.offerHeader,
    discountType: recurlyCouponResult.discountType,
    planCode: recurlyCouponResult.eligiblePlanCodes[0],
    offerBodyText: contentfulResult.offerBodyText,
    offerCodeType: recurlyCouponResult.coupon.couponType,
    legalDisclaimer: contentfulResult.legalDisclaimer,
    localized: contentfulResult.localized,
    offerBoldedText: contentfulResult.offerBoldedText,
    welcomeEmailText: recurlyCouponResult.welcomeEmailText,
    offerBusinessOwner,
    discountDurationType: recurlyCouponResult.discountDurationType,
    discountDurationUnit: recurlyCouponResult.discountDurationUnit,
    discountDurationValue: recurlyCouponResult.discountDurationValue,
    offerAppliedBannerText: contentfulResult.offerAppliedBannerText,
    discountAmount: getDiscountAmount(recurlyPlanPayload, recurlyCouponResult),
    isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
    csvFileName: getCsvFileNameIfExists(
      model.storeCode,
      model.offerCode,
      !!recurlyCouponResult ? recurlyCouponResult.offerCodeType : null,
      searchEnv as Env,
    ),
    offerUrl: generateOfferUrl(
      model,
      !!recurlyCouponResult ? recurlyCouponResult.offerCodeType : null,
      languageCode,
    ),
    glValidationError: await GhostLocker.validateSingleGlPromotionOffer(
      model,
      model.Plan.Store.regionCode,
    ),
  };
  return result;
};

const getRetentionOfferDraftData = async (
  model: any,
  recurlyCouponResult: any,
  contentfulResult: any,
  offerBusinessOwner: string,
  searchEnv: string,
): Promise<any> => {
  const recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
    model.eligiblePlans.split(',')[0],
    model.Store,
    searchEnv as Env,
  );
  const result: any = {
    couponCreatedAt: recurlyCouponResult.couponCreatedAt,
    noEndDate: recurlyCouponResult.noEndDate,
    offerCode: recurlyCouponResult.offerCode,
    offerName: recurlyCouponResult.offerName,
    storeCode: contentfulResult.storeCode,
    offerHeader: contentfulResult.offerHeader,
    discountType: recurlyCouponResult.discountType,
    eligiblePlans: recurlyCouponResult.eligiblePlans,
    offerBodyText: contentfulResult.offerBodyText,
    offerCodeType: recurlyCouponResult.coupon.couponType,
    claimOfferTerms: contentfulResult.claimOfferTerms,
    legalDisclaimer: contentfulResult.legalDisclaimer,
    localized: contentfulResult.localized,
    offerBoldedText: contentfulResult.offerBoldedText,
    welcomeEmailText: recurlyCouponResult.welcomeEmailText,
    offerBusinessOwner,
    discountDurationType: recurlyCouponResult.discountDurationType,
    discountDurationUnit: recurlyCouponResult.discountDurationUnit,
    discountDurationValue: recurlyCouponResult.discountDurationValue,
    offerAppliedBannerText: contentfulResult.offerAppliedBannerText,
    discountAmount: getDiscountAmount(recurlyPlanPayload, recurlyCouponResult),
    isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
    csvFileName: getCsvFileNameIfExists(
      model.storeCode,
      model.offerCode,
      !!recurlyCouponResult ? recurlyCouponResult.offerCodeType : null,
      searchEnv as Env,
    ),
    offerUrl: null,
  };
  return result;
};

const getExtensionOfferDraftData = async (
  model: any,
  recurlyPlanPayload: PlanRecurlyPayload,
  recurlyCouponResult: any,
  contentfulResult: any,
  offerBusinessOwner: string,
  searchEnv: string,
): Promise<any> => {
  const result: any = {
    couponCreatedAt: recurlyCouponResult.couponCreatedAt,
    offerCode: recurlyCouponResult.offerCode,
    storeCode: contentfulResult.storeCode,
    eligibleCharges: recurlyCouponResult.eligiblePlans,
    offerTitle: contentfulResult.offerTitle,
    offerDescription: contentfulResult.offerDescription,
    offerTerms: contentfulResult.claimOfferTerms,
    durationType: recurlyCouponResult.discountDurationType,
    durationUnit: recurlyCouponResult.discountDurationUnit,
    durationValue: recurlyCouponResult.discountDurationValue,
    discountAmount: getDiscountAmount(recurlyPlanPayload, recurlyCouponResult),
    offerBusinessOwner,
    isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
    csvFileName: getCsvFileNameIfExists(
      model.storeCode,
      model.offerCode,
      !!recurlyCouponResult ? recurlyCouponResult.offerCodeType : null,
      searchEnv as Env,
    ),
    offerUrl: null,
  };
  return result;
};
