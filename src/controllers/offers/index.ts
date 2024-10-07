import {
  CodeType,
  DiscountType,
  DurationType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../types/enum';
import {
  OfferContentfulPayload,
  OfferRecurlyPayload,
  OfferResponsePayload,
  PlanRecurlyPayload,
  RetentionOfferContentfulPayload,
} from '../../types/payload';
import {
  addExtraCodes,
  checkOfferInWorkflowQueue,
  generateOfferUrl,
  getLatestUpdatedAt,
  getOfferModel,
  getRegionDefaultLang,
  getTargetEnv,
} from '../../util/utils';
import { OfferModel } from '../../models/Offer';
import { StoreModel } from '../../models/Store';
import * as Contentful from '../../services/Contentful';
import * as GhostLocker from '../../services/GhostLocker';
import * as Recurly from '../../services/Recurly';
import {
  AppError,
  GhostLockerError,
  RecurlyError,
} from '../../util/errorHandler';
import Logger from '../../util/logger';
import * as fs from 'fs';
import moment from 'moment';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { getRetentionOfferRules } from './filters';
import { updateRetentionRules, retireRetentionFilters } from './filters';
import { validateSingleGlPromotionOffer } from '../../services/GhostLocker';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';
import pluralize from 'pluralize';

const logger = Logger(module);

export const getOfferDraftPayload = async (
  model: OfferModel,
  fetchPlanDetail = false,
): Promise<OfferResponsePayload> => {
  let result: OfferResponsePayload;
  if (model) {
    const draft = JSON.parse(JSON.stringify(model.draftData));
    if (draft) {
      result = { ...draft };
    } else {
      throw new AppError('Draft Offer data not found', 404);
    }
    result = {
      ...result,
      statusId: model.statusId,
      Status: {
        id: model.Status.statusId,
        title: model.Status.title,
        description: model.Status.description,
        sortPriority: model.Status.sortPriority,
      },
      lastModifiedAt: model.get('LastModifiedAt'),
      OfferType: {
        id: model.offerTypeId,
        title: model.OfferType ? model.OfferType.title : null,
      },
      dataIntegrityStatus: model.dataIntegrityStatus,
      dataIntegrityCheckTime: model.dataIntegrityCheckTime,
      dataIntegrityErrorMessage: model.dataIntegrityErrorMessage,
      campaign: model.campaign,
      campaignName:
        model.campaignName ||
        model.Campaign?.name ||
        (!!result && result.offerName)
          ? result.offerName
          : null,
      storeCode: model.storeCode,
      glValidationError:
        model.statusId !== StatusEnum.DFT
          ? await validateSingleGlPromotionOffer(
              model,
              model.Plan.Store.regionCode,
            )
          : null,
    };
    if (fetchPlanDetail) {
      logger.debug('fetch plan detail begins');
      const recurlyPlan = await Recurly.getPlanRecurlyPayload(
        model.planCode,
        model.Plan.Store,
        Env.STG,
      );
      if (recurlyPlan) {
        result = {
          ...result,
          offerBoldedTextHint: Contentful.getFormattedTotal(
            result as OfferContentfulPayload,
            recurlyPlan,
          ),
          Plan: {
            ...recurlyPlan,
          },
        };
      }
    }
  } else {
    throw new AppError('Invalid Offer', 404);
  }
  return result;
};

export const getRetentionOfferDraftPayload = async (
  model: RetentionOfferModel,
  fetchPlanDetail = false,
): Promise<OfferResponsePayload> => {
  let result: OfferResponsePayload;
  if (model) {
    const draft = JSON.parse(JSON.stringify(model.draftData));
    if (draft.usersOnPlans) {
      draft.usersOnPlans = draft.usersOnPlans.filter((val: any) => val !== '-');
    }
    if (draft) {
      result = { ...draft };
    } else {
      throw new AppError('Draft Offer data not found', 404);
    }
    result = {
      ...result,
      campaignName:
        model.campaignName ||
        model.Campaign?.name ||
        (!!result && result.offerName)
          ? result.offerName
          : null,
      statusId: model.statusId,
      Status: {
        id: model.Status.statusId,
        title: model.Status.title,
        description: model.Status.description,
        sortPriority: model.Status.sortPriority,
      },
      lastModifiedAt: model.get('LastModifiedAt'),
      OfferType: {
        id: OfferTypes.RETENTION,
        title: 'Retention',
      },
      dataIntegrityStatus: model.dataIntegrityStatus,
      dataIntegrityCheckTime: model.dataIntegrityCheckTime,
      dataIntegrityErrorMessage: model.dataIntegrityErrorMessage,
    };
    if (fetchPlanDetail) {
      logger.debug('fetch plan detail begins');
      const recurlyPlan = await Recurly.getPlanRecurlyPayload(
        model.eligiblePlans.split(',')[0],
        model.Store,
        Env.STG,
      );
      if (recurlyPlan) {
        result = {
          ...result,
          offerBoldedTextHint: '',
          Plan: {
            ...recurlyPlan,
          },
        };
      }
    }
  } else {
    throw new AppError('Invalid Offer', 404);
  }
  return result;
};

export const getExtensionOfferDraftPayload = async (
  model: ExtensionOfferModel,
  fetchPlanDetail = false,
): Promise<any> => {
  let result: any;
  if (model) {
    // const draft = JSON.parse(JSON.stringify(model.draftData));
    // result = { ...draft };
    result = getExtensionOfferModelPayload(model);
    if (fetchPlanDetail) {
      logger.debug('fetch plan detail begins');
      const recurlyPlan = await Recurly.getPlanRecurlyPayload(
        model.eligibleCharges.split(',')[0],
        model.Store,
        Env.STG,
      );
      if (recurlyPlan) {
        result = {
          ...result,
          Plan: {
            ...recurlyPlan,
          },
        };
      }
    }
  } else {
    throw new AppError('Invalid Offer', 404);
  }
  return result;
};

export const getOfferResponsePayload = async (
  model: OfferModel,
  ignoreErrors?: boolean,
): Promise<OfferResponsePayload> => {
  if (model) {
    let contentfulPayload;
    const errMessage = !!model.draftData.errMessage
      ? model.draftData.errMessage
      : null;
    const env = getTargetEnv(model);
    try {
      contentfulPayload = await Contentful.fetchSpecialOffer(
        model.Plan.Store.regionCode,
        model.offerCode,
        model.Plan.storeCode,
      );
    } catch (err) {
      logger.error(`Contentful error while preparing payload: ${err.message}`);
      if (model.draftData) {
        return getOfferDraftPayload(model, true);
      } else if (ignoreErrors) {
        return null;
      } else {
        throw new AppError(err);
      }
    }
    let recurlyCouponPayload, recurlyPlanPayload;
    try {
      recurlyCouponPayload = await Recurly.getOfferRecurlyPayload(
        model.offerCode,
        model.Plan.Store,
        env,
      );
      recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
        model.planCode,
        model.Plan.Store,
        env,
      );
    } catch (err) {
      logger.error(`Recurly error while preparing payload: ${err.message}`);
      if (ignoreErrors) {
        return null;
      }
      if (err.statusCode !== 404) {
        throw new AppError(err);
      }
    }

    const lastModifiedAtArr: Date[] = [];
    if (contentfulPayload?.updatedAt) {
      lastModifiedAtArr.push(contentfulPayload.updatedAt);
    }
    if (recurlyCouponPayload?.updatedAt) {
      lastModifiedAtArr.push(recurlyCouponPayload.updatedAt);
    }
    if (model.get('LastModifiedAt')) {
      lastModifiedAtArr.push(model.get('LastModifiedAt') as Date);
    }
    const lastModifiedAt = getLatestUpdatedAt(...lastModifiedAtArr)[0];

    const modelPayload = {
      lastModifiedAt: lastModifiedAt,
      origTotalUniqueCodes: !!recurlyCouponPayload
        ? recurlyCouponPayload.offerCodeType === CodeType.BULK_UNIQUE_CODE &&
          model.totalUniqueCodes
          ? addExtraCodes(model.totalUniqueCodes)
          : null
        : null,
      offerCode: model.offerCode,
      campaign: model.campaign,
      campaignName:
        model.campaignName ||
        model.Campaign?.name ||
        (!!recurlyCouponPayload && recurlyCouponPayload.offerName)
          ? recurlyCouponPayload.offerName
          : null,
      offerTypeId: model.offerTypeId,
      OfferType: {
        id: model.offerTypeId,
        title: model.OfferType ? model.OfferType.title : null,
      },
      offerCTA: model.cta,
      offerBusinessOwner: model.businessOwner,
      offerVanityUrl: model.vanityUrl,
      publishDateTime:
        model.onTime && !isNaN(model.onTime.getTime())
          ? model.onTime.toISOString()
          : null,
      statusId: model.statusId,
      Status: {
        id: model.Status.statusId,
        title: model.Status.title,
        description: model.Status.description,
      },
      dataIntegrityStatus: model.dataIntegrityStatus,
      dataIntegrityCheckTime: model.dataIntegrityCheckTime,
      dataIntegrityErrorMessage: model.dataIntegrityErrorMessage,
    };

    const languageCode = await getRegionDefaultLang(
      model.Plan.Store.regionCode,
    );
    return {
      ...contentfulPayload,
      ...recurlyCouponPayload,
      Plan: {
        ...recurlyPlanPayload,
      },
      ...modelPayload,
      discountAmount: getDiscountAmount(
        recurlyPlanPayload,
        recurlyCouponPayload,
      ),
      isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
      csvFileName: getCsvFileNameIfExists(
        model.storeCode,
        model.offerCode,
        !!recurlyCouponPayload ? recurlyCouponPayload.offerCodeType : null,
        env,
      ),
      offerUrl: generateOfferUrl(
        model,
        !!recurlyCouponPayload ? recurlyCouponPayload.offerCodeType : null,
        languageCode,
      ),
      glValidationError: await validateSingleGlPromotionOffer(
        model,
        model.Plan.Store.regionCode,
      ),
      errMessage,
    };
  } else if (!ignoreErrors) {
    throw new AppError('Invalid Offer', 404);
  }
};

