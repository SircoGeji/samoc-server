import axios from 'axios';
import Logger from '../util/logger';
import {
  generateRandomAlphanumericString,
  getCmsApiEndpoint,
  getConstellationApiUrl,
  getFlexSiteUrl,
  pRetryOptionsForClearCmsApiCache,
  pRetryOptionsForCmsAPIVerifyOffer,
  sleep,
  updateSpinnerText,
} from '../util/utils';
import {
  AppError,
  CmsApiError,
  ValidateGhostLockerError,
} from '../util/errorHandler';
import { Env, OfferTypes } from '../types/enum';
import { validateGl } from './PlayAuth';
import pRetry from 'p-retry';
import {
  CACHE_DELAY,
  IGNORE_CMS_API_ERRORS,
  NODE_ENV,
  SKIP_CLEARCMSAPICACHE,
} from '../util/config';
import * as querystring from 'querystring';
import {
  configUrl,
  getAccessToken,
  getConfigOfVersion,
  getHost,
  getRetentionOfferCountrySlow,
  GLSet,
  modifyRetentionFilters,
  readGhostLocker,
  RetentionConfigurationValue,
  updateGhostLocker,
  UpdateOfferConfigurationPayload,
  updateRetentionOfferCountry,
} from './GhostLocker';
import {
  extractRules,
  updateCountryRules,
} from '../controllers/offers/filters';
import { RetentionOfferUserEligibilityRule } from '../types/payload';
import Moment from 'moment';
import { GL_COR_ID } from '../util/constants';
import { Store } from '../models';
import { StoreModel } from '../models/Store';
import { getPlansForStore } from '../controllers/plans/getAllPlans';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] CmsAPI:`;
  } else {
    return `CmsAPI:`;
  }
};

export const clearCmsApiCache = async (env: Env): Promise<any> => {
  await sleep(CACHE_DELAY);

  const run = async () => {
    const requestUrl = getConstellationApiUrl(NODE_ENV, env);
    logger.debug(`${logPrefix(env)} clearCmsApiCache started`, {
      endpoint: requestUrl,
    });

    let resp;
    if (SKIP_CLEARCMSAPICACHE) {
      await sleep(CACHE_DELAY);
      resp = { status: 200, data: { message: '' } };
    } else {
      resp = await axios.post(requestUrl, {});
    }

    if (resp.status !== 200) {
      logger.error(
        `${logPrefix(env)} Clear Contentful cache unsuccessful > ${
          resp.data.message
        } status: ${resp.status}`,
      );
      throw new AppError(`${resp.data.message}`, resp.status);
    } else {
      logger.debug(`${logPrefix(env)} Clear Contentful cache successfully`);
    }
    return resp;
  };
  let resp;
  try {
    resp = await pRetry(run, pRetryOptionsForClearCmsApiCache); // comment it out to disable CmsAPI call
    // await delay(1000); // uncomment to disable CmsAPI call
  } catch (err) {
    logger.error(
      `${logPrefix(env)} clearCmsApiCache failed, ${err.message}`,
      err,
    );
    // Recently Constellation return Gateway Timeout pretty often, so just ignore it
    if (IGNORE_CMS_API_ERRORS) {
      return null;
    }
    throw new CmsApiError(
      `Clear Contentful cache unsuccessful on ${env.toUpperCase()}: ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
  return resp;
};

