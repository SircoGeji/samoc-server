import pRetry from 'p-retry';
import {
  Brand,
  Offer,
  OfferType,
  Plan,
  Platform,
  Region,
  RemoteLock,
  RetentionOffer,
  Status,
  Store,
  User,
  WorkflowQueue,
  Currency,
  Language,
  Campaign,
  ExtensionOffer,
} from '../models';
import { OfferModel } from '../models/Offer';
import { PlanModel } from '../models/Plan';
import { StoreModel } from '../models/Store';
import {
  AppError,
  GhostLockerError,
  PreUpdateRemoteError,
} from './errorHandler';
import {
  CodeType,
  Env,
  RecurlyPlanState,
  RemoteSystem,
  StatusEnum,
  WorkflowAction,
} from '../types/enum';
import * as recurly from 'recurly';
import { RecurlyCredential } from '../types/recurly';
import Logger from '../util/logger';
import {
  OfferDbPayload,
  PlanRecurlyPayload,
  RetentionOfferDbPayload,
  AndroidModulePayload,
  ExtensionOfferDbPayload,
} from '../types/payload';
import * as Recurly from '../services/Recurly';
import { io } from '../server';
import { WorkflowQueueModel } from '../models/WorkflowQueue';
import Moment from 'moment';
import {
  rmCsvFile,
  setOfferModelDraftDataErrMessage,
} from '../controllers/offers';
import { DEFAULT_SPINNER_TEXT, EXTRA_CODES_FOR_BAMBOO } from './constants';
import moment from 'moment';
import * as httpContext from 'express-http-context';
import { RetentionOfferModel } from '../models/RetentionOffer';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Utils:`;
  } else {
    return `Utils:`;
  }
};

const STORE_QUERY_OPTS = {
  include: [
    { model: Brand },
    { model: Platform },
    { model: Region, include: [{ model: Currency }] },
  ],
};

export const PLAN_QUERY_OPTS = {
  include: [
    {
      model: Store,
      ...STORE_QUERY_OPTS,
    },
    { model: Status },
  ],
};

export const OFFER_QUERY_OPTS = {
  include: [
    {
      model: Plan,
      include: [{ model: Store, ...STORE_QUERY_OPTS }],
    },
    { model: OfferType },
    { model: Status },
    { model: User, as: 'createdByUser' },
    { model: User, as: 'lastModifiedByUser' },
    { model: Campaign },
  ],
};

export const RETENTION_OFFER_QUERY_OPTS = {
  include: [
    { model: Store, ...STORE_QUERY_OPTS },
    { model: Status },
    { model: User, as: 'createdByUser' },
    { model: User, as: 'lastModifiedByUser' },
    { model: Campaign },
  ],
};

export const EXTENSION_OFFER_QUERY_OPTS = {
  include: [
    { model: Store, ...STORE_QUERY_OPTS },
    { model: Status },
    { model: User, as: 'createdByUser' },
    { model: User, as: 'lastModifiedByUser' },
  ],
};

// not in used for now
// export const getPagination = (
//   pageVal: number,
//   sizeVal: number,
// ): { limit: number; offset: number } => {
//   const limit = sizeVal ? +sizeVal : 10;
//   const offset = pageVal ? pageVal * limit : 0;

//   return { limit, offset };
// };

export const getStoreModel = async (storeCode: string): Promise<StoreModel> => {
  let store: StoreModel = null;
  const findStoreOp = async () => {
    store = await Store.findByPk(storeCode, STORE_QUERY_OPTS);
  };
  // setup retry mechanism
  await pRetry(findStoreOp, pRetryOptions);
  return store;
};

export const getPlanModel = async (planCode: string): Promise<PlanModel> => {
  let plan: PlanModel = null;
  const findPlanOp = async () => {
    plan = await Plan.findByPk(planCode, PLAN_QUERY_OPTS);
  };
  // setup retry mechanism
  await pRetry(findPlanOp, pRetryOptions);
  return plan;
};

export const getOfferModel = async (
  storeCode: string,
  offerCode: string,
): Promise<OfferModel> => {
  let offer: OfferModel = null;
  const findOfferOp = async () => {
    if (storeCode) {
      offer = await Offer.findOne({
        ...OFFER_QUERY_OPTS,
        where: { offerCode, storeCode },
      });
    } else {
      offer = await Offer.findByPk(offerCode, OFFER_QUERY_OPTS);
    }
  };
  // setup retry mechanism
  await pRetry(findOfferOp, pRetryOptions);
  return offer;
};

export const getRetentionOfferModel = async (
  storeCode: string,
  offerCode: string,
): Promise<RetentionOfferModel> => {
  let offer: RetentionOfferModel = null;
  const findOfferOp = async () => {
    if (storeCode) {
      offer = await RetentionOffer.findOne({
        ...RETENTION_OFFER_QUERY_OPTS,
        where: { offerCode, storeCode },
      });
    } else {
      offer = await RetentionOffer.findByPk(
        offerCode,
        RETENTION_OFFER_QUERY_OPTS,
      );
    }
  };
  // setup retry mechanism
  await pRetry(findOfferOp, pRetryOptions);
  return offer;
};

export const getExtensionOfferModel = async (
  storeCode: string,
  offerCode: string,
): Promise<ExtensionOfferModel> => {
  let offer: ExtensionOfferModel = null;
  const findOfferOp = async () => {
    if (storeCode) {
      offer = await ExtensionOffer.findOne({
        ...EXTENSION_OFFER_QUERY_OPTS,
        where: { offerCode, storeCode },
      });
    } else {
      offer = await ExtensionOffer.findByPk(
        offerCode,
        EXTENSION_OFFER_QUERY_OPTS,
      );
    }
  };
  // setup retry mechanism
  await pRetry(findOfferOp, pRetryOptions);
  return offer;
};

export const getTargetEnvFromStatusId = (statusId: StatusEnum): Env => {
  if (statusId > StatusEnum.PROD_PEND) {
    return Env.PROD;
  } else if (statusId >= StatusEnum.STG_ERR_CRT) {
    return Env.STG;
  } else if (statusId >= StatusEnum.DFT) {
    return Env.DB;
  } else {
    throw new AppError(
      `Cannot determine target environment, invalid status: ${statusId}`,
      406,
    );
  }
};

export const getTargetEnv = (offer: {
  statusId?: number;
  couponId?: string;
}): Env => {
  if (offer.statusId > StatusEnum.PROD_ERR_PUB) {
    return Env.PROD;
  } else if (offer.statusId === StatusEnum.PROD_ERR_PUB) {
    return Env.PROD;
  } else if (offer.statusId >= StatusEnum.STG_ERR_CRT) {
    return offer.couponId ? Env.STG : Env.DB;
  } else if (offer.statusId >= StatusEnum.DFT) {
    return Env.DB;
  }
};

export const createRecurlyClient = (apiKey: string): recurly.Client => {
  return new recurly.Client(apiKey);
};

export const getRecurlyCredential = (
  store: StoreModel,
  env: Env,
): RecurlyCredential => {
  if (store) {
    if (env === Env.PROD) {
      return {
        subdomain: store.rlySubdomainProd,
        apiKey: store.rlyApiKeyProd,
      };
    }
    return {
      subdomain: store.rlySubdomainStg,
      apiKey: store.rlyApiKeyStg,
    };
  } else {
    throw new AppError(
      `Unable to create Recurly client: Invalid store (${store})`,
    );
  }
};

export const formatStringWithTokens = (
  string: string,
  ...tokens: string[]
): string => {
  const args = tokens;
  return string.replace(/{(\d+)}/g, function () {
    // eslint-disable-next-line prefer-rest-params
    return args[arguments[1]];
  });
};

export const generateRandomAlphanumericString = (length: number): string => {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const sanitizeUnit = (value: string): string => {
  // strip trailing 's' on unit string to become singlar form
  if (value.endsWith('s')) {
    return value.substring(0, value.length - 1);
  }
  return value;
};

export const pRetryOptions: pRetry.Options = {
  onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
    // retry only on connection errors
    if (error.name === 'SequelizeHostNotFoundError') {
      logger.warn(
        `DB host not found (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      logger.warn(
        `Remote system host not found (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('Timeout')) {
      logger.warn(
        `Connection timeout (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('504')) {
      logger.warn(
        `504 Gateway timed out (${error.retriesLeft} retries left)`,
        error,
      );
    } else {
      logger.warn(`Other error occurred, skipping retry`, error);
      throw error;
    }
  },
  retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
};