export const getRetentionOfferResponsePayload = async (
  model: RetentionOfferModel,
  ignoreErrors?: boolean,
): Promise<OfferResponsePayload> => {
  if (model) {
    let contentfulPayload;
    const errMessage = !!model.draftData.errMessage
      ? model.draftData.errMessage
      : null;
    const env = getTargetEnv(model);
    try {
      contentfulPayload = await Contentful.fetchSpecialOffer(
        model.Store.regionCode,
        model.offerCode,
        model.storeCode,
        true,
      );
    } catch (err) {
      logger.error(`Contentful error while preparing payload: ${err.message}`);
      if (err.statusCode !== 404 && !ignoreErrors) {
        throw new AppError(err);
      }
    }
    let recurlyCouponPayload, recurlyUpgradeCouponPayload, recurlyPlanPayload;
    try {
      const recurlyCouponPayloads = await Recurly.getRetentionOffersRecurlyPayload(
        [model],
        model.Store,
        env,
        null,
        null,
      );
      recurlyCouponPayload = recurlyCouponPayloads[0];
      recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
        model.eligiblePlans.split(',')[0],
        model.Store,
        env,
      );
    } catch (err) {
      logger.error(`Recurly error while preparing payload: ${err.message}`);
      if (err.statusCode !== 404 && !ignoreErrors) {
        throw new AppError(err);
      }
    }

    const lastModifiedAtArr: Date[] = [];
    if (contentfulPayload?.updatedAt) {
      lastModifiedAtArr.push(contentfulPayload.updatedAt);
    }
    if (recurlyCouponPayload?.updatedAt) {
      lastModifiedAtArr.push(recurlyCouponPayload.updatedAt);
    }
    if (model.get('LastModifiedAt')) {
      lastModifiedAtArr.push(model.get('LastModifiedAt') as Date);
    }
    const lastModifiedAt = getLatestUpdatedAt(...lastModifiedAtArr)[0];

    const modelPayload = {
      lastModifiedAt: lastModifiedAt,
      offerCode: model.offerCode,
      campaign: model.campaign,
      campaignName:
        model.campaignName ||
        model.Campaign?.name ||
        (!!recurlyCouponPayload && recurlyCouponPayload.offerName)
          ? recurlyCouponPayload.offerName
          : null,
      offerTypeId: OfferTypes.RETENTION,
      OfferType: {
        id: OfferTypes.RETENTION,
        title: 'Retention',
      },
      usersOnPlans: (model.usersOnPlans
        ? model.usersOnPlans.split(',')
        : []
      ).filter((val) => val !== '-'),
      upgradePlan: model.switchToPlan,
      createUpgradeOffer: !!model.switchToPlan,

      offerBusinessOwner: model.businessOwner,
      statusId: model.statusId,
      Status: {
        id: model.Status.statusId,
        title: model.Status.title,
        description: model.Status.description,
      },
      dataIntegrityStatus: model.dataIntegrityStatus,
      dataIntegrityCheckTime: model.dataIntegrityCheckTime,
      dataIntegrityErrorMessage: model.dataIntegrityErrorMessage,
    };
    return {
      ...contentfulPayload,
      ...recurlyCouponPayload,
      ...modelPayload,
      discountAmount: getDiscountAmount(
        recurlyPlanPayload,
        recurlyCouponPayload,
      ),
      isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
      csvFileName: getCsvFileNameIfExists(
        model.storeCode,
        model.offerCode,
        !!recurlyCouponPayload ? recurlyCouponPayload.offerCodeType : null,
        env,
      ),
      offerUrl: null, //generateOfferUrl(model, recurlyCouponPayload.offerCodeType),
      errMessage,
    };
  } else if (!ignoreErrors) {
    throw new AppError('Invalid Offer', 404);
  }
};