export const fetchSpecialOffer = async (
  offerCode: string,
  targetEnv: Env,
  region: string,
  lang: string,
): Promise<any> => {
  const SITE_URL = getFlexSiteUrl(targetEnv, region);
  const url = getFlexSiteUrl(
    targetEnv,
    region,
    getCmsApiEndpoint(NODE_ENV, targetEnv, region, lang, offerCode),
  );
  logger.debug(`${logPrefix(targetEnv)} Starting fetchSpecialOffer`, {
    requestUrl: url,
    referer: `${SITE_URL}/${region}/${lang}/offers`,
  });
  try {
    const response = await axios({
      method: 'GET',
      headers: {
        Referer: `${SITE_URL}/${region}/${lang}/offers`,
      },
      url,
    });
    if (response.status !== 200) {
      throw new AppError(`${response.data.message}`, response.status);
    } else {
      if (
        response &&
        response.data &&
        response.data.couponCode &&
        response.data.couponCode.includes(offerCode)
      ) {
        logger.debug(
          `${logPrefix(targetEnv)} fetchSpecialOffer found and validated`,
          {
            status: response.status,
            url: url,
          },
        );
      } else {
        logger.error(
          `${logPrefix(
            targetEnv,
          )} fetchSpecialOffer failed, (${offerCode}) not found`,
          {
            status: response.status,
            url: url,
          },
        );
        throw new AppError(`(${offerCode}) not found`, response.status);
      }
    }
    logger.debug(`${logPrefix(targetEnv)} fetchSpecialOffer completed`);
    return response;
  } catch (err) {
    throw new AppError(`fetchSpecialOffer failed, ${err.message}`, 500);
  }
};