export const pRetryAll: pRetry.Options = {
  onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
    logger.warn(`Error occurred, (${error.retriesLeft} retries left)`, error);
  },
  retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
};

export const pRetryOptionsForClearCmsApiCache: pRetry.Options = {
  onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
    // retry only on connection errors
    if (error.message && error.message.includes('ENOTFOUND')) {
      logger.warn(
        `Remote system host not found, (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('Timeout')) {
      logger.warn(
        `Connection timeout, (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('404')) {
      logger.warn(`404 not found, (${error.retriesLeft} retries left)`, error);
    } else if (error.message && error.message.includes('500')) {
      logger.warn(
        `500 error occurred, (${error.retriesLeft} retries left)`,
        error,
      );
    } else {
      logger.warn(`Other error occurred, skipping retry`, error);
      throw error;
    }
  },
  retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
};

export const pRetryOptionsForValidateGL: pRetry.Options = {
  onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
    // retry only on connection errors
    if (error.name === 'SequelizeHostNotFoundError') {
      logger.warn(
        `DB host not found (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      logger.warn(
        `Remote system host not found (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('Timeout')) {
      logger.warn(
        `Connection timeout (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('504')) {
      logger.warn(
        `504 Gateway timed out (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('404')) {
      logger.warn(`404 not found (${error.retriesLeft} retries left)`, error);
    } else {
      logger.warn(
        `Other error occurred (${error.retriesLeft} retries left)`,
        error,
      );
    }
  },
  retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
  minTimeout: 5 * 1000,
  maxTimeout: 30 * 1000,
  randomize: true,
};

export const pRetryOptionsForCmsAPIVerifyOffer: pRetry.Options = {
  onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
    // retry only on connection errors
    if (error.message && error.message.includes('ENOTFOUND')) {
      logger.warn(
        `Remote system host not found, (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('Timeout')) {
      logger.warn(
        `Connection timeout, (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('504')) {
      logger.warn(
        `504 Gateway timed out, (${error.retriesLeft} retries left)`,
        error,
      );
    } else if (error.message && error.message.includes('404')) {
      logger.warn(`404 not found, (${error.retriesLeft} retries left)`, error);
    } else if (error.message && error.message.includes('500')) {
      logger.warn(
        `500 error occurred, (${error.retriesLeft} retries left)`,
        error,
      );
    } else {
      logger.warn(`Other error occurred, skipping retry`, error);
      throw error;
    }
  },
  retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
};

export const processCampaignError = (
  campaignId: string,
  err: any,
): AppError => {
  const appErr = processCommonError(err, 'Campaign');
  appErr.data = {
    campaign: campaignId,
  };
  return appErr;
};

export const processSKUError = (err: any): AppError => {
  return processCommonError(err, 'SKU');
};

export const processAndroidModuleError = (err: any): AppError => {
  return processCommonError(err, 'AndroidModule');
};

export const processOfferError = (err: any): AppError => {
  return processCommonError(err, 'Offer');
};

export const processSlackError = (err: any): AppError => {
  return processCommonError(err, 'Slack');
};

export const processPlanError = (err: any): AppError => {
  return processCommonError(err, 'Plan');
};

const processCommonError = (err: any, type: string): AppError => {
  let message;
  let statusCode = 500;
  if (err.name === 'SequelizeUniqueConstraintError') {
    // duplicate primary key
    message = `The ${type} Code already exists. Please ensure it is unique.`;
    statusCode = 406;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    // DB error - Tell user the offer was not saved.
    message = `The ${type} could not be saved. DB Error: ${err.fields} not found`;
    statusCode = 406;
  } else if (err.name.startsWith('Recurly')) {
    // recurly errors
    message = `Recurly Error: ${err.message}`;
    if (err.type === 'unauthorized') {
      statusCode = 401;
    }
  } else if (
    err.name === 'AccessTokenInvalid' ||
    err.name === 'VersionMismatch'
  ) {
    // for contentful errors, the message is not useful to user, so return error name instead
    message = `Contentful Error: ${err.name}`;
  } else if (
    err.message.includes('Contentful') &&
    err.message.includes('operation failed')
  ) {
    // for various contentful error variations
    if (err.message.indexOf('{') === -1) {
      message = err.message;
    } else {
      const e = JSON.parse(err.message.substring(err.message.indexOf('{')));
      message = `Contentful - ${e.message.toLowerCase()}`;
    }
  } else if (err.isAxiosError) {
    if (err.message.includes('ENOTFOUND')) {
      message = `Connection Error: ${err.message}`;
    } else {
      // PlayAuth or GhostLocker errors
      message = `Axios Error: ${err.message}`;
    }
  } else if (err instanceof AppError) {
    // custom error - display message as is
    message = err.message;
    statusCode = err.statusCode;
  } else {
    // unknown error
    message = `Internal server error. Please try again later. Error: ${err.message}`;
  }
  return new AppError(message, statusCode);
};

export const getFlexSiteUrl = (
  targetEnv: Env,
  regionCode: string,
  path?: string,
): string => {
  let result: string =
    regionCode === 'us'
      ? process.env.FLEX_STG_DOMESTIC
      : process.env.FLEX_STG_INTERNATIONAL;
  if (targetEnv === Env.PROD) {
    result =
      regionCode === 'us'
        ? process.env.FLEX_PROD_DOMESTIC
        : process.env.FLEX_PROD_INTERNATIONAL;
  }
  if (path && path.length > 0) {
    return `${result}${path}`;
  } else {
    return `${result}`;
  }
};

export const getConstellationApiUrl = (
  nodeEnv: string,
  targetEnv: Env,
): string => {
  return formatStringWithTokens(
    process.env.CONSTELLATION_API_ENDPOINT ||
      `https://constellation{0}.flex.com/api/contentful-data/flex/{1}/specialOffer`,
    nodeEnv === 'prod' && targetEnv === Env.PROD ? '' : '-dev', // '' or '-dev'
    nodeEnv === 'prod' && targetEnv === Env.PROD ? 'Prod' : 'Dev', // 'Prod' or 'Dev'
  );
};

export const getCmsApiEndpoint = (
  nodeEnv: string,
  targetEnv: Env,
  region: string,
  lang: string,
  offerCode: string,
): string => {
  return formatStringWithTokens(
    process.env.CMS_API_ENDPOINT || `/sapi/cms/{0}/{1}/{2}/specialOffer/{3}`,
    nodeEnv === 'prod' && targetEnv === Env.PROD ? 'Prod' : 'Dev', // Dev, Prod
    region, // us, br
    lang, // en, es
    offerCode,
  );
};

export const updateOfferDbProperties = (
  offer: OfferModel,
  payload: OfferDbPayload,
): OfferModel => {
  if (offer && payload) {
    offer.set('cta', payload.offerCTA);
    offer.set('businessOwner', payload.offerBusinessOwner);
    offer.set('vanityUrl', payload.offerVanityUrl);
    offer.set('totalUniqueCodes', payload.totalUniqueCodes || null);
    // onTime is currently not used in Phase 2
    // offer.set('onTime', new Date(payload.publishDateTime));

    // force DB update to refresh last modified time
    offer.changed('businessOwner', true);
  } else {
    ``;
    logger.error('Invalid payload to update offer properties');
  }
  return offer;
};

export const updateRetentionOfferDbProperties = (
  offer: RetentionOfferModel,
  payload: RetentionOfferDbPayload,
): RetentionOfferModel => {
  if (offer && payload) {
    const switchToPlan = payload.upgradePlan;
    if (payload.usersOnPlans) {
      payload.usersOnPlans = payload.usersOnPlans.filter((val) => val !== '-');
    }
    offer.set('eligiblePlans', payload.eligiblePlans.join(','));
    offer.set('switchToPlan', switchToPlan);
    offer.set('isCouponless', false);
    offer.set('businessOwner', payload.offerBusinessOwner);
    offer.set(
      'usersOnPlans',
      payload.usersOnPlans && payload.usersOnPlans.length > 0
        ? payload.usersOnPlans.join(',')
        : null,
    );

    // onTime is currently not used in Phase 2
    // offer.set('onTime', new Date(payload.publishDateTime));

    // force DB update to refresh last modified time
    offer.changed('businessOwner', true);
  } else {
    ``;
    logger.error('Invalid payload to update offer properties');
  }
  return offer;
};

export const updateExtensionOfferDbProperties = (
  offer: ExtensionOfferModel,
  payload: any,
): ExtensionOfferModel => {
  if (offer && payload) {
    offer.set('eligibleCharges', payload.eligibleCharges.join(','));
    if (!!payload.createUpgradeOffer) {
      offer.set('upgradeOfferCode', payload.upgradeOfferCode);
      if (!!payload.usersOnPlans && !!payload.usersOnPlans.length) {
        const usersOnPlansArr = payload.usersOnPlans.filter(
          (elem: string) => elem !== '-',
        );
        offer.set(
          'usersOnPlans',
          !!usersOnPlansArr.length ? usersOnPlansArr.join(',') : null,
        );
      } else {
        offer.set('usersOnPlans', null);
      }
      offer.set(
        'switchToPlan',
        !!payload.upgradePlan
          ? payload.upgradePlan
          : payload.eligibleCharges[0],
      );
    } else {
      offer.set('upgradeOfferCode', null);
      offer.set('usersOnPlans', null);
      offer.set('switchToPlan', null);
    }
    offer.set('discountAmount', payload.discountAmount);
    offer.set('durationType', payload.durationType);
    offer.set('durationAmount', payload.durationAmount);
    offer.set('durationUnit', payload.durationUnit);
    offer.set('offerTitle', payload.offerTitle);
    offer.set('offerDescription', payload.offerDescription);
    offer.set('offerTerms', payload.offerTerms);
    offer.set('bannerText', payload.bannerText);
    offer.set('offerBusinessOwner', payload.offerBusinessOwner);
    offer.set('draftData', { ...payload });
  } else {
    logger.error('Invalid payload to update offer properties');
  }
  return offer;
};

export const updateOfferStatus = async (
  offer: OfferModel,
  status: StatusEnum,
): Promise<OfferModel> => {
  if (offer) {
    const keys = offer.changed();
    const errMessage =
      !!offer.draftData && !!offer.draftData.errMessage
        ? offer.draftData.errMessage
        : null;
    const latestOffer = await getOfferModel(offer.storeCode, offer.offerCode);
    if (latestOffer) {
      if (keys !== false) {
        for (const key of keys) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          latestOffer.set(key, offer.get(key));
        }
      }
      latestOffer.set('statusId', status);
      if (!!latestOffer.draftData) {
        setOfferModelDraftDataErrMessage(latestOffer, errMessage);
      }
      return await commitOfferToDb(latestOffer);
    } else if (offer.isNewRecord) {
      offer.set('statusId', status);
      if (!!offer.draftData) {
        setOfferModelDraftDataErrMessage(offer, errMessage);
      }
      return await commitOfferToDb(offer);
    }
  }
  logger.error('Invalid Offer Model - Status not updated');
  return offer;
};

export const updateRetentionOfferStatus = async (
  offer: RetentionOfferModel,
  status: StatusEnum,
): Promise<RetentionOfferModel> => {
  if (offer) {
    const keys = offer.changed();
    const errMessage =
      !!offer.draftData && !!offer.draftData.errMessage
        ? offer.draftData.errMessage
        : null;
    const latestOffer = await getRetentionOfferModel(
      offer.storeCode,
      offer.offerCode,
    );
    if (latestOffer) {
      if (keys !== false) {
        for (const key of keys) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          latestOffer.set(key, offer.get(key));
        }
      }
      latestOffer.set('statusId', status);
      if (!!latestOffer.draftData) {
        setOfferModelDraftDataErrMessage(latestOffer, errMessage);
      }
      return await commitRetentionOfferToDb(latestOffer);
    } else if (offer.isNewRecord) {
      offer.set('statusId', status);
      if (!!offer.draftData) {
        setOfferModelDraftDataErrMessage(offer, errMessage);
      }
      return await commitRetentionOfferToDb(offer);
    }
  }
  logger.error('Invalid Offer Model - Status not updated');
  return offer;
};

export const updateExtensionOfferStatus = async (
  offer: ExtensionOfferModel,
  status: StatusEnum,
): Promise<ExtensionOfferModel> => {
  if (offer) {
    const keys = offer.changed();
    const latestOffer = await getExtensionOfferModel(
      offer.storeCode,
      offer.offerCode,
    );
    if (latestOffer) {
      if (keys !== false) {
        for (const key of keys) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          latestOffer.set(key, offer.get(key));
        }
      }
      latestOffer.set('statusId', status);
      return await commitExtensionOfferToDb(latestOffer);
    } else if (offer.isNewRecord) {
      offer.set('statusId', status);
      return await commitExtensionOfferToDb(offer);
    }
  }
  logger.error('Invalid Offer Model - Status not updated');
  return offer;
};

export const commitOfferToDb = async (
  offer: OfferModel,
): Promise<OfferModel> => {
  const saveOfferOp = async () => {
    return await offer.save();
  };
  return await pRetry(saveOfferOp, pRetryOptions);
};

export const commitRetentionOfferToDb = async (
  offer: RetentionOfferModel,
): Promise<RetentionOfferModel> => {
  const saveOfferOp = async () => {
    return await offer.save();
  };
  return await pRetry(saveOfferOp, pRetryOptions);
};

export const commitExtensionOfferToDb = async (
  offer: ExtensionOfferModel,
): Promise<ExtensionOfferModel> => {
  const saveOfferOp = async () => {
    return await offer.save();
  };
  return await pRetry(saveOfferOp, pRetryOptions);
};

export const obtainRemoteLock = async (
  sys: RemoteSystem,
  env: Env,
): Promise<void> => {
  const obtainLockOp = async () => {
    const lock = await RemoteLock.findOne({
      where: { system: sys, env: env },
    });
    if (lock) {
      const diff = Date.now() - (lock.get('updatedAt') as Date).getTime();
      if (diff > 30000) {
        // lock has been hold for more than 30s, release and get a new one
        await lock.destroy();
        await RemoteLock.create({
          system: sys,
          env: env,
        });
      } else {
        throw new GhostLockerError('GhostLocker is busy');
      }
    } else {
      await RemoteLock.create({
        system: sys,
        env: env,
      });
    }
  };
  await pRetry(obtainLockOp, pRetryOptions);
};

export const releaseRemoteLock = async (
  sys: RemoteSystem,
  env: Env,
): Promise<void> => {
  const releaseLockOp = async () => {
    await RemoteLock.destroy({
      where: { system: sys, env: env },
    });
  };
  await pRetry(releaseLockOp, pRetryOptions);
};

export const retrieveRecurlyPlan = async (
  planCode: string,
  store: StoreModel,
  env: Env,
): Promise<PlanRecurlyPayload> => {
  // check if the plan exists in Recurly
  let recurlyPlan = null;
  try {
    recurlyPlan = await Recurly.getPlanRecurlyPayload(planCode, store, env);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} retrieveRecurlyPlan failed, ${err.message}`,
      err,
    );
    if (err.statusCode === 404) {
      throw new PreUpdateRemoteError(
        `RecurlyPlan (${planCode}) not found on Recurly ${
          env === Env.PROD ? 'Prod' : 'Stage'
        }`,
        err.statusCode,
      );
    } else {
      throw new PreUpdateRemoteError(
        err.message,
        err.statusCode ? err.statusCode : 400,
      );
    }
  }
  if (recurlyPlan && recurlyPlan.state === RecurlyPlanState.INACTIVE) {
    throw new PreUpdateRemoteError(
      `Plan (${planCode}) is inactive on Recurly ${
        env === Env.PROD ? 'Prod' : 'Stage'
      }`,
    );
  }
  return recurlyPlan;
};

export const compareRankings = (a: any, b: any) => {
  return a || b ? (!a ? -1 : !b ? 1 : b - a) : 0;
};

export const compareDates = (a: any, b: any) => {
  return a || b
    ? !a
      ? -1
      : !b
      ? 1
      : new Date(b).getTime() - new Date(a).getTime()
    : 0;
};

export const updateSpinnerText = (msg: string) => {
  const socketId = httpContext.get('socketIoId');
  if (socketId) {
    io.to(socketId).emit('update-spinner-text', msg || DEFAULT_SPINNER_TEXT);
  }
};

// Workflow Stuff
export const addOfferToWorkflowQueue = async (
  offerCode: string,
  action: string,
): Promise<WorkflowQueueModel> => {
  const wf = await WorkflowQueue.findByPk(offerCode);
  if (!wf) {
    const res = await WorkflowQueue.create({
      offerCode,
      action,
    });
    if (res) {
      return res;
    } else {
      return null;
    }
  }
};

export const checkOfferInWorkflowQueue = async (
  offerCode: string,
  action?: string,
): Promise<string> => {
  const wf = await WorkflowQueue.findByPk(offerCode);
  if (wf) {
    const expireAt = Moment(wf.get('updatedAt') as Date).add(15, 'minutes');
    const now = Moment();
    if (expireAt > now) {
      return wf.action;
    } else {
      // timed out after for 15 minutes, clear the specific action
      await wf.destroy();
      if (action === WorkflowAction.EXPORT_CSV) {
        await rmCsvFile(offerCode);
      }
    }
  }
  return null;
};

export const removeOfferFromWorkflowQueue = async (
  offerCode: string,
): Promise<void> => {
  const wf = await WorkflowQueue.findByPk(offerCode);
  if (wf) {
    await wf.destroy();
  }
};

export const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Add extra codes for Bamboo validation
 * @param count
 */
export const addExtraCodes = (count: number): number => {
  // prepare extra coupons for Bamboo testing - only applies to bulk offer code type
  return count + EXTRA_CODES_FOR_BAMBOO;
};

/**
 * Remove extra codes added for Bamboo validation
 * @param count
 */
export const removeExtraCodes = (count: number): number => {
  // prepare extra coupons for Bamboo testing - only applies to bulk offer code type
  return count - EXTRA_CODES_FOR_BAMBOO;
};

export const sleep = (ms: number): Promise<any> => {
  logger.debug(`${logPrefix()} Sleeping for ${ms}ms...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getRegionDefaultLang = async (
  regionCode: string,
): Promise<string> => {
  const languages = await Language.findAll({
    where: { regionCode: regionCode },
  });
  let code = '';
  for (const l of languages) {
    code = l.languageCode;
    if (!l.isFallback) {
      break;
    }
  }
  return code;
};

export const generateOfferUrlFromData = (
  regionCode: string,
  languageCode: string,
  statusId: StatusEnum,
  offerCode: string,
  offerCodeType: string,
) => {
  languageCode = languageCode.split('-')[0];
  //TODO: update url to handle region/store dynamically in future phase.
  const urlPath =
    `/${regionCode}/${languageCode}/offers?c=` +
    Buffer.from(offerCode).toString('base64');
  if (offerCodeType === CodeType.SINGLE_CODE) {
    if (
      statusId === StatusEnum.PROD_VALDN_PASS ||
      statusId === StatusEnum.PROD
    ) {
      return regionCode === 'us'
        ? process.env.FLEX_PROD_DOMESTIC + urlPath
        : process.env.FLEX_PROD_INTERNATIONAL + urlPath;
    } else if (
      statusId === StatusEnum.STG_VALDN_PASS ||
      statusId === StatusEnum.STG
    ) {
      return regionCode === 'us'
        ? process.env.FLEX_STG_DOMESTIC + urlPath
        : process.env.FLEX_STG_INTERNATIONAL + urlPath;
    }
  }
  return '';
};

export const generateOfferUrl = (
  offer: OfferModel,
  offerCodeType: string,
  languageCode: string,
): string => {
  const regionCode = offer.Plan.Store.regionCode;
  return generateOfferUrlFromData(
    regionCode,
    languageCode,
    offer.statusId,
    offer.offerCode,
    offerCodeType,
  );
};

export const getLatestUpdatedAt = (...dateArr: Date[]): Date[] => {
  dateArr = dateArr.filter((d) => {
    return d && moment(d).isValid();
  });

  return dateArr.slice().sort((a, b) => b.getTime() - a.getTime());
};

// SAMOC-1778 This is to work around a MYSQL bug where whitespace is converted to 0 when inserted into the db after
// anything other than whitespace is added
export const whitespaceSort = (a: any, b: any) => {
  let aTrimLength = a.value?.toString().trim().length;
  let bTrimLength = b.value?.toString().trim().length;
  let aLength = a.value?.toString().length;
  let bLength = b.value?.toString().length;
  let regExp = /^0+$/;
  let aOnlyZero = regExp.test(a.value);
  let bOnlyZero = regExp.test(b.value);
  if (aOnlyZero && !bOnlyZero) {
    return -1;
  }
  if (!aOnlyZero && bOnlyZero) {
    return 1;
  }
  if (aTrimLength === 0 && bTrimLength !== 0) {
    return -1;
  }
  if (aTrimLength < aLength && bTrimLength === bLength) {
    return -1;
  }
  if (aTrimLength !== 0 && bTrimLength === 0) {
    return 1;
  }
  if (aTrimLength === aLength && bTrimLength < bLength) {
    return 1;
  }
  return 0;
};

export const getProperValue = (
  value: any,
  dataType: string,
  isDBValue?: boolean,
) => {
  switch (dataType) {
    case 'boolean':
      if (value === '0' || value === 0 || value === false || !value) {
        return false;
      } else {
        return true;
      }
    case 'number':
      return !!Number(value) ? Number(value) : null;
    case 'string':
      return value === '' || !value ? (isDBValue ? null : '') : value;
    default:
      return !!value ? value : null;
  }
};