export const getExtensionOfferResponsePayload = async (
  model: ExtensionOfferModel,
  ignoreErrors?: boolean,
): Promise<OfferResponsePayload> => {
  if (model) {
    let contentfulPayload;
    const errMessage =
      !!model.draftData && !!model.draftData.errMessage
        ? model.draftData.errMessage
        : null;
    const env = getTargetEnv(model);
    try {
      contentfulPayload = await Contentful.fetchSpecialOffer(
        model.Store.regionCode,
        model.offerCode,
        model.storeCode,
        true,
      );
    } catch (err) {
      logger.error(`Contentful error while preparing payload: ${err.message}`);
      if (err.statusCode !== 404 && !ignoreErrors) {
        throw new AppError(err);
      }
    }
    let recurlyCouponPayload, recurlyUpgradeCouponPayload, recurlyPlanPayload;
    try {
      const recurlyCouponPayloads = await Recurly.getExtensionOffersRecurlyPayload(
        [model],
        model.Store,
        env,
        null,
        null,
      );
      recurlyCouponPayload = recurlyCouponPayloads[0];
      recurlyPlanPayload = await Recurly.getPlanRecurlyPayload(
        model.eligibleCharges.split(',')[0],
        model.Store,
        env,
      );
    } catch (err) {
      logger.error(`Recurly error while preparing payload: ${err.message}`);
      if (err.statusCode !== 404 && !ignoreErrors) {
        throw new AppError(err);
      }
    }

    const lastModifiedAtArr: Date[] = [];
    if (contentfulPayload?.updatedAt) {
      lastModifiedAtArr.push(contentfulPayload.updatedAt);
    }
    if (recurlyCouponPayload?.updatedAt) {
      lastModifiedAtArr.push(recurlyCouponPayload.updatedAt);
    }
    if (model.get('LastModifiedAt')) {
      lastModifiedAtArr.push(model.get('LastModifiedAt') as Date);
    }
    const lastModifiedAt = getLatestUpdatedAt(...lastModifiedAtArr)[0];

    const modelPayload = {
      ...getExtensionOfferModelPayload(model),
      lastModifiedAt,
    };
    return {
      ...contentfulPayload,
      ...recurlyCouponPayload,
      ...modelPayload,
      discountAmount: getDiscountAmount(
        recurlyPlanPayload,
        recurlyCouponPayload,
      ),
      offerBusinessOwner: model.offerBusinessOwner,
      isInWorkflow: await checkOfferInWorkflowQueue(model.offerCode),
      csvFileName: getCsvFileNameIfExists(
        model.storeCode,
        model.offerCode,
        !!recurlyCouponPayload ? recurlyCouponPayload.offerCodeType : null,
        env,
      ),
      offerUrl: null, //generateOfferUrl(model, recurlyCouponPayload.offerCodeType),
      errMessage,
    };
  } else if (!ignoreErrors) {
    throw new AppError('Invalid Offer', 404);
  }
};