export const verifyOffer = async (
  region: string,
  offerCode: string,
  upgradeOfferCode: string,
  planCode: string,
  env: Env,
  uniqueOfferCode: string,
  offerType: OfferTypes,
  isVerification: boolean,
  catchAll: boolean,
  usersOnPlans: string[],
): Promise<void> => {
  const SITE_URL = getFlexSiteUrl(env, region);

  const run = async () => {
    logger.debug(`${logPrefix(env)} Verify OfferCode (${offerCode}) begin`, {
      siteUrl: SITE_URL,
    });

    // Step 1) validate GhostLocker
    await validateGl(
      region,
      SITE_URL,
      env,
      offerCode,
      uniqueOfferCode,
      offerType,
    );

    if (offerType != OfferTypes.RETENTION) {
      // Step 2) fetch fetchSpecialOffer
      await fetchSpecialOffer(offerCode, env, region, 'en');
      if (
        offerType === OfferTypes.ACQUISITION &&
        isVerification &&
        (NODE_ENV !== 'prod' || env !== Env.PROD)
      ) {
        await validateAcquisitionOffer(
          offerCode,
          uniqueOfferCode,
          planCode,
          env,
          region,
        );
      }
    } else {
      if (isVerification && (NODE_ENV !== 'prod' || env !== Env.PROD)) {
        await validateRetentionOffer(
          offerCode,
          upgradeOfferCode,
          planCode,
          env,
          region,
          catchAll,
          usersOnPlans,
        );
      }
    }

    logger.debug(`${logPrefix(env)} Verify OfferCode (${offerCode}) succeeded`);
  };

  try {
    await pRetry(run, pRetryOptionsForCmsAPIVerifyOffer); // comment it out to disable CmsAPI call
  } catch (err) {
    logger.error(`${logPrefix(env)} verifyOffer failed, ${err.message}`, err);
    throw new CmsApiError(
      `Verify offer failed on ${env.toUpperCase()}: ${err.message}`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const getAuthToken = async (
  targetEnv: Env,
  region: string,
): Promise<string> => {
  const siteUrl = getFlexSiteUrl(targetEnv, region);

  logger.debug(
    `${logPrefix(targetEnv)} getAuthToken - Getting authentication token`,
  );
  const randomString = generateRandomAlphanumericString(32);
  const url =
    region === 'us'
      ? `${siteUrl}/sapi/header/v1/flex/${region}/${randomString}`
      : `${siteUrl}/sapi/header/v1/lionsgateplus/${region}/${randomString}`;

  const response = await axios({
    method: 'GET',
    headers: {
      'User-Agent': 'Chrome/85',
      Referer: `${siteUrl}/${region}/en/offers`,
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
    throw new ValidateGhostLockerError(response.data.message, response.status);
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

const SAMOC_FIRST_NAME = 'SAMOC';
const SAMOC_LAST_NAME = 'SAMOC';
const SAMOC_PASSWORD = 'Password';
const CC_NUMBER = '4111111111111111';
const CC_CVV = '737';
const CC_MONTH = 3;
const CC_YEAR = 30;
const RECURLY_API_URL = 'https://api.recurly.com/js/v1/';

const getPublicRecurlyKey = async (
  env: Env,
  storeModel: StoreModel,
): Promise<string> => {
  if (storeModel) {
    if (env == Env.STG) {
      return storeModel.rlyPublicApiKeyStg;
    } else {
      return storeModel.rlyPublicApiKeyProd;
    }
  }
  return null;
};

const getRegionIp = async (storeModel: StoreModel): Promise<string> => {
  if (storeModel) {
    return storeModel.ipAddress;
  }
  return null;
};

const getUpgradePlan = async (storeModel: StoreModel) => {
  const plans = await getPlansForStore(storeModel);
  for (const plan of plans) {
    if (plan.billingCycleDuration == 1) {
      return plan.planCode;
    }
  }
  return null;
};

export const getRecurlyToken = async (
  region: string,
  publicKey: string,
  storeModel: StoreModel,
): Promise<string> => {
  const formData: any = {
    first_name: SAMOC_FIRST_NAME,
    last_name: SAMOC_LAST_NAME,
    postal_code: storeModel.postalCode,
    country: region,
    token: '',
    number: CC_NUMBER,
    month: CC_MONTH,
    year: CC_YEAR,
    cvv: CC_CVV,
    key: publicKey,
  };

  //TODO: store it in DB?
  if (region === 'br') {
    formData.tax_identifier_type = 'cpf';
    formData.tax_identifier = '686.713.296-07';
  }

  logger.debug(`getRecurlyToken - Getting Recurly user token`);

  const url = `${RECURLY_API_URL}/token`;

  const response = await axios.post(url, querystring.stringify(formData), {
    validateStatus: null,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (response.status !== 200) {
    logger.error(` getRecurlyToken - Failed to get user creation token`, {
      url: url,
      formData: formData,
      status: response.status,
    });
    throw new ValidateGhostLockerError(
      "Can't create Recurly user creation token",
      response.status,
    );
  } else if (!response.data['id']) {
    logger.error(` getRecurlyToken - Invalid Recurly response`, {
      url: url,
      formData: formData,
      status: response.status,
    });
    throw new ValidateGhostLockerError(
      "Can't create Recurly user creation token",
      500,
    );
  } else {
    logger.debug(`getRecurlyToken - Got Recurly token successfully`, {
      url: url,
      response: response.data,
    });
    return response.data['id'];
  }
};

export const createUser = async (
  targetEnv: Env,
  planCode: string,
  authToken: string,
  recurlyToken: string,
  regionIp: string,
  region: string,
  isUpgrade: boolean,
  storeModel: StoreModel,
  promotion = '',
  uniqueOfferCode = '',
): Promise<string> => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/StoreUser/New`;
  const timestamp = Moment().format('YYYYMMDDhhmmss');
  const email = isUpgrade
    ? `SAMOC-${region}-${timestamp}-upgrade@SAMOC.com`
    : `SAMOC-${region}-${timestamp}@SAMOC.com`;
  const receipt: any = {
    RecurlyToken: recurlyToken,
    BillingPostalCode: storeModel.postalCode,
    userId: email,
    PlanCode: planCode,
  };
  if (uniqueOfferCode) {
    receipt.Coupon = uniqueOfferCode;
  } else if (promotion) {
    receipt.Promotion = promotion;
  }
  const payload = {
    emailAddress: email,
    password: SAMOC_PASSWORD,
    firstName: SAMOC_FIRST_NAME,
    lastName: SAMOC_LAST_NAME,
    receipt: {
      receiptType: 'Recurly',
      receiptRaw: JSON.stringify(receipt),
    },
    captchaResponse: 'invalid',
  };
  const response = await axios.post(url, payload, {
    validateStatus: null,
    headers: {
      AuthTokenAuthorization: authToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
      'X-PA-Bypass-Secure-User-Creation-Login': true,
    },
  });
  if (response.status !== 200) {
    logger.error(`${logPrefix(targetEnv)} createUser failed`, {
      status: response.status,
      url: url,
      payload: payload,
    });
    throw new ValidateGhostLockerError(
      "Can't create Recurly user creation token",
      response.status,
    );
  } else {
    logger.debug(`createUser - User created successfully`, {
      url,
      payload,
      response: response.data,
    });
  }
  return email;
};

export const userLogin = async (
  targetEnv: Env,
  email: string,
  authToken: string,
  regionIp: string,
) => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/StoreUser/Login`;
  const payload = {
    emailAddress: email,
    password: SAMOC_PASSWORD,
  };
  const response = await axios.post(url, payload, {
    validateStatus: null,
    headers: {
      AuthTokenAuthorization: authToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
    },
  });
  if (response.status !== 200) {
    logger.error(`${logPrefix(targetEnv)} userLogin - Failed to log in`, {
      url: url,
      payload: payload,
      status: response.status,
    });
    throw new ValidateGhostLockerError(
      `Failed to login as ${email}`,
      response.status,
    );
  } else {
    logger.debug(`${logPrefix(targetEnv)} userLogin - Logged in successfully`, {
      url: url,
      payload: payload,
      response: response.data,
    });
  }
};

export const getSessionToken = async (
  targetEnv: Env,
  authToken: string,
  regionIp: string,
): Promise<string> => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/Token`;
  const response = await axios.get(url, {
    validateStatus: null,
    headers: {
      AuthTokenAuthorization: authToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
    },
  });
  if (response.status !== 200) {
    logger.error(
      `${logPrefix(targetEnv)} getLoginToken - Failed to get session token`,
      { url: url, status: response.status },
    );
    throw new ValidateGhostLockerError(
      'Failed to get session token',
      response.status,
    );
  } else if (!response.data['playSessionToken']) {
    logger.error(
      `${logPrefix(targetEnv)} getLoginToken - Failed to get session token`,
      { url: url, response: response.data, status: response.status },
    );
    throw new ValidateGhostLockerError('Failed to get session token', 500);
  } else {
    logger.debug(
      `${logPrefix(
        targetEnv,
      )} getSessionToken - Got session token successfully`,
      { url: url, authToken: response.data },
    );
    return response.data['playSessionToken'];
  }
};

export const getRetentionOffers = async (
  targetEnv: Env,
  sessionToken: string,
  regionIp: string,
  region: string,
): Promise<any> => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/user/Offers/retentions`;
  const refererUrl = getFlexSiteUrl(targetEnv, region);
  const response = await axios.get(url, {
    validateStatus: null,
    headers: {
      SessionTokenAuthorization: sessionToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
      Referer: refererUrl,
      'Response-Version': 2,
    },
  });
  if (response.status !== 200) {
    logger.error(
      `${logPrefix(
        targetEnv,
      )} getAccountDetails - Failed to get account details`,
      { url: url, status: response.status },
    );
    throw new ValidateGhostLockerError(
      "Can't get account details",
      response.status,
    );
  } else {
    logger.debug(
      `${logPrefix(targetEnv)} getRetentionOffers - Got retention offers`,
      { url: url, response: response.data },
    );
    return response.data;
  }
};

export const acceptRetentionOffer = async (
  targetEnv: Env,
  offerCode: string,
  sessionToken: string,
  regionIp: string,
  region: string,
) => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/user/Offers/retention`;
  const refererUrl = getFlexSiteUrl(targetEnv, region);
  const payload = {
    storeOfferId: offerCode,
  };

  const response = await axios.put(url, payload, {
    validateStatus: null,
    headers: {
      SessionTokenAuthorization: sessionToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
      Referer: refererUrl,
    },
  });
  if (response.status < 200 || response.status >= 300) {
    logger.error(
      `${logPrefix(
        targetEnv,
      )} acceptRetentionOffer - Can't accept retention offer`,
      {
        url: url,
        payload: payload,
        response: response.data,
        status: response.status,
      },
    );
    throw new ValidateGhostLockerError(
      `Can't accept retention offer ${offerCode}`,
      response.status,
    );
  } else {
    logger.debug(
      `${logPrefix(
        targetEnv,
      )} acceptRetentionOffer - offer accepted successfully`,
      {
        url: url,
        payload: payload,
        response: response.data,
      },
    );
  }
};

export const getAccountDetails = async (
  targetEnv: Env,
  sessionToken: string,
  regionIp: string,
): Promise<any> => {
  const playAuthUrl =
    targetEnv === Env.PROD
      ? process.env.PLAYAUTH_PROD
      : process.env.PLAYAUTH_STG;

  const url = `${playAuthUrl}/api/v4/StoreUser/AccountDetails`;
  const response = await axios.get(url, {
    validateStatus: null,
    headers: {
      SessionTokenAuthorization: sessionToken,
      'X-Forwarded-For': regionIp,
      'X-PA-OverrideCF': regionIp,
    },
  });
  if (response.status !== 200) {
    logger.error(
      `${logPrefix(
        targetEnv,
      )} getAccountDetails - Failed to get account details`,
      { url: url, status: response.status },
    );
    throw new ValidateGhostLockerError(
      "Can't get account details",
      response.status,
    );
  } else {
    logger.debug(
      `${logPrefix(
        targetEnv,
      )} getAccountDetails - Got account details successfully`,
      { url: url, response: response.data },
    );
    return response.data;
  }
};

const addCatchAllRule = async (
  env: Env,
  regionCode: string,
  offers: string[],
) => {
  const country = await getRetentionOfferCountrySlow(regionCode, env as Env);
  const validationRule: RetentionOfferUserEligibilityRule = {
    name: 'SAMOC Offer Validation',
    primaryLists: [{ name: 'Main', weight: 100, offers }],
    secondaryLists: [],
  };

  const rules = extractRules(country);
  const savedRules = JSON.stringify(rules);
  const updatedRules = [validationRule, ...rules];
  updateCountryRules(country, updatedRules);
  await updateRetentionOfferCountry(
    country,
    regionCode,
    env,
    'SAMOC Offer Validation (Create)',
  );
  return savedRules;
};

const restoreCountryRules = async (
  env: Env,
  regionCode: string,
  countryRules: string,
) => {
  const country = await getRetentionOfferCountrySlow(regionCode, env as Env);
  updateCountryRules(country, JSON.parse(countryRules));
  await updateRetentionOfferCountry(
    country,
    regionCode,
    env,
    'SAMOC Offer Validation (Restore)',
  );
};

export interface SavedRules {
  regionCode: string;
  rules: string;
}

export const addCatchAllRules = async (
  env: Env,
  countries: {
    regionCode: string;
    offers: string[];
  }[],
): Promise<SavedRules[]> => {
  const token = await getAccessToken(env);
  // 2. get current config
  let config: UpdateOfferConfigurationPayload = await getConfigOfVersion(
    GLSet.RET_RECURLY_V2,
    'current',
    token,
    env,
  );
  const configValue: RetentionConfigurationValue = JSON.parse(
    config.configurationValue,
  );
  const savedRules: SavedRules[] = [];
  for (const c of countries) {
    const country = configValue.countries.find(
      (entry) => entry.country.toLowerCase() === c.regionCode.toLowerCase(),
    );
    const validationRule: RetentionOfferUserEligibilityRule = {
      name: 'SAMOC Offer Validation',
      primaryLists: [{ name: 'Main', weight: 100, offers: c.offers }],
      secondaryLists: [],
    };

    const rules = extractRules(country);
    savedRules.push({ regionCode: c.regionCode, rules: JSON.stringify(rules) });
    const updatedRules = [validationRule, ...rules];
    updateCountryRules(country, updatedRules);

    config = modifyRetentionFilters(
      config,
      c.regionCode,
      country,
      'SAMOC Offer Validation (Create)',
    );
  }
  // 4. validate config
  const validateResp = await readGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}?validateOnly=true`,
    config,
    token,
  );
  logger.debug(`${logPrefix(env)} Config Validated`, {
    'x-ghostlocker-correlationid':
      validateResp?.headers[GL_COR_ID] || 'Undefined',
  });

  // 5. update config
  await updateGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}`,
    config,
    token,
    env,
  );
  return savedRules;
};

export const restoreConfigurationValue = async (
  env: Env,
  savedRules: SavedRules[],
) => {
  const token = await getAccessToken(env);
  // 2. get current config
  let config: UpdateOfferConfigurationPayload = await getConfigOfVersion(
    GLSet.RET_RECURLY_V2,
    'current',
    token,
    env,
  );
  const configValue: RetentionConfigurationValue = JSON.parse(
    config.configurationValue,
  );
  for (const countryRules of savedRules) {
    const country = configValue.countries.find(
      (entry) =>
        entry.country.toLowerCase() === countryRules.regionCode.toLowerCase(),
    );
    updateCountryRules(country, JSON.parse(countryRules.rules));

    config = modifyRetentionFilters(
      config,
      countryRules.regionCode,
      country,
      'SAMOC Offer Validation (Restore)',
    );
  }
  // 4. validate config
  const validateResp = await readGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}?validateOnly=true`,
    config,
    token,
  );
  logger.debug(`${logPrefix(env)} Config Validated`, {
    'x-ghostlocker-correlationid':
      validateResp?.headers[GL_COR_ID] || 'Undefined',
  });

  // 5. update config
  await updateGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.RET_RECURLY_V2)}`,
    config,
    token,
    env,
  );
  return savedRules;
};

