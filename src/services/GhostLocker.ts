import Logger from '../util/logger';
import axios from 'axios';
import pRetry from 'p-retry';
import {
  ActiveProdOfferStatuses,
  ActiveStgOfferStatuses,
  Env,
  OfferTypes,
  RemoteSystem,
} from '../types/enum';
import { format } from 'date-fns';
import { GhostLockerError } from '../util/errorHandler';
import {
  obtainRemoteLock,
  pRetryOptions,
  releaseRemoteLock,
} from '../util/utils';
import { GL_COR_ID } from '../util/constants';
import { OfferModel } from '../models/Offer';
import { RetentionOfferModel } from '../models/RetentionOffer';

export enum GLSet {
  PROMO_RECURLY,
  RET_RECURLY_V2,
  PROMO_TRANSLATED,
  RET_APPLE_V3,
  RET_GOOGLE_V3,
  RET_RECURLY_V3,
  UNIVERSAL,
}

export const CONFIG_SET_ID: { [key in GLSet]: string } = {
  [GLSet.PROMO_RECURLY]: 'offers:promotion:iap:recurly',
  [GLSet.RET_RECURLY_V2]: 'offers:retention:iap:recurly:v2',
  [GLSet.PROMO_TRANSLATED]: 'offers:promotion:iap:store-translated',
  [GLSet.RET_APPLE_V3]: 'offers:retention:iap:apple:v3',
  [GLSet.RET_GOOGLE_V3]: 'offers:retention:iap:google:v3',
  [GLSet.RET_RECURLY_V3]: 'offers:retention:iap:recurly:v3',
  [GLSet.UNIVERSAL]: 'offers:universal:iap:recurly',
};

export const configUrl = (glSet: GLSet): string => {
  return `applications/playauth/configurations/${CONFIG_SET_ID[glSet]}`;
};

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] GhostLocker:`;
  } else {
    return `GhostLocker:`;
  }
};

export const getHost = (env: Env): string => {
  const glHost =
    env === Env.PROD
      ? process.env.GHOSTLOCKER_PROD
      : process.env.GHOSTLOCKER_STG;
  return `${glHost}/api/v${process.env.GHOSTLOCKER_API_VERSION}`;
};

export const getAccessToken = async (env: Env): Promise<string> => {
  const resp = await axios.post(`${getHost(env)}/Auth/client`, {
    key:
      env === Env.PROD
        ? process.env.GHOSTLOCKER_PROD_API_KEY
        : process.env.GHOSTLOCKER_STG_API_KEY,
  });
  logger.debug(`${logPrefix(env)} Retrieved authentication token`, {
    'x-ghostlocker-correlationid': resp?.headers[GL_COR_ID] || 'Undefined',
  });
  return resp.data.token;
};

export const getConfigOfVersion = async (
  glSet: GLSet,
  version: number | 'current',
  token: string,
  env: Env,
): Promise<OfferConfiguration> => {
  const resp = await axios.get(
    `${getHost(env)}/${configUrl(glSet)}/${version}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  logger.debug(
    `${logPrefix(env)} Retrieved configuration with version (${version})`,
    {
      'x-ghostlocker-correlationid': resp?.headers[GL_COR_ID] || 'Undefined',
    },
  );
  return resp.data as OfferConfiguration;
};

export const getCurrentConfigVersion = async (
  env: Env,
  token: string,
  glSet: GLSet,
) => {
  const config = await getConfigOfVersion(glSet, 'current', token, env);
  return config.configurationVersion;
};

const modifyConfigPayload = (
  config: OfferConfiguration,
  offerCode: string,
  offerTypeId: number,
  planCode: string,
  regionCode: string,
  remove: boolean,
): UpdateOfferConfigurationPayload => {
  const configValue: ConfigurationValue = JSON.parse(config.configurationValue);
  const country = configValue.countries.find(
    (entry) => entry.country.toLowerCase() === regionCode,
  );
  const promoOffer: PromotionOffer = {
    storeOfferId: offerCode,
    isForNewUser: offerTypeId === OfferTypes.ACQUISITION,
    planCode: planCode,
  };
  if (remove) {
    // Per doc:  https://confluence.flex.com/pages/viewpage.action?pageId=179571852
    // Suggested not to remove entries from GL config, commenting it out for now.
    // - - - - - - - - - -
    // Per ticket: https://flexent.atlassian.net/browse/SAMOC-1689
    // Suggested to return offer entries removal from GL config
    // remove
    country.promotionOffers = country.promotionOffers.filter(
      (entry) =>
        !(
          entry.planCode === promoOffer.planCode &&
          entry.isForNewUser === promoOffer.isForNewUser &&
          entry.storeOfferId === promoOffer.storeOfferId
        ),
    );
  } else {
    // add
    country.promotionOffers.push(promoOffer);
  }

  return {
    cacheDurationSeconds: config.cacheDurationSeconds,
    comments: `SAMOC: ${remove ? `Removed` : `Added`} ${
      promoOffer.storeOfferId
    } on ${format(new Date(), 'yyyyMMdd-HHmmss')}`,
    configurationValue: JSON.stringify(configValue),
    contentType: config.contentType,
    lastChangedBy: 'FLEX-SAMOC',
  };
};