export const rmCsvFile = async (offerCode: string): Promise<void> => {
  // TODO: get store code
  const offer = await getOfferModel(null, offerCode);
  const env = getTargetEnv(offer);
  const fileName = generateCsvFileName(offer.storeCode, offer.offerCode, env);
  const csvRoot = process.env.CSV_ROOT;
  const fullPath = csvRoot + `/` + fileName;

  if (checkFileExist(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) {
        logger.error(
          `Failed to remove file '${fullPath}', ${err.message}`,
          err,
        );
        return;
      }
      //file removed
    });
  }
};

export const rmFile = (fullPath: string): void => {
  try {
    if (checkFileExist(fullPath)) {
      fs.unlinkSync(fullPath);
      //file removed
    }
  } catch (err) {
    logger.error(`Failed to remove file '${fullPath}', ${err.message}`, err);
  }
};

export const checkFileExist = (fullPath: string): boolean => {
  try {
    if (fs.existsSync(fullPath)) {
      return true;
    }
  } catch (err) {
    logger.error(
      `Failed to check file '${fullPath}' exists, ${err.message}`,
      err,
    );
  }
  return false;
};

export const getCsvFileNameIfExists = (
  storeCode: string,
  offerCode: string,
  offerType: string,
  env: Env,
): string => {
  const fileName = generateCsvFileName(storeCode, offerCode, env);
  const fullPath = `${process.env.CSV_ROOT}/${fileName}`;
  if (offerType === CodeType.BULK_UNIQUE_CODE && checkFileExist(fullPath)) {
    return fileName;
  }
  return null;
};