export const validateRetentionOffer = async (
  offerCode: string,
  upgradeOfferCode: string,
  planCode: string,
  targetEnv: Env,
  region: string,
  catchAll: boolean,
  usersOnPlans: string[],
): Promise<any> => {
  let email = '';
  let accountDetails;
  let savedCountryRules = null;
  const prefix = region.toUpperCase() + ': ';
  const storeModel: StoreModel = await Store.findByPk(`flex-web-${region}`);
  try {
    // Setup catch all rule
    const recurlyPublicKey = await getPublicRecurlyKey(targetEnv, storeModel);
    const regionIp = await getRegionIp(storeModel);

    if (!recurlyPublicKey || !regionIp) {
      // Skip validation
      // TODO: add some reporting
      return;
    }
    if (catchAll) {
      updateSpinnerText(prefix + 'Add test offer to filters...');
      savedCountryRules = await addCatchAllRule(
        targetEnv,
        region,
        upgradeOfferCode ? [offerCode, upgradeOfferCode] : [offerCode],
      );
    }

    if (offerCode) {
      accountDetails = await pRetry(
        async () => {
          // Check retention offer
          updateSpinnerText(prefix + 'Get PlayAuth token...');
          const authToken = await getAuthToken(targetEnv, region);
          updateSpinnerText(prefix + 'Get Recurly token...');
          const recurlyToken = await getRecurlyToken(
            region,
            recurlyPublicKey,
            storeModel,
          );
          updateSpinnerText(prefix + 'Create user...');
          email = await createUser(
            targetEnv,
            planCode,
            authToken,
            recurlyToken,
            regionIp,
            region,
            false,
            storeModel,
          );
          updateSpinnerText(prefix + 'Get session token...');
          const sessionToken = await getSessionToken(
            targetEnv,
            authToken,
            regionIp,
          );
          updateSpinnerText(prefix + 'Get available offers...');
          const availableOffers = await getRetentionOffers(
            targetEnv,
            sessionToken,
            regionIp,
            region,
          );
          // TODO - check offer is available
          updateSpinnerText(prefix + 'Accept test offer...');
          await acceptRetentionOffer(
            targetEnv,
            offerCode,
            sessionToken,
            regionIp,
            region,
          );
          updateSpinnerText(prefix + 'Check account details...');
          return await getAccountDetails(targetEnv, sessionToken, regionIp);
        },
        {
          onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
            logger.warn('Failed retention offer validation', { error });
          },
          retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
        },
      );
      if (accountDetails['retentionCodeAccepted'] !== offerCode) {
        throw new ValidateGhostLockerError(
          `Offer code ${offerCode} was not accepted for user ${email}`,
          500,
        );
      }
    }
    if (upgradeOfferCode) {
      // Check upgrade retention offer
      accountDetails = await pRetry(
        async () => {
          updateSpinnerText(prefix + 'Upgrade: Get PlayAuth token...');
          const authToken = await getAuthToken(targetEnv, region);
          updateSpinnerText(prefix + 'Upgrade: Get Recurly token...');
          const recurlyToken = await getRecurlyToken(
            region,
            recurlyPublicKey,
            storeModel,
          );
          updateSpinnerText(prefix + 'Upgrade: Create user...');
          // TODO (i18n): select 1MO NFT plan
          const upgradePlan = usersOnPlans
            ? usersOnPlans[0]
            : await getUpgradePlan(storeModel);
          email = await createUser(
            targetEnv,
            upgradePlan,
            authToken,
            recurlyToken,
            regionIp,
            region,
            true,
            storeModel,
          );
          updateSpinnerText(prefix + 'Upgrade: Get session token...');
          const sessionToken = await getSessionToken(
            targetEnv,
            authToken,
            regionIp,
          );
          updateSpinnerText(prefix + 'Upgrade: Get available offers...');
          const availableOffers = await getRetentionOffers(
            targetEnv,
            sessionToken,
            regionIp,
            region,
          );
          // TODO - check offers is available
          updateSpinnerText(prefix + 'Upgrade: Accept test offer...');
          await acceptRetentionOffer(
            targetEnv,
            upgradeOfferCode,
            sessionToken,
            regionIp,
            region,
          );
          updateSpinnerText(prefix + 'Upgrade: Check account details...');
          return await getAccountDetails(targetEnv, sessionToken, regionIp);
        },
        {
          onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
            logger.warn('Failed retention offer validation', { error });
          },
          retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
        },
      );

      if (accountDetails['retentionCodeAccepted'] !== upgradeOfferCode) {
        throw new ValidateGhostLockerError(
          `Offer code ${upgradeOfferCode} was not accepted for user ${email}`,
          500,
        );
      }
    }
  } catch (err) {
    throw new AppError(`validateRetentionOffer failed, ${err.message}`, 500);
  } finally {
    if (savedCountryRules) {
      try {
        updateSpinnerText(prefix + 'Restore cancellation offers...');
        await restoreCountryRules(targetEnv, region, savedCountryRules);
      } catch (err) {
        logger.error(
          `${logPrefix(
            targetEnv,
          )} validateRetentionOffer - Can't restore recurly filters data: ${
            err.message
          }`,
        );
      }
    }
  }
};

