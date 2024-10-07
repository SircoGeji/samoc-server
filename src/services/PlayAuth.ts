import Logger from '../util/logger';
import axios from 'axios';
import pRetry from 'p-retry';
import { Env, OfferTypes } from '../types/enum';
import * as GhostLocker from '../services/GhostLocker';
import { GLSet } from '../services/GhostLocker';
import { StoreModel } from '../models/Store';
import { PlayAuthError, ValidateGhostLockerError } from '../util/errorHandler';
import {
  generateRandomAlphanumericString,
  pRetryOptions,
  pRetryOptionsForValidateGL,
  sleep,
} from '../util/utils';
import { PA_COR_ID } from '../util/constants';
import { CACHE_DELAY } from '../util/config';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] PlayAuth:`;
  } else {
    return `PlayAuth:`;
  }
};

const getHost = (env: Env): string => {
  const paHost =
    env === Env.PROD ? process.env.PLAYAUTH_PROD : process.env.PLAYAUTH_STG;
  return `${paHost}/api`;
};

const getVersionHost = (env: Env): string => {
  return `${getHost(env)}/v${process.env.PLAYAUTH_API_VERSION}`;
};

export const getAccessToken = async (env: Env): Promise<string> => {
  const resp = await axios.post(
    `${getVersionHost(env)}/Auth/client`,
    `\"${
      env === Env.PROD
        ? process.env.PLAYAUTH_PROD_API_KEY
        : process.env.PLAYAUTH_STG_API_KEY
    }\"`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  logger.debug(`${logPrefix(env)} Retrieved authentication token`, {
    'x-play-correlation-id':
      resp?.headers && resp?.headers[PA_COR_ID]
        ? resp?.headers[PA_COR_ID]
        : 'Undefined',
  });
  return resp.data.token;
};

const getCacheSuffix = async (env: Env) => {
  logger.debug(`${logPrefix(env)} Getting Version Number`);
  const requestUrl = `${getHost(env)}/health`;
  const resp = await axios.get(requestUrl);
  //TODO: improve the following logic in case it doesn't return as [3]rd element
  const cacheSuffix: string = resp.data.HealthChecks[0].Results[3].Details;
  logger.debug(`${logPrefix(env)} Retrieved cache suffix '${cacheSuffix}'`, {
    requestUrl: requestUrl,
    cacheSuffix: cacheSuffix,
    'x-play-correlation-id': resp?.headers[PA_COR_ID] || 'Undefined',
  });
  return cacheSuffix;
};

const deleteCache = async (
  prefix: string,
  key: string,
  cacheSuffix: string,
  token: string,
  env: Env,
) => {
  const requestUrl = `${getVersionHost(
    env,
  )}/admin/cache/allregions?prefix=${prefix}&key=${key}${cacheSuffix}`;
  logger.debug(`${logPrefix(env)} deleteCache starting for ${prefix}`, {
    requestUrl,
  });
  const headers = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  const response = await axios.delete(requestUrl, headers);
  const status = response.status ? response.status : 0;
  logger.debug(`${logPrefix(env)} deleteCache ended for ${prefix}`, {
    statusCode: status,
    requestUrl: requestUrl,
    'x-play-correlation-id': response?.headers[PA_COR_ID] || 'Undefined',
  });
};

export const clearOfferCache = async (
  store: StoreModel,
  env: Env,
  glSet: GLSet = GLSet.PROMO_RECURLY,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} clearOfferCache tasks started`);
  const clearCacheOp = async () => {
    // get cache suffix
    const cacheSuffix = await getCacheSuffix(env);
    const token = await getAccessToken(env);
    // delete Promo Offers
    await deleteCache(
      'DigitalLocker',
      GhostLocker.CONFIG_SET_ID[glSet],
      cacheSuffix,
      token,
      env,
    );
    // delete Recurly Coupons
    let recurlySetId = `RecurlyCoupons:${store.rlySubdomainStg}`;
    if (env === Env.PROD) {
      recurlySetId = `RecurlyCoupons:${store.rlySubdomainProd}`;
    }
    await deleteCache(`RecurlyStore`, recurlySetId, cacheSuffix, token, env);
    await sleep(CACHE_DELAY);
  };
  try {
    await pRetry(clearCacheOp, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} Failed to clear PlayAuth cache, ${err.message}`,
      err,
    );
    throw new PlayAuthError(
      `Failed to clear PlayAuth cache on ${env.toUpperCase()}, ${err.message}`,
      err.statusCode ? err.statusCode : 400,
    );
  } finally {
    logger.debug(`${logPrefix(env)} clearOfferCache tasks ended`);
  }
};

// Disabled due to https://jira.flex.com/browse/SAMOC-135
export const deletePlanCache = async (env?: Env) => {
  /*
  const cacheSuffix = await getCacheSuffix();
  const subdomain = env === Env.PROD ? prodSubdomain : stgSubdomain;
  const cache1Url =
    env === Env.PROD
      ? prodUrl
      : stgUrl +
        `v${version}/admin/cache?prefix=RecurlyStore&key=RecurlyPlans:${subdomain}${cacheSuffix}`;
  try {
    const token = await getAccessToken();
    const headers = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    await axios.delete(cache1Url, headers);
    logger.debug(`${logPrefix(env)} Deleted cache`);
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      logger.debug(
        `ERROR: Status = ${status}, Server Responded improperly \n ${err}`,
      );
    } else if (err.request) {
      logger.debug('ERROR: No response from server, retrying...`);
      axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
    } else {
      logger.debug(`ERROR: Issue with Backend \n ${err}`);
    }
  }
   */
};