export const generateCsvFileName = (
  storeCode: string,
  offerCode: string,
  env: Env,
): string => {
  return `${offerCode}-${env}-${storeCode}.csv`;
};

export const getDiscountAmount = (
  plan: PlanRecurlyPayload,
  coupon: OfferRecurlyPayload,
): number => {
  // the actual discount amount is the different between plan price and Recurly discount price
  if (
    plan &&
    coupon &&
    (coupon.discountType === DiscountType.FIXED_PRICE ||
      coupon.coupon?.discount.type === DiscountType.FIXED_PRICE)
  ) {
    return Number.parseFloat((plan.price - coupon.discountAmount).toFixed(2));
  } else if (coupon && coupon.discountType === DiscountType.PERCENT) {
    return coupon.discountAmount;
  }
  return undefined;
};

export const checkRecurlyCoupon = async (
  offerCode: string,
  store: StoreModel,
  env: Env,
): Promise<OfferRecurlyPayload> => {
  const offer = await Recurly.getOfferRecurlyPayload(offerCode, store, env);
  if (offer.couponState === 'expired') {
    throw new RecurlyError(
      `Recurly: Coupon (${offerCode}) expired on ${env.toUpperCase()}`,
    );
  }
  return offer;
};

export const checkGhostLockerOffer = async (
  offerCode: string,
  regionCode: string,
  env: Env,
): Promise<void> => {
  if (!(await GhostLocker.promoOfferExists(offerCode, regionCode, env))) {
    throw new GhostLockerError(
      `GhostLocker: Promo offer not found on ${env.toUpperCase()}`,
    );
  }
};