export const validateAcquisitionOffer = async (
  offerCode: string,
  uniqueOfferCode: string,
  planCode: string,
  targetEnv: Env,
  region: string,
): Promise<any> => {
  let email = '';
  let accountDetails;
  const prefix = region.toUpperCase() + ': ';
  const storeModel: StoreModel = await Store.findByPk(`flex-web-${region}`);
  try {
    // Setup catch all rule
    const recurlyPublicKey = await getPublicRecurlyKey(targetEnv, storeModel);
    const regionIp = await getRegionIp(storeModel);

    if (!recurlyPublicKey || !regionIp) {
      // Skip validation
      // TODO: add some reporting
      return;
    }

    accountDetails = await pRetry(
      async () => {
        // Check retention offer
        updateSpinnerText(prefix + 'Get PlayAuth token...');
        const authToken = await getAuthToken(targetEnv, region);
        updateSpinnerText(prefix + 'Get Recurly token...');
        const recurlyToken = await getRecurlyToken(
          region,
          recurlyPublicKey,
          storeModel,
        );
        updateSpinnerText(prefix + 'Create user...');
        email = await createUser(
          targetEnv,
          planCode,
          authToken,
          recurlyToken,
          regionIp,
          region,
          false,
          storeModel,
          offerCode,
          uniqueOfferCode,
        );
        updateSpinnerText(prefix + 'Get session token...');
        const sessionToken = await getSessionToken(
          targetEnv,
          authToken,
          regionIp,
        );
        updateSpinnerText(prefix + 'Check account details...');
        return await getAccountDetails(targetEnv, sessionToken, regionIp);
      },
      {
        onFailedAttempt: (error: pRetry.FailedAttemptError): void => {
          logger.warn('Failed offer validation', { error });
        },
        retries: parseInt(process.env.SERVICE_RETRY_COUNT) || 3,
      },
    );
    if (accountDetails.recurlySubDetails?.planCode !== planCode) {
      throw new ValidateGhostLockerError(
        `Invalid plan code ${accountDetails['storeProductId']} for offer code ${offerCode} for user ${email} - ${planCode} expected`,
        500,
      );
    }
  } catch (err) {
    throw new AppError(`validateRetentionOffer failed, ${err.message}`, 500);
  }
};