// Disabled due to https://jira.flex.com/browse/SAMOC-135
export const clearPlanCache = async (
  planCode: string,
  remove: boolean,
  env?: Env,
) => {
  /* Preventing access to GL and PlayAuth until further notice.
  logger.debug('GhostLocker tasks started `);
  const gToken = await GhostLocker.getAccessToken(env);
  const gConfig: any = await GhostLocker.generatePlanConfig(
    gToken,
    planCode,
    remove,
    env,
  );
  const status = await GhostLocker.pushUpdatedPlanConfig(gToken, gConfig, env);
  */
};

// currently creating offer code on samoc, and trying to validate against
// this endpoint https://auth-clndev.flex.com/ will return 404 not found
// it works normally if we try a code like 'disneyplus'
// either there is another endpoint for this, or it's not been created on clndev?
export const validateGl = async (
  region: string,
  siteUrl: string,
  targetEnv: Env,
  offerCode: string,
  uniqueOfferCode?: string,
  offerType: OfferTypes = OfferTypes.ACQUISITION,
): Promise<void> => {
  logger.debug(`${logPrefix(targetEnv)} Validate GL task started`);

  const getAuthToken = async (): Promise<string> => {
    logger.debug(
      `${logPrefix(targetEnv)} getAuthToken - Getting authentication token`,
    );
    const randomString = generateRandomAlphanumericString(32);
    const url = region === 'us'
      ? `${siteUrl}/sapi/header/v1/flex/${region}/${randomString}`
      : `${siteUrl}/sapi/header/v1/lionsgateplus/${region}/${randomString}`;

    const response = await axios({
      method: 'GET',
      headers: {
        'User-Agent': 'Chrome/85',
        Referer: `${siteUrl}/us/${region}/offers`,
      },
      url,
    });

    if (response.status !== 200) {
      logger.error(
        `${logPrefix(
          targetEnv,
        )} getAuthToken - Failed to get authentication token`,
        { url: url, status: response.status },
      );
      throw new ValidateGhostLockerError(
        response.data.message,
        response.status,
      );
    } else {
      logger.debug(
        `${logPrefix(
          targetEnv,
        )} getAuthToken - Got authentication token successfully`,
        { url: url, authToken: response.data },
      );
      return response.data;
    }
  };

  const PLAYAUTH_API =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const resource =
    offerType == OfferTypes.RETENTION ? 'status' : 'promotiondetails';
  const run = async () => {
    const url = uniqueOfferCode
      ? `${PLAYAUTH_API}/api/v4/Coupon/${resource}/${uniqueOfferCode}`
      : `${PLAYAUTH_API}/api/v4/Coupon/${resource}/${offerCode}`;
    const tokenHeader = await getAuthToken();
    logger.debug(`${logPrefix(targetEnv)} validateGl run`, { url: url });
    const response = await axios({
      method: 'GET',
      headers: { Authtokenauthorization: tokenHeader },
      url,
    });
    if (response.status !== 200) {
      logger.error(`${logPrefix(targetEnv)} validateGl failed`, {
        url: url,
        statusCode: response.status,
        'x-play-correlation-id': response?.headers[PA_COR_ID] || 'Undefined',
      });
      throw new ValidateGhostLockerError(
        response.data.message,
        response.status,
      );
    } else {
      if (
        uniqueOfferCode &&
        response.data.couponDetails.couponCode !== uniqueOfferCode
      ) {
        throw new ValidateGhostLockerError(
          `Expected ${uniqueOfferCode} to match with ${response.data.couponDetails.couponCode}`,
          response.status,
        );
      }
      const receivedCouponCode =
        offerType == OfferTypes.RETENTION
          ? response.data.couponCode
          : response.data.couponDetails.couponCode;
      if (!uniqueOfferCode && receivedCouponCode !== offerCode) {
        throw new ValidateGhostLockerError(
          `Expected ${offerCode} to match with ${receivedCouponCode}`,
          response.status,
        );
      }
      logger.debug(`${logPrefix(targetEnv)} validateGl passed`, {
        url: url,
        statusCode: response.status,
        'x-play-correlation-id': response?.headers[PA_COR_ID] || 'Undefined',
      });
    }
  };

  try {
    await pRetry(run, pRetryOptionsForValidateGL);
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} Validate GL task failed, ${err.message}`,
      err,
    );
    throw new ValidateGhostLockerError(
      `Validate GL failed on ${targetEnv.toUpperCase()}, ${err.message}`,
      err?.statusCode || err.response?.status || 500,
    );
  } finally {
    logger.debug(`${logPrefix(targetEnv)} Validate GL task ended`);
  }
};