export const modifyRetentionFilters = (
  config: UpdateOfferConfigurationPayload,
  regionCode: string,
  country: RetentionCountry,
  changedBy: string,
): UpdateOfferConfigurationPayload => {
  const configValue: RetentionConfigurationValue = JSON.parse(
    config.configurationValue,
  );
  const index = configValue.countries.findIndex(
    (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
  );
  if (index < 0) {
    configValue.countries.push(country);
  } else {
    configValue.countries[index] = country;
  }
  config.configurationValue = JSON.stringify(configValue);
  return {
    cacheDurationSeconds: config.cacheDurationSeconds,
    comments: `SAMOC: Updated cancellation offers on ${format(
      new Date(),
      'yyyyMMdd-HHmmss',
    )}`,
    configurationValue: JSON.stringify(configValue),
    contentType: config.contentType,
    lastChangedBy: `FLEX-SAMOC on behalf of ${changedBy}`,
  };
};

const modifyRetentionConfigPayload = (
  config: OfferConfiguration,
  offerCode: string,
  lists: string[],
  forceToPlanCode: string | undefined,
  isCouponless: boolean | undefined,
  usersInPlans: string[],
  regionCode: string,
  remove: boolean,
): UpdateOfferConfigurationPayload => {
  const configValue: RetentionConfigurationValue = JSON.parse(
    config.configurationValue,
  );
  const country = configValue.countries.find(
    (entry) => entry.country.toLowerCase() === regionCode,
  );
  if (!country || !country.retentionOffersLists) {
    return null;
  }
  const offerLists = country.retentionOffersLists.filter((f) => {
    return lists.includes(f.name);
  });
  const promoOffer: RetentionOffer = {
    id: offerCode,
    storeOfferId: offerCode,
  };
  let upgradePromoOffer: RetentionOffer;
  if (forceToPlanCode) {
    upgradePromoOffer = {
      id: offerCode + '_upgrade',
      storeOfferId: offerCode + '_upgrade',
      forceUserToPlanCode: forceToPlanCode,
    };
    if (usersInPlans && usersInPlans.length > 0) {
      upgradePromoOffer.appliesToUsersOnPlans = usersInPlans;
    }
  }

  if (remove) {
    // Per doc:  https://confluence.flex.com/pages/viewpage.action?pageId=179571852
    // Suggested not to remove entries from GL config, commenting it out for now.
    // - - - - - - - - - -
    // Per ticket: https://flexent.atlassian.net/browse/SAMOC-1689
    // Suggested to return offer entries removal from GL config
    // remove
    country.retentionOffers = country.retentionOffers.filter(
      (entry) =>
        !(
          entry.id === promoOffer.id &&
          entry.storeOfferId === promoOffer.storeOfferId
        ),
    );
    if (upgradePromoOffer) {
      country.retentionOffers = country.retentionOffers.filter(
        (entry) =>
          !(
            entry.id === upgradePromoOffer.id &&
            entry.storeOfferId === upgradePromoOffer.storeOfferId
          ),
      );
    }
    for (const offerList of offerLists) {
      if (!!offerList.offerIds && offerList.offerIds.length) {
        offerList.offerIds = offerList.offerIds.filter(
          (entryOfferCode) => entryOfferCode !== offerCode,
        );
        if (upgradePromoOffer) {
          offerList.offerIds = offerList.offerIds.filter(
            (entryOfferCode) => entryOfferCode !== `${offerCode}_upgrade`,
          );
        }
      }
    }
  } else {
    // add
    country.retentionOffers.push(promoOffer);
    if (upgradePromoOffer) {
      country.retentionOffers.push(upgradePromoOffer);
    }
    for (const offerList of offerLists) {
      offerList.offerIds.push(offerCode);
      if (upgradePromoOffer) {
        offerList.offerIds.push(offerCode + '_upgrade');
      }
    }
  }

  return {
    cacheDurationSeconds: config.cacheDurationSeconds,
    comments: `SAMOC: ${remove ? `Removed` : `Added`} ${
      promoOffer.storeOfferId
    } on ${format(new Date(), 'yyyyMMdd-HHmmss')}`,
    configurationValue: JSON.stringify(configValue),
    contentType: config.contentType,
    lastChangedBy: 'FLEX-SAMOC',
  };
};

const modifyDefaultConfigPayload = (
  config: OfferConfiguration,
  regionCode: string,
  payload: any,
): UpdateOfferConfigurationPayload => {
  const configValue: any = JSON.parse(config.configurationValue);
  const country = configValue.countries.find(
    (entry: any) => entry.country.toLowerCase() === regionCode.toLowerCase(),
  );
  if (!country) {
    return null;
  }
  country.enabled = payload.enabled;
  country.primaryOffers = [...payload.primaryOffers];
  country.secondaryOffers = [...payload.secondaryOffers];

  return {
    cacheDurationSeconds: config.cacheDurationSeconds,
    comments: `SAMOC: Changed ${regionCode} region on ${format(
      new Date(),
      'yyyyMMdd-HHmmss',
    )}`,
    configurationValue: JSON.stringify(configValue),
    contentType: config.contentType,
    lastChangedBy: 'FLEX-SAMOC',
  };
};

export const updateGhostLocker = async (
  requestUrl: string,
  payload: UpdateOfferConfigurationPayload,
  token: string,
  env: Env,
  skipRemoteLock = false,
) => {
  if (!skipRemoteLock) {
    await obtainRemoteLock(RemoteSystem.GHOSTLOCKER, env);
  }
  const resp = await axios.post(requestUrl, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!skipRemoteLock) {
    await releaseRemoteLock(RemoteSystem.GHOSTLOCKER, env);
  }
  return resp;
};

export const readGhostLocker = async (
  requestUrl: string,
  payload: UpdateOfferConfigurationPayload,
  token: string,
) => {
  return await axios.post(requestUrl, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

/**
 * promoOfferExists - check to see if offer contains in the GhostLocker config
 *
 * @param offerCode
 * @param regionCode
 * @param env
 * @param existingToken
 */
export const promoOfferExists = async (
  offerCode: string,
  regionCode: string,
  env: Env,
  existingToken?: string,
  returnPayload?: boolean,
): Promise<any> => {
  try {
    // 1. get access token
    let token = existingToken;
    if (!token) {
      token = await getAccessToken(env);
    }
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.PROMO_RECURLY,
      'current',
      token,
      env,
    );
    // 3. check config payload
    const configValue: ConfigurationValue = JSON.parse(
      config.configurationValue,
    );
    const country = configValue.countries.find(
      (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
    );
    const found = country.promotionOffers.find(
      (entry) => entry.storeOfferId === offerCode,
    );
    return returnPayload ? { found, config } : !!found;
  } catch (err) {
    handleError(err, env);
  }
};

/**
 * promoOfferExists - check to see if offer contains in the GhostLocker config
 *
 * @param offerCode
 * @param regionCode
 * @param env
 * @param existingToken
 */
export const retentionOfferExists = async (
  offerCode: string,
  regionCode: string,
  env: Env,
  existingToken?: string,
  returnPayload?: boolean,
): Promise<any> => {
  try {
    // 1. get access token
    let token = existingToken;
    if (!token) {
      token = await getAccessToken(env);
    }
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    // 3. check config payload
    const configValue: RetentionConfigurationValue = JSON.parse(
      config.configurationValue,
    );
    const country = configValue.countries.find(
      (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
    );
    if (!country || !country.retentionOffers) {
      return false;
    }
    const found = country.retentionOffers.find(
      (entry) => entry.storeOfferId === offerCode,
    );
    return returnPayload ? { found, config } : !!found;
  } catch (err) {
    handleError(err, env);
  }
};

export const updateOfferConfig = async (
  offerCode: string,
  offerTypeId: number,
  planCode: string,
  regionCode: string,
  remove: boolean,
  env: Env,
): Promise<UpdateOfferResponse> => {
  const updateOfferOp = async () => {
    // 1. get access token
    const token = await getAccessToken(env);
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.PROMO_RECURLY,
      'current',
      token,
      env,
    );
    // 3. modify config payload
    const updatedConfigPayload = modifyConfigPayload(
      config,
      offerCode,
      offerTypeId,
      planCode,
      regionCode,
      remove,
    );
    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.PROMO_RECURLY)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });
    // 5. update config
    const updateResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.PROMO_RECURLY)}`,
      updatedConfigPayload,
      token,
      env,
    );
    const foundOffer = await promoOfferExists(
      offerCode,
      regionCode,
      env,
      token,
    );
    logger.debug(
      `${logPrefix(env)} Config updated ${
        foundOffer ? 'and confirmed' : 'but not found'
      }`,
      {
        'x-ghostlocker-correlationid':
          updateResp?.headers[GL_COR_ID] || 'Undefined',
        configurationVersion:
          updateResp?.data?.configurationVersion || 'Undefined',
      },
    );
    return updateResp.data as UpdateOfferResponse;
  };
  try {
    return await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const updateRetentionOfferConfig = async (
  lists: string[],
  offerCode: string,
  upgradePlanCode: string | undefined,
  isCouponless: boolean | undefined,
  usersOnPlans: string[],
  regionCode: string,
  remove: boolean,
  env: Env,
): Promise<UpdateOfferResponse> => {
  if (usersOnPlans) {
    usersOnPlans = usersOnPlans.filter((val) => val !== '-');
  }

  const updateOfferOp = async () => {
    // 1. get access token
    const token = await getAccessToken(env);
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    // 3. modify config payload
    const updatedConfigPayload = modifyRetentionConfigPayload(
      config,
      offerCode,
      lists,
      upgradePlanCode,
      isCouponless,
      usersOnPlans,
      regionCode,
      remove,
    );
    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });
    // 5. update config
    const updateResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}`,
      updatedConfigPayload,
      token,
      env,
    );
    const foundOffer = await retentionOfferExists(
      offerCode,
      regionCode,
      env,
      token,
    );
    logger.debug(
      `${logPrefix(env)} Config updated ${
        foundOffer ? 'and confirmed' : 'but not found'
      }`,
      {
        'x-ghostlocker-correlationid':
          updateResp?.headers[GL_COR_ID] || 'Undefined',
        configurationVersion:
          updateResp?.data?.configurationVersion || 'Undefined',
      },
    );
    return updateResp.data as UpdateOfferResponse;
  };
  try {
    return await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const updateDefaultRetentionConfig = async (
  glSetName: GLSet,
  regionCode: string,
  env: Env,
  token: string,
  payload: any,
): Promise<UpdateOfferResponse> => {
  const updateOfferOp = async () => {
    // 1. get access token
    // 2. get current config
    const config = await getConfigOfVersion(glSetName, 'current', token, env);
    // 3. modify config payload
    const updatedConfigPayload = modifyDefaultConfigPayload(
      config,
      regionCode,
      payload,
    );
    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(glSetName)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });
    // 5. update config
    const updateResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(glSetName)}`,
      updatedConfigPayload,
      token,
      env,
    );
    logger.debug(`${logPrefix(env)} Config updated`, {
      'x-ghostlocker-correlationid':
        updateResp?.headers[GL_COR_ID] || 'Undefined',
      configurationVersion:
        updateResp?.data?.configurationVersion || 'Undefined',
    });
    return updateResp.data as UpdateOfferResponse;
  };
  try {
    return await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

/**
 * getRetentionOfferConfig - get full retention offer config
 *
 * @param regionCode
 * @param env
 * @param existingToken
 */
export const getRetentionOfferConfig = async (
  env: Env,
  existingToken?: string,
): Promise<RetentionConfigurationValue> => {
  try {
    // 1. get access token
    let token = existingToken;
    if (!token) {
      token = await getAccessToken(env);
    }
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    // 3. check config payload
    return JSON.parse(config.configurationValue);
  } catch (err) {
    handleError(err, env);
  }
};

/**
 * getRetentionOfferCountry - get full retention offer config
 *
 * @param regionCode
 * @param env
 * @param existingToken
 */
export const getRetentionOfferCountrySlow = async (
  regionCode: string,
  env: Env,
  existingToken?: string,
): Promise<RetentionCountry> => {
  try {
    // 1. get access token
    let token = existingToken;
    if (!token) {
      token = await getAccessToken(env);
    }
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    // 3. check config payload
    const configValue: RetentionConfigurationValue = JSON.parse(
      config.configurationValue,
    );
    return configValue.countries.find(
      (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
    );
  } catch (err) {
    handleError(err, env);
  }
};

export const updateRetentionOfferCountry = async (
  country: RetentionCountry,
  regionCode: string,
  env: Env,
  changedBy: string,
): Promise<UpdateOfferResponse> => {
  const updateCountryOp = async () => {
    // 1. get access token
    const token = await getAccessToken(env);
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    // 3. modify config payload
    const updatedConfigPayload = modifyRetentionFilters(
      config,
      regionCode,
      country,
      changedBy,
    );

    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });

    // 5. update config
    const updateResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}`,
      updatedConfigPayload,
      token,
      env,
    );
    return updateResp.data as UpdateOfferResponse;
  };
  try {
    return await pRetry(updateCountryOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const updateExtensionOfferCountry = async (
  countryCode: string,
  env: Env,
  body: any,
  changedBy: string,
): Promise<any> => {
  const updateCountryOp = async () => {
    // 1. get access token
    const token = await getAccessToken(env);
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.UNIVERSAL,
      'current',
      token,
      env,
    );
    // 3. modify config payload
    let configValue = JSON.parse(config.configurationValue);
    configValue.countries.forEach((country: any) => {
      if (country.countryCode.toLowerCase() === countryCode) {
        country.universalOffers = [...body.universalOffers];
        country.universalOfferTypes = [...body.universalOfferTypes];
      }
    });

    const updatedConfigPayload = {
      cacheDurationSeconds: config.cacheDurationSeconds,
      comments: `SAMOC: Updated extension offers on ${format(
        new Date(),
        'yyyyMMdd-HHmmss',
      )}`,
      configurationValue: JSON.stringify(configValue),
      contentType: config.contentType,
      lastChangedBy: `FLEX-SAMOC on behalf of ${changedBy}`,
    };
    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.UNIVERSAL)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });
    // 5. update config
    return await updateGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.UNIVERSAL)}`,
      updatedConfigPayload,
      token,
      env,
      true,
    );
  };
  try {
    return await pRetry(updateCountryOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const updateRetentionOfferCountries = async (
  countries: Map<string, RetentionCountry>,
  env: Env,
  changedBy: string,
  withResponse?: boolean,
): Promise<any> => {
  const updateCountryOp = async () => {
    // 1. get access token
    const token = await getAccessToken(env);
    // 2. get current config
    const config = await getConfigOfVersion(
      GLSet.RET_RECURLY_V2,
      'current',
      token,
      env,
    );
    let updatedConfigPayload: UpdateOfferConfigurationPayload = config;
    for (const [regionCode, country] of countries) {
      // 3. modify config payload
      if (!!country) {
        updatedConfigPayload = modifyRetentionFilters(
          updatedConfigPayload,
          regionCode,
          country,
          changedBy,
        );
      }
    }
    // 4. validate config
    const validateResp = await readGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}?validateOnly=true`,
      updatedConfigPayload,
      token,
    );
    logger.debug(`${logPrefix(env)} Config Validated`, {
      'x-ghostlocker-correlationid':
        validateResp?.headers[GL_COR_ID] || 'Undefined',
    });

    // 5. update config
    const updateResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}`,
      updatedConfigPayload,
      token,
      env,
    );
    // return updateResp.data as UpdateOfferResponse;
    return !withResponse
      ? updatedConfigPayload
      : [updateResp, updatedConfigPayload];
  };
  try {
    return await pRetry(updateCountryOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const rollbackToVersion = async (
  glSet: GLSet,
  offerCode: string,
  version: number,
  env: Env,
): Promise<UpdateOfferResponse> => {
  const rollbackOp = async () => {
    const token = await getAccessToken(env);
    // check if there are other changes to the config
    const current = await getConfigOfVersion(glSet, 'current', token, env);
    if (current.configurationVersion - version > 1) {
      throw new GhostLockerError(
        `GhostLocker Configuration is outdated on ${env.toUpperCase()}`,
        409,
      );
    }
    const config = await getConfigOfVersion(glSet, version, token, env);
    const rollbackPayload = {
      configurationValue: config.configurationValue,
      comments: `SAMOC: Rollback to version ${version} on ${format(
        new Date(),
        'yyyyMMdd-HHmmss',
      )}`,
      contentType: config.contentType,
      cacheDurationSeconds: config.cacheDurationSeconds,
      lastChangedBy: 'FLEX-SAMOC',
    };
    const rollbackResp = await updateGhostLocker(
      `${getHost(env)}/${configUrl(glSet)}`,
      rollbackPayload,
      token,
      env,
    );
    logger.debug(
      `${logPrefix(
        env,
      )} Configuration rollback successfully to version (${version})`,
      {
        'x-ghostlocker-correlationid':
          rollbackResp?.headers[GL_COR_ID] || 'Undefined',
        configurationVersion:
          rollbackResp?.data?.configurationVersion || 'Undefined',
      },
    );
    return rollbackResp.data as UpdateOfferResponse;
  };
  try {
    return await pRetry(rollbackOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

const handleError = (err: any, env: Env) => {
  logger.error(`${logPrefix(env)} Operation failed, ${err.message}`, err);
  let msg = err.message;
  if (err.response && err.response.status && err.response.status === 401) {
    msg = 'GhostLocker Error - Invalid API Key, unauthorized.';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    msg = 'GhostLocker is busy';
  }
  throw new GhostLockerError(
    `GhostLocker operation failed on ${env.toUpperCase()}, ${msg}`,
    err.statusCode ? err.statusCode : 500,
  );
};

// Disabled due to https://jira.flex.com/browse/SAMOC-135
/*
const generatePlanConfig = async (
  token: string,
  planCode: string,
  remove: boolean,
  env?: Env,
) => {
  const requestUrl =
    env === Env.PROD
      ? prodUrl
      : stgUrl +
        `${version}/applications/playauth/configurations/storekeys:recurly-global/current`;
  try {
    const headers = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const resp = await axios.get(requestUrl, headers);
    const currConfigResp = resp.data;
    logger.debug(`GhostLocker: Retrieved configuration`);
    return patchPlanConfig(currConfigResp, planCode, remove);
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 403) {
        logger.debug(`ERROR: Status = ${status}, Forbidden Request \n ${err}`);
      } else if (status === 404) {
        logger.debug(`ERROR: Status ${status}, Not Found \n ${err}`);
      } else
        logger.debug(
          `ERROR: Status = ${status}, Server Responded improperly \n ${err}`,
        );
    } else if (err.request) {
      logger.debug('No response from server, retrying...');
      axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
    } else {
      logger.debug(`ERROR: Issue with Backend \n ${err}`);
    }
  }
};

const patchPlanConfig = (
  currConfig: any,
  planCode: string,
  remove: boolean,
) => {
  const configValue: any = JSON.parse(currConfig);
  // TODO: dynamically find using region code instead of hard-coding configValue.countries[0]
  if (remove) {
    // remove
    configValue.accounts[1].countries[0].buyFlowPlanCodes = configValue.accounts[1].countries[0].buyFlowPlanCodes.filter(
      function (entry: any) {
        return entry != planCode;
      },
    );
  } else {
    // add
    configValue.accounts[1].countries[0].buyFlowPlanCodes.push(planCode);
  }

  return JSON.stringify(configValue);
};

export const pushUpdatedPlanConfig = async (
  token: string,
  config: any,
  env?: Env,
) => {
  const requestUrl =
    env === Env.PROD
      ? prodUrl
      : stgUrl +
        `${version}/applications/playauth/configurations/storekeys:recurly-global/current`;
  try {
    const headers = {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    };
    const resp = await axios.post(requestUrl, config, headers);
    logger.debug(
      `${logPrefix(env)} Status(${resp.status}) Config Validated Or Updated`,
    );
    return resp.status;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 403) {
        logger.debug(`ERROR: Status = ${status}, Forbidden Request \n ${err}`);
      } else
        logger.debug(
          `ERROR: Status = ${status}, Server Responded improperly \n ${err}`,
        );
    } else if (err.request) {
      logger.debug('No response from server, retrying...');
      axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
    } else {
      logger.debug(`ERROR: Issue with Backend \n ${err}`);
    }
  }
};
*/

export interface UpdateOfferConfigurationPayload {
  configurationValue: string;
  lastChangedBy: string;
  comments: string;
  contentType: string;
  cacheDurationSeconds: number;
}

export interface OfferConfiguration
  extends UpdateOfferConfigurationPayload,
    UpdateOfferResponse {
  configurationSetId: string;
  application: string;
}

export interface UpdateOfferResponse {
  configurationVersion: number;
  lastUpdateDateTime: Date;
}

export interface PromotionOffer {
  storeOfferId: string;
  isForNewUser: boolean;
  planCode: string;
}

export interface Country {
  country: string;
  promotionOffers: PromotionOffer[];
}

export interface ConfigurationValue {
  receiptType: string;
  countries: Country[];
}

export interface RetentionOffer {
  id: string;
  storeOfferId: string;
  forceUserToPlanCode?: string;
  isCouponless?: boolean;
  appliesToUsersOnPlans?: string[];
}

export interface RetentionOfferList {
  name: string;
  offerIds: string[];
}

export interface RetentionOfferUserEligibilityWeightedList {
  listName: string;
  weight: number;
}

export interface RetentionOfferUserEligibilityConditions {
  planLengthInMonths?: number;
  isInFreeTrial?: boolean;
  activeCoupons?: string[];
  inactiveCoupons?: string[];
}

export interface RetentionOfferUserEligibilityOffers {
  primaryOffersLists: RetentionOfferUserEligibilityWeightedList[];
  secondaryOffersLists: RetentionOfferUserEligibilityWeightedList[];
}

export interface RetentionOfferUserEligibility {
  conditions: RetentionOfferUserEligibilityConditions;
  offers: RetentionOfferUserEligibilityOffers;
  exclusiveOfferOverrides?: any;
}

export interface RetentionCountry {
  country: string;
  allowMultipleAcceptedOffers: boolean;
  retentionOffers: RetentionOffer[];
  retentionOffersLists: RetentionOfferList[];
  userEligibility: RetentionOfferUserEligibility[];
}

export interface RetentionConfigurationValue {
  receiptType: string;
  countries: RetentionCountry[];
}

export enum GlOfferType {
  ACQUISITION,
  WINBACK,
  RETENTION,
  RETENTION_UPGRADE,
}

const getPromotionOfferCountrySlow = async (
  regionCode: string,
  env: Env,
  existingToken?: string,
): Promise<Country> => {
  let token = existingToken;
  if (!token) {
    token = await getAccessToken(env);
  }
  const config = await getConfigOfVersion(
    GLSet.PROMO_RECURLY,
    'current',
    token,
    env,
  );
  // 3. check config payload
  const configValue: ConfigurationValue = JSON.parse(config.configurationValue);
  return configValue.countries.find(
    (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
  );
};

export const getGlPromotionOffersSlow = async (
  result: Map<GlOfferType, Set<string>>,
  env: Env,
  regionCode: string,
) => {
  result.set(GlOfferType.ACQUISITION, new Set<string>());
  result.set(GlOfferType.WINBACK, new Set<string>());
  const promoCountry = await getPromotionOfferCountrySlow(regionCode, env);
  if (promoCountry) {
    for (const offer of promoCountry.promotionOffers) {
      if (offer.isForNewUser) {
        result.get(GlOfferType.ACQUISITION).add(offer.storeOfferId);
      } else {
        result.get(GlOfferType.WINBACK).add(offer.storeOfferId);
      }
    }
  }
};

export const getGlRetentionOffersSlow = async (
  result: Map<GlOfferType, Set<string>>,
  env: Env,
  regionCode: string,
) => {
  result.set(GlOfferType.RETENTION, new Set<string>());
  result.set(GlOfferType.RETENTION_UPGRADE, new Set<string>());
  const retentionCountry = await getRetentionOfferCountrySlow(regionCode, env);
  if (retentionCountry && retentionCountry.retentionOffers) {
    for (const offer of retentionCountry.retentionOffers) {
      if (offer.forceUserToPlanCode) {
        result.get(GlOfferType.RETENTION_UPGRADE).add(offer.storeOfferId);
      } else {
        result.get(GlOfferType.RETENTION).add(offer.storeOfferId);
      }
    }
  }
};

// New international API

export const getConfigValue = async (
  glSet: GLSet,
  env: Env,
  token: string,
): Promise<any> => {
  const config = await getConfigOfVersion(glSet, 'current', token, env);
  return JSON.parse(config.configurationValue);
};

const getPromotionOfferCountry = (
  regionCode: string,
  configValue: ConfigurationValue,
): Country => {
  return configValue.countries.find(
    (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
  );
};

export const getRetentionOfferCountry = (
  regionCode: string,
  configValue: RetentionConfigurationValue,
): RetentionCountry => {
  return configValue.countries.find(
    (entry) =>
      !!entry.country &&
      entry.country.toLowerCase() === regionCode.toLowerCase(),
  );
};

export const getGlPromotionOffers = (
  result: Map<GlOfferType, Set<string>>,
  regionCode: string,
  configValue: ConfigurationValue,
): void => {
  result.set(GlOfferType.ACQUISITION, new Set<string>());
  result.set(GlOfferType.WINBACK, new Set<string>());
  const promoCountry = getPromotionOfferCountry(regionCode, configValue);
  if (promoCountry) {
    for (const offer of promoCountry.promotionOffers) {
      if (offer.isForNewUser) {
        result.get(GlOfferType.ACQUISITION).add(offer.storeOfferId);
      } else {
        result.get(GlOfferType.WINBACK).add(offer.storeOfferId);
      }
    }
  }
};

export const getGlRetentionOffers = (
  result: Map<GlOfferType, Set<string>>,
  regionCode: string,
  configValue: RetentionConfigurationValue,
): void => {
  result.set(GlOfferType.RETENTION, new Set<string>());
  result.set(GlOfferType.RETENTION_UPGRADE, new Set<string>());
  const retentionCountry = getRetentionOfferCountry(regionCode, configValue);
  if (retentionCountry && retentionCountry.retentionOffers) {
    for (const offer of retentionCountry.retentionOffers) {
      if (offer.forceUserToPlanCode) {
        result.get(GlOfferType.RETENTION_UPGRADE).add(offer.storeOfferId);
      } else {
        result.get(GlOfferType.RETENTION).add(offer.storeOfferId);
      }
    }
  }
};

export const getGlOffersForEnv = (
  promotionConfigValue: ConfigurationValue,
  retentionConfigValue: RetentionConfigurationValue,
  regionCode: string,
): Map<GlOfferType, Set<string>> => {
  const result = new Map<GlOfferType, Set<string>>();
  getGlPromotionOffers(result, regionCode, promotionConfigValue);
  getGlRetentionOffers(result, regionCode, retentionConfigValue);
  return result;
};

export const getAllGlOffers = (
  stgPromotionConfig: ConfigurationValue,
  stgRetentionConfig: RetentionConfigurationValue,
  prodPromotionConfig: ConfigurationValue,
  prodRetentionConfig: RetentionConfigurationValue,
  regionCode: string,
): Map<Env, Map<GlOfferType, Set<string>>> => {
  const result = new Map<Env, Map<GlOfferType, Set<string>>>();
  result.set(
    Env.STG,
    getGlOffersForEnv(stgPromotionConfig, stgRetentionConfig, regionCode),
  );
  if (prodPromotionConfig && prodRetentionConfig) {
    result.set(
      Env.PROD,
      getGlOffersForEnv(prodPromotionConfig, prodRetentionConfig, regionCode),
    );
  }
  return result;
};

////////////////////////////////////

const getOfferEnv = (offer: { statusId?: number }): Env | null => {
  if (!offer.statusId) {
    return null;
  }
  if (ActiveStgOfferStatuses.has(offer.statusId)) {
    return Env.STG;
  } else if (ActiveProdOfferStatuses.has(offer.statusId)) {
    return Env.PROD;
  }
  return null;
};

export const validateGlPromotionOffer = (
  offer: OfferModel,
  glOffers: Map<GlOfferType, Set<string>>,
): string | null => {
  const env = getOfferEnv(offer);
  if (!env) {
    return null;
  }
  if (offer.offerTypeId === OfferTypes.ACQUISITION) {
    return glOffers.get(GlOfferType.ACQUISITION)?.has(offer.offerCode)
      ? null
      : `Acquisition offer ${
          offer.offerCode
        } not found in ${env.toUpperCase()} GhostLocker`;
  } else if (offer.offerTypeId === OfferTypes.WINBACK) {
    return glOffers.get(GlOfferType.WINBACK)?.has(offer.offerCode)
      ? null
      : `Winback offer ${
          offer.offerCode
        } not found in ${env.toUpperCase()} GhostLocker`;
  } else {
    return `Unknown offer type ${offer.offerTypeId} for offer ${offer.offerCode}`;
  }
};

export const validateGlRetentionOffer = (
  offer: RetentionOfferModel,
  glOffers: Map<GlOfferType, Set<string>>,
): string | null => {
  const env = getOfferEnv(offer);
  if (!env) {
    return null;
  }
  if (!glOffers.get(GlOfferType.RETENTION)?.has(offer.offerCode)) {
    return `Offer not found in ${env.toUpperCase()} GhostLocker`;
  }
  if (
    offer.upgradeOfferCode &&
    !glOffers.get(GlOfferType.RETENTION_UPGRADE)?.has(offer.upgradeOfferCode)
  ) {
    return `Upgrade offer not found in ${env.toUpperCase()} GhostLocker`;
  }
  return null;
};

export const validateSingleGlRetentionOffer = async (
  offer: RetentionOfferModel,
  regionCode: string,
): Promise<string | null> => {
  const env = getOfferEnv(offer);
  if (!env) {
    return null;
  }
  const glOffers = new Map<GlOfferType, Set<string>>();
  await getGlRetentionOffersSlow(glOffers, env, regionCode);
  return validateGlRetentionOffer(offer, glOffers);
};

export const validateSingleGlPromotionOffer = async (
  offer: OfferModel,
  regionCode: string,
): Promise<string | null> => {
  const env = getOfferEnv(offer);
  if (!env) {
    return null;
  }
  const glOffers = new Map<GlOfferType, Set<string>>();
  await getGlPromotionOffersSlow(glOffers, env, regionCode);
  return validateGlPromotionOffer(offer, glOffers);
};

export const checkIncludedInFilter = (
  country: RetentionCountry,
  offerCode: string,
): boolean => {
  if (!country || !country.retentionOffersLists || !country.userEligibility) {
    return false;
  }
  const lists = country.retentionOffersLists
    .filter((list) => list.offerIds.includes(offerCode))
    .map((l) => l.name);
  for (const rule of country.userEligibility) {
    for (const list of rule.offers.primaryOffersLists) {
      if (lists.includes(list.listName)) {
        return true;
      }
    }
    for (const list of rule.offers.secondaryOffersLists) {
      if (lists.includes(list.listName)) {
        return true;
      }
    }
  }
  return false;
};

export const validateGlFilter = (
  env: Env,
  country: RetentionCountry,
  offer: { offerCode: string; upgradeOfferCode?: string },
): string => {
  if (!offer || env !== Env.PROD) {
    return null;
  }
  const offerFilterStatus = checkIncludedInFilter(country, offer.offerCode);
  let upgradeFilterStatus = true;
  if (offer.upgradeOfferCode) {
    upgradeFilterStatus = checkIncludedInFilter(
      country,
      offer.upgradeOfferCode,
    );
  }
  let glValidationWarning: string = null;
  if (!offerFilterStatus && !upgradeFilterStatus) {
    glValidationWarning = `Offer and upgrade offer are not used in ${env.toUpperCase()} filters`;
  } else if (!offerFilterStatus && upgradeFilterStatus) {
    glValidationWarning = `Offer is not used in ${env.toUpperCase()} filters`;
  } else if (offerFilterStatus && !upgradeFilterStatus) {
    glValidationWarning = `Upgrade offer is not used in ${env.toUpperCase()} filters`;
  }
  return glValidationWarning;
};

export const getGLHealth = async (env: Env) => {
  try {
    const glHost =
      env === Env.PROD
        ? process.env.GHOSTLOCKER_PROD
        : process.env.GHOSTLOCKER_STG;
    const resp = await axios.get(`${glHost}/health`);
    logger.debug(`${logPrefix(env)} Checking GhostLocker health`);
    return resp;
  } catch (err) {
    return err;
  }
};