export const setOfferModelDraftDataErrMessage = (
  offer: any,
  errMessage: string,
) => {
  let draftData = JSON.parse(JSON.stringify(offer.draftData));
  draftData.errMessage = errMessage;
  offer.set('draftData', draftData);
};

export const getExtensionOfferModelPayload = (
  model: ExtensionOfferModel,
): any => {
  return {
    statusId: model.statusId,
    Status: {
      id: model.Status.statusId,
      title: model.Status.title,
      description: model.Status.description,
      sortPriority: model.Status.sortPriority,
    },
    lastModifiedAt: model.get('LastModifiedAt'),
    createdAt: model.get('CreatedAt'),
    OfferType: {
      id: OfferTypes.EXTENSION,
      title: 'Extension',
    },
    eligibleCharges: model.eligibleCharges.split(','),
    upgradePlan: model.switchToPlan,
    offerCode: model.offerCode,
    createUpgradeOffer: !!model.upgradeOfferCode,
    upgradeOfferCode: model.upgradeOfferCode,
    storeCode: model.storeCode,
    switchToPlan: model.switchToPlan,
    usersOnPlans: (model.usersOnPlans
      ? model.usersOnPlans.split(',')
      : []
    ).filter((val) => val !== '-'),
    createdBy: model.createdBy,
    lastModifiedBy: model.lastModifiedBy,
    discountAmount: model.discountAmount,
    durationType: model.durationType,
    durationAmount: model.durationAmount,
    durationUnit: model.durationUnit,
    offerTitle: model.offerTitle,
    offerName: model.offerTitle,
    offerDescription: model.offerDescription,
    offerTerms: model.offerTerms,
    bannerText: model.bannerText,
    offerBusinessOwner: model.offerBusinessOwner,
    draftData: model.draftData,
    offerTypeId: OfferTypes.EXTENSION,
    couponCreatedAt:
      model.statusId !== StatusEnum.DFT ? model.get('CreatedAt') : null,
    useUpgradePlan: !!model.upgradeOfferCode,
  };
};

export { createNewOffer } from './createNewOffer';
export { saveDraftOffer } from './saveDraftOffer';
export { deleteOffer } from './deleteOffer';
export { generateCodes } from './uniqueCodes';
export { exportCodes } from './uniqueCodes';
export { downloadCsv } from './uniqueCodes';
export { getAllOffers, getDBAllOffers, putAllOffers } from './getAllOffers';
export { getOffer } from './getOffer';
export { publishOffer } from './publishOffer';
export { updateOffer } from './updateOffer';
export { validateOffer } from './validateOffer';
export {
  getRetentionOfferRules,
  getExtensionOfferRules,
  updateExtensionOfferRules,
  updateRetentionRules,
  retireRetentionFilters,
  synchronizeFilters,
  getGLConfigVersionsData,
  rollbackDefaultGLConfigsToProd,
} from './filters';
export { getRetentionOffersForDurations } from './retentionOffersForPlans';
export { updateOfferDit, validateOfferDIT } from './dataIntegrityTest';
export { saveDraftCampaign } from './campaign/saveDraftCampaign';
export { getCampaign } from './campaign/getCampaign';
export { createNewCampaign } from './campaign/createNewCampaign';
export { deleteCampaign } from './campaign/deleteCampaign';
export { updateCampaign } from './campaign/updateCampaign';
export { validateCampaign } from './campaign/validateCampaign';
export { publishCampaign } from './campaign/publishCampaign';
export { synchronizeOffer } from './synchronizeOffer';
export { getOfferHistory } from './offerHistory';
