import * as recurly from 'recurly';
import { CouponDiscountPricing, PlanMini, PlanPricing } from 'recurly';
import axios from 'axios';
import pRetry from 'p-retry';
import { OfferModel } from '../models/Offer';
import Logger from '../util/logger';
import {
  CodeType,
  DiscountType,
  DurationType,
  Env,
  OfferTypes,
  RecurlyCouponState,
  SlackConfigType,
  StatusEnum,
  WorkflowAction,
} from '../types/enum';
import { AppError, RecurlyError } from '../util/errorHandler';
import { StoreModel } from '../models/Store';
import { PlanAttributes, PlanModel } from '../models/Plan';
import {
  CouponCreationPayload,
  CouponUpdatePayload,
  PlanCreationPayload,
  PlanUpdatePayload,
  RecurlyCredential,
} from '../types/recurly';
import {
  addExtraCodes,
  addOfferToWorkflowQueue,
  createRecurlyClient,
  generateOfferUrl,
  getRecurlyCredential,
  getRegionDefaultLang,
  pRetryOptions,
  removeOfferFromWorkflowQueue,
  sanitizeUnit,
} from '../util/utils';
import {
  ExtensionOfferRecurlyPayload,
  OfferRecurlyPayload,
  OfferRecurlyResponsePayload,
  PlanRecurlyPayload,
  RetentionOfferRecurlyPayload,
} from '../types/payload';
import { io } from '../server';
import { RetentionOfferModel } from '../models/RetentionOffer';
import {
  getRetentionOfferCountrySlow,
  GlOfferType,
  RetentionCountry,
  validateGlFilter,
  validateGlPromotionOffer,
  validateGlRetentionOffer,
  validateSingleGlRetentionOffer,
} from './GhostLocker';
import { Region, SlackConfig } from '../models';
import { getExpireOfferSlackChatMessage, publishSlackMessage } from './Slack';
import { SlackConfigModel } from 'src/models/SlackConfig';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Recurly:`;
  } else {
    return `Recurly:`;
  }
};

const UNIQUE_CODE_TEMPLATE = '**********'; // 10 random alphanumeric chars

export const getOffersRecurlyPayload = async (
  offers: OfferModel[],
  store: StoreModel,
  env: Env,
  glOffers: Map<GlOfferType, Set<string>>,
): Promise<OfferRecurlyResponsePayload[]> => {
  const perform = async (): Promise<OfferRecurlyResponsePayload[]> => {
    const currency = await getCurrency(store);
    const languageCode = await getRegionDefaultLang(store.regionCode);
    const couponIds = offers.map((of) => of.couponId);
    const recurlyCredential = getRecurlyCredential(store, env);
    if (!recurlyCredential.apiKey) {
      return [];
    }
    const batches = [];
    const results = [];
    const apiLimit = 200; // this should not be set to 0 > infinite loop
    for (let i = 0; i < couponIds.length; i += apiLimit) {
      batches.push(couponIds.slice(i, i + apiLimit));
    }
    for (const ids of batches) {
      const coupons = createRecurlyClient(
        recurlyCredential.apiKey,
      ).listCoupons({ ids: ids });
      for await (const coupon of coupons.each()) {
        let offer = offers.find((of) => of.offerCode === coupon.code);
        if (offer) {
          if (coupon.state === RecurlyCouponState.EXPIRED) {
            if (
              env === Env.STG &&
              offer.statusId !== StatusEnum.STG_RETD &&
              offer.statusId !== StatusEnum.STG_FAIL &&
              offer.statusId !== StatusEnum.STG_RB_FAIL &&
              offer.statusId !== StatusEnum.STG_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.STG_RETD });
            } else if (
              env === Env.PROD &&
              offer.statusId !== StatusEnum.PROD_RETD &&
              offer.statusId !== StatusEnum.PROD_FAIL &&
              offer.statusId !== StatusEnum.PROD_RB_FAIL &&
              offer.statusId !== StatusEnum.PROD_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.PROD_RETD });
            }
          }
          results.push({
            statusId: offer.statusId,
            Status: {
              id: offer.Status.statusId,
              title: offer.Status.title,
              description: offer.Status.description,
              sortPriority: offer.Status.sortPriority,
            },
            OfferType: {
              id: offer.offerTypeId,
              title: offer.OfferType ? offer.OfferType.title : null,
            },
            lastModifiedAt: offer.get('LastModifiedAt'),
            publishDateTime:
              offer.onTime && !isNaN(offer.onTime.getTime())
                ? offer.onTime.toISOString()
                : null,
            ...mapCouponToPayload(store.storeCode, currency, coupon),
            campaign: offer.campaign,
            campaignName:
              offer.campaignName || offer.Campaign?.name || coupon.name,
            offerTypeId: offer.offerTypeId,
            offerUrl: generateOfferUrl(offer, coupon.couponType, languageCode),
            dataIntegrityStatus: offer.dataIntegrityStatus,
            dataIntegrityCheckTime: offer.dataIntegrityCheckTime,
            dataIntegrityErrorMessage: offer.dataIntegrityErrorMessage,
            glValidationError: validateGlPromotionOffer(offer, glOffers),
          });
        }
      }
    }
    return results;
  };

  try {
    return await pRetry(perform, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getOffersRecurlyPayload failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Get all coupons failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const getRetentionOffersRecurlyPayload = async (
  offers: RetentionOfferModel[],
  store: StoreModel,
  env: Env,
  glOffers: Map<GlOfferType, Set<string>>,
  country: RetentionCountry,
): Promise<OfferRecurlyResponsePayload[]> => {
  const perform = async () => {
    const couponIds = offers.map((of) => of.couponId);
    const recurlyCredential = getRecurlyCredential(store, env);
    if (!recurlyCredential.apiKey) {
      return [];
    }
    const batches = [];
    const results = [];
    const apiLimit = 200; // this should not be set to 0 > infinite loop
    for (let i = 0; i < couponIds.length; i += apiLimit) {
      batches.push(couponIds.slice(i, i + apiLimit));
    }
    for (const ids of batches) {
      const coupons = createRecurlyClient(
        recurlyCredential.apiKey,
      ).listCoupons({ ids: ids });
      for await (const coupon of coupons.each()) {
        let offer = offers.find((of) => of.offerCode === coupon.code);
        if (offer) {
          if (coupon.state === RecurlyCouponState.EXPIRED) {
            if (
              env === Env.STG &&
              offer.statusId !== StatusEnum.STG_RETD &&
              offer.statusId !== StatusEnum.STG_FAIL &&
              offer.statusId !== StatusEnum.STG_RB_FAIL &&
              offer.statusId !== StatusEnum.STG_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.STG_RETD });
            } else if (
              env === Env.PROD &&
              offer.statusId !== StatusEnum.PROD_RETD &&
              offer.statusId !== StatusEnum.PROD_FAIL &&
              offer.statusId !== StatusEnum.PROD_RB_FAIL &&
              offer.statusId !== StatusEnum.PROD_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.PROD_RETD });
            }
          }

          const glValidationError = glOffers
            ? validateGlRetentionOffer(offer, glOffers)
            : await validateSingleGlRetentionOffer(offer, store.regionCode);

          if (!country) {
            country = await getRetentionOfferCountrySlow(store.regionCode, env);
          }
          const glValidationWarning = validateGlFilter(env, country, offer);

          results.push({
            statusId: offer.statusId,
            switchToPlan: offer.switchToPlan,
            isCouponless: offer.isCouponless ?? false,
            createUpgradeOffer: !!offer.switchToPlan,
            eligiblePlans: coupon.plans
              ? coupon.plans.map((p) => p.code)
              : null,
            Status: {
              id: offer.Status.statusId,
              title: offer.Status.title,
              description: offer.Status.description,
              sortPriority: offer.Status.sortPriority,
            },
            OfferType: {
              id: OfferTypes.RETENTION,
              title: 'Retention',
            },
            lastModifiedAt: offer.get('LastModifiedAt'),
            // publishDateTime:
            // offer.onTime && !isNaN(offer.onTime.getTime())
            //   ? offer.onTime.toISOString()
            //   : null,
            ...mapCouponToPayload(
              store.storeCode,
              await getCurrency(store),
              coupon,
            ),
            campaign: offer.campaign,
            campaignName:
              offer.campaignName || offer.Campaign?.name || coupon.name,
            offerTypeId: OfferTypes.RETENTION,
            upgradePlan: offer.switchToPlan,
            offerUrl: '', // TODO: generateOfferUrl(offer, coupon.couponType),
            dataIntegrityStatus: offer.dataIntegrityStatus,
            dataIntegrityCheckTime: offer.dataIntegrityCheckTime,
            dataIntegrityErrorMessage: offer.dataIntegrityErrorMessage,
            glValidationError,
            glValidationWarning,
          });
        }
      }
    }
    return results;
  };

  try {
    return await pRetry(perform, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getOffersRecurlyPayload failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Get all coupons failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const getExtensionOffersRecurlyPayload = async (
  offers: ExtensionOfferModel[],
  store: StoreModel,
  env: Env,
  glOffers: Map<GlOfferType, Set<string>>,
  country: RetentionCountry,
): Promise<OfferRecurlyResponsePayload[]> => {
  const perform = async () => {
    const couponIds = offers.map((of) => of.couponId);
    const recurlyCredential = getRecurlyCredential(store, env);
    if (!recurlyCredential.apiKey) {
      return [];
    }
    const batches = [];
    const results = [];
    const apiLimit = 200; // this should not be set to 0 > infinite loop
    for (let i = 0; i < couponIds.length; i += apiLimit) {
      batches.push(couponIds.slice(i, i + apiLimit));
    }
    for (const ids of batches) {
      const coupons = createRecurlyClient(
        recurlyCredential.apiKey,
      ).listCoupons({ ids: ids });
      for await (const coupon of coupons.each()) {
        let offer = offers.find((of) => of.offerCode === coupon.code);
        if (offer) {
          if (coupon.state === RecurlyCouponState.EXPIRED) {
            if (
              env === Env.STG &&
              offer.statusId !== StatusEnum.STG_RETD &&
              offer.statusId !== StatusEnum.STG_FAIL &&
              offer.statusId !== StatusEnum.STG_RB_FAIL &&
              offer.statusId !== StatusEnum.STG_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.STG_RETD });
            } else if (
              env === Env.PROD &&
              offer.statusId !== StatusEnum.PROD_RETD &&
              offer.statusId !== StatusEnum.PROD_FAIL &&
              offer.statusId !== StatusEnum.PROD_RB_FAIL &&
              offer.statusId !== StatusEnum.PROD_VALDN_FAIL
            ) {
              offer = await offer.update({ statusId: StatusEnum.PROD_RETD });
            }
          }

          if (!country) {
            country = await getRetentionOfferCountrySlow(store.regionCode, env);
          }
          // const glValidationWarning = validateGlFilter(env, country, offer);

          results.push({
            statusId: offer.statusId,
            switchToPlan: offer.switchToPlan,
            createUpgradeOffer: !!offer.switchToPlan,
            eligiblePlans: coupon.plans
              ? coupon.plans.map((p) => p.code)
              : null,
            Status: {
              id: offer.Status.statusId,
              title: offer.Status.title,
              description: offer.Status.description,
              sortPriority: offer.Status.sortPriority,
            },
            OfferType: {
              id: OfferTypes.EXTENSION,
              title: 'Extension',
            },
            lastModifiedAt: offer.get('LastModifiedAt'),
            ...mapCouponToPayload(
              store.storeCode,
              await getCurrency(store),
              coupon,
            ),
            offerTypeId: OfferTypes.EXTENSION,
            upgradePlan: offer.switchToPlan,
            offerUrl: '', // TODO: generateOfferUrl(offer, coupon.couponType),
          });
        }
      }
    }
    return results;
  };

  try {
    return await pRetry(perform, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getOffersRecurlyPayload failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Get all coupons failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

// Coupon functions
export const getOfferRecurlyPayload = async (
  offerCode: string,
  store: StoreModel,
  env: Env,
  returnCoupon?: boolean,
  returnExistanceOfCoupon?: boolean,
): Promise<OfferRecurlyPayload> => {
  logger.debug(`${logPrefix(env)} getOfferRecurlyPayload start`);
  if (!store.rlyApiKeyProd) {
    env = Env.STG;
  }
  const getCouponOp = async () => {
    // get coupon on Recurly
    const recurlyCredential = getRecurlyCredential(store, env);
    return await createRecurlyClient(recurlyCredential.apiKey).getCoupon(
      `code-${offerCode}`,
    );
  };

  try {
    const coupon = await pRetry(getCouponOp, pRetryOptions);
    return mapCouponToPayload(
      store.storeCode,
      await getCurrency(store),
      coupon,
      returnCoupon ? returnCoupon : null,
    );
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getOfferRecurlyPayload failed, ${err.message}`,
      err,
    );
    if (err.name === 'RecurlyNotFoundError') {
      if (returnExistanceOfCoupon) {
        return null;
      } else {
        throw new RecurlyError(
          `${logPrefix()} Coupon not found on ${env.toUpperCase()}, ${
            err.message
          }`,
          404,
        );
      }
    } else {
      throw new RecurlyError(
        `${logPrefix()} Get coupon failed on ${env.toUpperCase()}, ${
          err.message
        }`,
        err.statusCode ? err.statusCode : 500,
      );
    }
  }
};

// Coupon functions
export const getRetentionOfferRecurlyPayload = async (
  offerCode: string,
  store: StoreModel,
  env: Env,
  recurlyCredential: RecurlyCredential | null = null,
  returnCoupon?: boolean,
  returnExistanceOfCoupon?: boolean,
): Promise<RetentionOfferRecurlyPayload> => {
  logger.debug(
    `${logPrefix(env)} getRetentionOfferRecurlyPayload (${offerCode})`,
  );
  const getCouponOp = async () => {
    // get coupon on Recurly
    const credential = recurlyCredential
      ? recurlyCredential
      : getRecurlyCredential(store, env);
    return await createRecurlyClient(credential.apiKey).getCoupon(
      `code-${offerCode}`,
    );
  };

  try {
    const coupon = await pRetry(getCouponOp, pRetryOptions);
    return mapRetentionCouponToPayload(
      coupon,
      store.storeCode,
      await getCurrency(store),
      returnCoupon ? returnCoupon : null,
    );
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getRetentionOfferRecurlyPayload failed, ${
        err.message
      }`,
      err,
    );
    if (err.name === 'RecurlyNotFoundError') {
      if (returnExistanceOfCoupon) {
        return null;
      } else {
        throw new RecurlyError(
          `${logPrefix()} Coupon not found on ${env.toUpperCase()}, ${
            err.message
          }`,
          404,
        );
      }
    } else {
      throw new RecurlyError(
        `${logPrefix()} Get coupon failed on ${env.toUpperCase()}, ${
          err.message
        }`,
        err.statusCode ? err.statusCode : 500,
      );
    }
  }
};

export const getExtensionOfferRecurlyPayload = async (
  offerCode: string,
  store: StoreModel,
  env: Env,
  recurlyCredential: RecurlyCredential | null = null,
  returnCoupon?: boolean,
  returnExistanceOfCoupon?: boolean,
): Promise<ExtensionOfferRecurlyPayload> => {
  logger.debug(
    `${logPrefix(env)} getExtensionOfferRecurlyPayload (${offerCode})`,
  );
  const getCouponOp = async () => {
    // get coupon on Recurly
    const credential = recurlyCredential
      ? recurlyCredential
      : getRecurlyCredential(store, env);
    return await createRecurlyClient(credential.apiKey).getCoupon(
      `code-${offerCode}`,
    );
  };

  try {
    const coupon = await pRetry(getCouponOp, pRetryOptions);
    return mapExtensionCouponToPayload(
      coupon,
      store.storeCode,
      await getCurrency(store),
      returnCoupon ? returnCoupon : null,
    );
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getExtensionOfferRecurlyPayload failed, ${
        err.message
      }`,
      err,
    );
    if (err.name === 'RecurlyNotFoundError') {
      if (returnExistanceOfCoupon) {
        return null;
      } else {
        throw new RecurlyError(
          `${logPrefix()} Coupon not found on ${env.toUpperCase()}, ${
            err.message
          }`,
          404,
        );
      }
    } else {
      throw new RecurlyError(
        `${logPrefix()} Get coupon failed on ${env.toUpperCase()}, ${
          err.message
        }`,
        err.statusCode ? err.statusCode : 500,
      );
    }
  }
};

export const createCoupon = async (
  payload: OfferRecurlyPayload,
  recurlyPlan: PlanRecurlyPayload,
  store: StoreModel,
  env: Env,
  statusId?: StatusEnum,
): Promise<string> => {
  logger.debug(
    `${logPrefix(env)} createCoupon start for (${payload.offerCode})`,
  );
  const createCouponOp = async () => {
    // create coupon on Recurly
    const recurlyCredential = getRecurlyCredential(store, env);
    const response = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).createCoupon(
      getCreateCouponPayload(payload, recurlyPlan, store.Region.currency, env),
    );
    if (payload.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
      const codeCount =
        env === Env.STG
          ? addExtraCodes(payload.totalUniqueCodes)
          : payload.totalUniqueCodes;
      await removeOfferFromWorkflowQueue(payload.offerCode);
      // do not await, this take a while
      generateNewCouponCodes(
        payload.offerCode,
        codeCount,
        env,
        recurlyCredential,
      )
        .then(() => {
          io.emit('show-snackbar', {
            action: 'OK',
            msg: `Generate unique codes completed for '${payload.offerCode}', ready to validate...`,
            offerCode: payload.offerCode,
            isInWorkflow: WorkflowAction.GENERATE_CSV,
            event: 'generateCsvComplete',
            reload: statusId != null ? statusId > StatusEnum.DFT : false,
          });
        })
        .catch((err) => {
          io.emit('show-snackbar', {
            action: 'OK',
            msg: `Generate unique codes failed for '${payload.offerCode}', please hit (refresh) button...`,
            offerCode: payload.offerCode,
            isInWorkflow: WorkflowAction.GENERATE_CSV,
          });
        });
    }
    logger.debug(
      `${logPrefix(env)} createCoupon completed for (${payload.offerCode})`,
      {
        couponState: response.state,
        couponId: response?.id || 'Undefined',
      },
    );
    return response.id;
  };
  try {
    return await pRetry(createCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(`${logPrefix(env)} createCoupon failed, ${err.message}`, err);
    throw new RecurlyError(
      `${logPrefix()} Create coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const createRetentionCoupon = async (
  payload: RetentionOfferRecurlyPayload,
  eligiblePlans: PlanRecurlyPayload[],
  isUpgrade: boolean,
  store: StoreModel,
  env: Env,
  upgradePlan?: string,
): Promise<string> => {
  logger.debug(
    `${logPrefix(env)} createCoupon start for (${payload.offerCode})`,
  );
  const createCouponOp = async () => {
    // create coupon on Recurly
    const recurlyCredential = getRecurlyCredential(store, env);
    const couponPayload = getCreateRedemptionCouponPayload(
      payload,
      eligiblePlans,
      isUpgrade,
      store.Region.currency,
      env,
      upgradePlan,
    );
    const response = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).createCoupon(couponPayload);
    logger.debug(
      `${logPrefix(env)} createRetentionCoupon completed for (${
        payload.offerCode
      })`,
      {
        couponState: response.state,
        couponId: response?.id || 'Undefined',
      },
    );
    return response.id;
  };
  try {
    return await pRetry(createCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} createRetentionCoupon failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Create coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const createExtensionCoupon = async (
  payload: ExtensionOfferRecurlyPayload,
  eligibleCharges: PlanRecurlyPayload[],
  isUpgrade: boolean,
  store: StoreModel,
  env: Env,
  upgradePlan?: string,
): Promise<string> => {
  logger.debug(
    `${logPrefix(env)} createCoupon start for (${payload.offerCode})`,
  );
  const createCouponOp = async () => {
    // create coupon on Recurly
    const recurlyCredential = getRecurlyCredential(store, env);
    const couponPayload = getCreateExtensionCouponPayload(
      payload,
      eligibleCharges,
      isUpgrade,
      store.Region.currency,
      env,
      upgradePlan,
    );
    const response = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).createCoupon(couponPayload);
    logger.debug(
      `${logPrefix(env)} createRetentionCoupon completed for (${
        payload.offerCode
      })`,
      {
        couponState: response.state,
        couponId: response?.id || 'Undefined',
      },
    );
    return response.id;
  };
  try {
    return await pRetry(createCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} createRetentionCoupon failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Create coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const updateCoupon = async (
  payload: OfferRecurlyPayload,
  offerCode: string,
  store: StoreModel,
  env: Env,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} updateCoupon`);
  const updateCouponOp = async () => {
    const recurlyCredential = getRecurlyCredential(store, env);
    // retrieve coupon to get current unique coupon codes count
    const coupon = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).getCoupon(`code-${offerCode}`);
    await createRecurlyClient(recurlyCredential.apiKey).updateCoupon(
      `code-${offerCode}`,
      getUpdateCouponPayload(payload),
    );

    // totalUniqueCodes is not editable, this could should not run
    // if (payload.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
    //   // generate new coupon codes (new total minus old total)
    //   generateNewCouponCodes(
    //     offerCode,
    //     payload.totalUniqueCodes - coupon.uniqueCouponCodesCount,
    //     env,
    //     recurlyCredential,
    //   );
    // }
  };
  try {
    await pRetry(updateCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(`${logPrefix(env)} updateCoupon failed, ${err.message}`, err);
    throw new RecurlyError(
      `${logPrefix()} Update coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const updateRetentionCoupon = async (
  payload: RetentionOfferRecurlyPayload,
  offerCode: string,
  isUpgrade: boolean,
  store: StoreModel,
  env: Env,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} updateCoupon`);
  const updateCouponOp = async () => {
    const recurlyCredential = getRecurlyCredential(store, env);
    // retrieve coupon to get current unique coupon codes count
    const coupon = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).getCoupon(`code-${offerCode}`);
    await createRecurlyClient(recurlyCredential.apiKey).updateCoupon(
      `code-${offerCode}` + (isUpgrade ? '_upgrade' : ''),
      getRetentionUpdateCouponPayload(payload, isUpgrade),
    );
  };
  try {
    await pRetry(updateCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(`${logPrefix(env)} updateCoupon failed, ${err.message}`, err);
    throw new RecurlyError(
      `${logPrefix()} Update coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const updateExtensionCoupon = async (
  payload: ExtensionOfferRecurlyPayload,
  offerCode: string,
  isUpgrade: boolean,
  store: StoreModel,
  env: Env,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} updateCoupon`);
  const updateCouponOp = async () => {
    const recurlyCredential = getRecurlyCredential(store, env);
    // retrieve coupon to get current unique coupon codes count
    const coupon = await createRecurlyClient(
      recurlyCredential.apiKey,
    ).getCoupon(`code-${offerCode}`);
    await createRecurlyClient(recurlyCredential.apiKey).updateCoupon(
      `code-${offerCode}` + (isUpgrade ? '_upgrade' : ''),
      getExtensionUpdateCouponPayload(payload, isUpgrade),
    );
  };
  try {
    await pRetry(updateCouponOp, pRetryOptions);
  } catch (err) {
    logger.error(`${logPrefix(env)} updateCoupon failed, ${err.message}`, err);
    throw new RecurlyError(
      `${logPrefix()} Update coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const deactivateCoupon = async (
  offer: OfferModel | RetentionOfferModel | ExtensionOfferModel,
  offerCode: string,
  store: StoreModel,
  env: Env,
  updatedBy: string,
): Promise<OfferRecurlyPayload> => {
  logger.debug(
    `${logPrefix(env)} deactivateCoupon with offerCode '${offerCode}'`,
  );
  const deactivateOp = async () => {
    const client = await getRecurlyClient(store, env);
    return await client.deactivateCoupon(`code-${offerCode}`);
  };
  try {
    const coupon = await pRetry(deactivateOp, pRetryOptions);
    const message = getExpireOfferSlackChatMessage(offer, updatedBy);
    const slackConfigModels: SlackConfigModel[] = await SlackConfig.findAll({
      where: {
        type: SlackConfigType.EXPIRE,
      },
    });
    for (let slackConfigModel of slackConfigModels) {
      if (!!slackConfigModel.enabled && env === Env.STG) {
        await publishSlackMessage(slackConfigModel, message);
      }
    }
    return mapCouponToPayload(
      store.storeCode,
      await getCurrency(store),
      coupon,
    );
  } catch (err) {
    logger.error(
      `${logPrefix(env)} deactivateCoupon failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Deactivate coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const restoreCoupon = async (
  payload: OfferRecurlyPayload,
  offerCode: string,
  store: StoreModel,
  env: Env,
): Promise<OfferRecurlyPayload> => {
  logger.debug(`${logPrefix(env)} restoreCoupon with offerCode '${offerCode}'`);
  const restoreOp = async () => {
    const client = await getRecurlyClient(store, env);
    return await client.restoreCoupon(
      `code-${offerCode}`,
      getUpdateCouponPayload(payload),
    );
  };
  try {
    const coupon = await pRetry(restoreOp, pRetryOptions);
    return mapCouponToPayload(
      store.storeCode,
      await getCurrency(store),
      coupon,
    );
  } catch (err) {
    logger.error(`${logPrefix(env)} restoreCoupon failed, ${err.message}`, err);
    throw new RecurlyError(
      `${logPrefix()} Restore coupon failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

// export const undoDeactivateCoupon = async (
//   offer: OfferModel,
//   env: Env,
// ): Promise<void> => {
//   const plan = await getPlanModel(offer.planCode, false);
//   const client = await getRecurlyClient(plan.storeCode, env);
//   let coupon = await client.getCoupon(`code-${offer.offerCode}`);
//   if (coupon.state === 'expired') {
//     coupon = await createCoupon(offer, plan, env);
//   }
// };

export const generateNewCouponCodes = async (
  offerCode: string,
  total: number,
  env: Env,
  recurlyCredential: RecurlyCredential,
): Promise<void> => {
  try {
    await addOfferToWorkflowQueue(offerCode, WorkflowAction.GENERATE_CSV);
    // generate unique coupon codes via API endpoint (recurly-client-node doesn't support this generate function)
    const recurlyEndpoint = `https://v3.recurly.com/sites/subdomain-${recurlyCredential.subdomain}/coupons/code-${offerCode}/generate`;
    const config = {
      headers: { Accept: 'application/vnd.recurly.v2019-10-10+json' },
      auth: { username: recurlyCredential.apiKey, password: '' },
    };
    // this API has a limit of generating 200 unique codes at a time, need to create them in batches
    let redemptions: number = total;
    while (redemptions > 0) {
      const response = await axios.post(
        recurlyEndpoint,
        { number_of_unique_codes: redemptions >= 200 ? 200 : redemptions },
        config,
      );
      if (response.status !== 201) {
        throw new AppError(response.data.message, response.status);
      } else {
        redemptions -= 200;
      }
    }
    await removeOfferFromWorkflowQueue(offerCode);
  } catch (err) {
    if (
      err.response.status === 400 &&
      JSON.stringify(err.response.data).includes(
        'unique code creation is in progress',
      )
    ) {
      //err.response.data.error.params[].param === Allowed values: cannot be generated; unique code creation is in progress, please wait for it to finish and try again
      //err.response.data.error.params[].message === Allowed values: cannot be generated; unique code creation is in progress, please wait for it to finish and try again
    } else {
      await removeOfferFromWorkflowQueue(offerCode);
      logger.error(
        `${logPrefix(env)} generateNewCouponCodes failed, ${err.message}`,
        err,
      );
      throw new RecurlyError(
        `${logPrefix()} Generate unique coupon codes failed on ${env.toUpperCase()}: ${
          err.message
        }`,
        err.response?.status || err.statusCode || err.statusCode || 500,
      );
    }
  }
};

export const getCreateCouponPayload = (
  payload: OfferRecurlyPayload,
  plan: PlanRecurlyPayload,
  currencyCode: string,
  env: Env,
): CouponCreationPayload => {
  const commmonCreatePayload = {
    name: payload.offerName,
    couponType: payload.offerCodeType,
    code: payload.offerCode,
    discountType: payload.discountType,
    maxRedemptionsPerAccount: 1,
    redeemByDate: payload.endDateTime
      ? new Date(payload.endDateTime).toISOString()
      : null,
    planCodes: getEligiblePlanCodes(payload),
  };
  if (payload.offerCodeType === CodeType.SINGLE_CODE) {
    if (payload.discountType === DiscountType.FIXED_PRICE) {
      return {
        ...commmonCreatePayload,
        ...getFixedDiscountTypePayload(payload, plan, currencyCode, env),
      };
    } else if (payload.discountType === DiscountType.FREE_TRIAL) {
      return {
        ...commmonCreatePayload,
        ...getTrialDiscountTypePayload(payload),
      };
    }
  } else if (payload.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
    if (payload.discountType === DiscountType.FIXED_PRICE) {
      return {
        ...commmonCreatePayload,
        ...getFixedDiscountTypePayload(payload, plan, currencyCode, env),
        uniqueCodeTemplate: `'${payload.offerCode}-'${UNIQUE_CODE_TEMPLATE}`,
      };
    } else if (payload.discountType === DiscountType.FREE_TRIAL) {
      return {
        ...commmonCreatePayload,
        ...getTrialDiscountTypePayload(payload),
        uniqueCodeTemplate: `'${payload.offerCode}-'${UNIQUE_CODE_TEMPLATE}`,
      };
    }
  }
};

export const getCreateRedemptionCouponPayload = (
  payload: RetentionOfferRecurlyPayload,
  eligiblePlans: PlanRecurlyPayload[],
  isUpgrade: boolean,
  currencyCode: string,
  env: Env,
  upgradePlan?: string,
): CouponCreationPayload => {
  const commonCreatePayload = {
    name: payload.offerName + (isUpgrade ? ' (Upgrade)' : ''),
    couponType: CodeType.SINGLE_CODE,
    code: payload.offerCode + (isUpgrade ? '_upgrade' : ''),
    discountType: payload.discountType,
    maxRedemptionsPerAccount: 1, //TODO: check
    redeemByDate: payload.endDateTime
      ? new Date(payload.endDateTime).toISOString()
      : null,
  };
  const plans = upgradePlan
    ? { planCodes: [upgradePlan] }
    : payload.eligiblePlans.length > 0
    ? { planCodes: payload.eligiblePlans }
    : { appliesToAllPlans: true };

  if (payload.discountType === DiscountType.FIXED_PRICE) {
    return {
      ...commonCreatePayload,
      ...plans,
      ...getRetentionFixedDiscountTypePayload(
        payload,
        eligiblePlans,
        isUpgrade,
        currencyCode,
        env,
      ),
    };
  } else if (payload.discountType === DiscountType.PERCENT) {
    return {
      ...commonCreatePayload,
      ...plans,
      ...getRetentionPercentDiscountTypePayload(
        payload,
        isUpgrade,
        currencyCode,
      ),
    };
  }
};

export const getCreateExtensionCouponPayload = (
  payload: ExtensionOfferRecurlyPayload,
  eligibleCharges: PlanRecurlyPayload[],
  isUpgrade: boolean,
  currencyCode: string,
  env: Env,
  upgradePlan?: string,
): CouponCreationPayload => {
  const commonCreatePayload = {
    name: payload.offerTitle + (isUpgrade ? ' (Upgrade)' : ''),
    couponType: CodeType.SINGLE_CODE,
    code: payload.offerCode + (isUpgrade ? '_upgrade' : ''),
    discountType: 'fixed',
    maxRedemptionsPerAccount: 1, //TODO: check
  };
  const plans = upgradePlan
    ? { planCodes: [upgradePlan] }
    : payload.eligibleCharges.length > 0
    ? { planCodes: payload.eligibleCharges }
    : { appliesToAllPlans: true };

  return {
    ...commonCreatePayload,
    ...plans,
    ...getExtensionFixedDiscountTypePayload(
      payload,
      eligibleCharges,
      isUpgrade,
      currencyCode,
      env,
    ),
  };
};

export const getEligiblePlanCodes = (
  payload: OfferRecurlyPayload,
): string[] => {
  return [payload.planCode];
};

const getFixedDiscountTypePayload = (
  payload: OfferRecurlyPayload,
  plan: PlanRecurlyPayload,
  currencyCode: string,
  env: Env,
) => {
  const planPrice = plan.price; // TODO: get price with region code
  let discount: number;
  if (env === Env.PROD) {
    // publishOffer controller >>> payload.discountAmount = recurly discount retrieved from recurly
    discount = payload.discountAmount;
  } else if (env === Env.STG) {
    // createNewOffer controller >>> payload.discountAmount = promo price from the frontend payload
    // plan price - promo price = discount amount
    discount = planPrice - payload.discountAmount;
  }
  if (discount > planPrice || discount < 0) {
    throw new AppError(
      `Offer discount ($${discount}) cannot be negative, or greater than Plan price ($${planPrice})`,
      406,
    );
  }
  return {
    currencies: [
      {
        discount: discount,
        currency: currencyCode,
      },
    ],
    duration: DurationType.TEMPORAL,
    temporalAmount: payload.discountDurationValue,
    temporalUnit: sanitizeUnit(payload.discountDurationUnit),
    redemptionResource: 'subscription',
    invoiceDescription: payload.welcomeEmailText,
  };
};

const getTrialDiscountTypePayload = (payload: OfferRecurlyPayload) => {
  return {
    freeTrialAmount: payload.discountDurationValue,
    freeTrialUnit: payload.discountDurationUnit,
  };
};

const getRetentionFixedDiscountTypePayload = (
  payload: RetentionOfferRecurlyPayload,
  eligiblePlans: PlanRecurlyPayload[],
  isUpgrade: boolean,
  currencyCode: string,
  env: Env,
) => {
  const planPrice = eligiblePlans[0].price; // TODO: get price with region code
  const planName = eligiblePlans[0].planName;

  let discount: number;
  if (env === Env.PROD) {
    // publishOffer controller >>> payload.discountAmount = recurly discount retrieved from recurly
    discount = payload.discountAmount;
  } else if (env === Env.STG) {
    // createNewOffer controller >>> payload.discountAmount = promo price from the frontend payload
    // plan price - promo price = discount amount
    discount = planPrice - payload.discountAmount;
  }
  if (discount > planPrice || discount < 0) {
    throw new AppError(
      `Offer discount ($${discount}) cannot be negative, or greater than Plan price ($${planPrice})`,
      406,
    );
  }

  const duration: any = {
    duration: payload.discountDurationType,
  };
  if (payload.discountDurationType == DurationType.TEMPORAL) {
    duration.temporalAmount = payload.discountDurationValue;
    duration.temporalUnit = sanitizeUnit(payload.discountDurationUnit);
  }
  return {
    currencies: [
      {
        discount: discount,
        currency: currencyCode,
      },
    ],
    ...duration,
    redemptionResource: isUpgrade ? 'subscription' : 'account',
    invoiceDescription: payload.welcomeEmailText ?? '',
  };
};

const getExtensionFixedDiscountTypePayload = (
  payload: ExtensionOfferRecurlyPayload,
  eligibleCharges: PlanRecurlyPayload[],
  isUpgrade: boolean,
  currencyCode: string,
  env: Env,
) => {
  const planPrice = eligibleCharges[0].price; // TODO: get price with region code
  const planName = eligibleCharges[0].planName;

  let discount: number;
  if (env === Env.PROD) {
    // publishOffer controller >>> payload.discountAmount = recurly discount retrieved from recurly
    discount = payload.discountAmount;
  } else if (env === Env.STG) {
    // createNewOffer controller >>> payload.discountAmount = promo price from the frontend payload
    // plan price - promo price = discount amount
    discount = planPrice - payload.discountAmount;
  }
  if (discount > planPrice || discount < 0) {
    throw new AppError(
      `Offer discount ($${discount}) cannot be negative, or greater than Plan price ($${planPrice})`,
      406,
    );
  }

  const duration: any = {
    duration: payload.durationType,
  };
  if (payload.durationType === DurationType.TEMPORAL) {
    duration.temporalAmount = payload.durationAmount;
    duration.temporalUnit = sanitizeUnit(payload.durationUnit);
  }
  return {
    currencies: [
      {
        discount,
        currency: currencyCode,
      },
    ],
    ...duration,
    redemptionResource: isUpgrade ? 'subscription' : 'account',
  };
};

const getRetentionPercentDiscountTypePayload = (
  payload: RetentionOfferRecurlyPayload,
  isUpgrade: boolean,
  currencyCode: string,
) => {
  const duration: any = {
    duration: payload.discountDurationType,
  };
  if (payload.discountDurationType == DurationType.TEMPORAL) {
    duration.temporalAmount = payload.discountDurationValue;
    duration.temporalUnit = sanitizeUnit(payload.discountDurationUnit);
  }
  return {
    discount_percent: payload.discountAmount,
    ...duration,
    redemptionResource: isUpgrade ? 'subscription' : 'account',
    invoiceDescription: payload.welcomeEmailText ?? '',
  };
};

export const getUpdateCouponPayload = (
  payload: OfferRecurlyPayload,
): CouponUpdatePayload => {
  // we can only update the following properties
  let commonUpdatePayload: CouponUpdatePayload = {
    name: payload.offerName,
    maxRedemptionsPerAccount: 1,
    redeemByDate: payload.endDateTime
      ? new Date(payload.endDateTime).toISOString()
      : null,
  };
  if (payload.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
    commonUpdatePayload = {
      ...commonUpdatePayload,
    };
  }
  return {
    ...commonUpdatePayload,
    invoiceDescription: payload.welcomeEmailText,
  };
};

export const getRetentionUpdateCouponPayload = (
  payload: RetentionOfferRecurlyPayload,
  isUpgrade: boolean,
): CouponUpdatePayload => {
  // we can only update the following properties
  const commonUpdatePayload: CouponUpdatePayload = {
    name: payload.offerName + (isUpgrade ? ' (Upgrade)' : ''),
    maxRedemptionsPerAccount: 1, //TODO: check
    redeemByDate: payload.endDateTime
      ? new Date(payload.endDateTime).toISOString()
      : null,
    invoiceDescription: payload.welcomeEmailText ?? '',
  };
  return {
    ...commonUpdatePayload,
  };
};

export const getExtensionUpdateCouponPayload = (
  payload: ExtensionOfferRecurlyPayload,
  isUpgrade: boolean,
): CouponUpdatePayload => {
  // we can only update the following properties
  const commonUpdatePayload: CouponUpdatePayload = {
    name: payload.offerTitle + (isUpgrade ? ' (Upgrade)' : ''),
    maxRedemptionsPerAccount: 1, //TODO: check
    redeemByDate: null,
    invoiceDescription: '',
  };
  return {
    ...commonUpdatePayload,
  };
};

const extractPlanCode = (plans: PlanMini[] | null) => {
  if (plans && plans.length === 1) {
    return plans[0].code;
  } else if (plans && plans.length > 1) {
    const filtered = plans.filter((p) => {
      return p.code.toLowerCase() !== 'internal01';
    });
    return filtered[0].code;
  } else {
    return null;
  }
};

const extractEligiblePlanCodes = (plans: PlanMini[] | null) => {
  if (plans) {
    return plans
      .filter((p) => p.code.toLowerCase() !== 'internal01')
      .map((p) => p.code);
  }
  return null;
};

const findCouponDiscountAmount = (
  code: string,
  currencies: CouponDiscountPricing[],
): number => {
  let fallback: CouponDiscountPricing = null;
  for (const currency of currencies) {
    if (currency.currency === code) {
      return currency.amount;
    }
    if (currency.amount) {
      fallback = currency;
    }
  }

  return fallback ? fallback.amount : 0;
};

const mapCouponToPayload = (
  storeCode: string,
  currency: string,
  coupon: recurly.Coupon,
  returnCoupon?: boolean,
): OfferRecurlyPayload => {
  if (coupon) {
    // SAMOC-324 - receives 'free_trial' (from Rly). need to set it to 'trial' (for publish to work)
    const discountType =
      coupon.discount.type === 'free_trial'
        ? DiscountType.FREE_TRIAL
        : coupon.discount.type;
    let discountAmount = 0;
    let discountDurationValue = undefined;
    let discountDurationUnit = '';
    switch (discountType) {
      case DiscountType.FIXED_PRICE:
        discountAmount = findCouponDiscountAmount(
          currency,
          coupon.discount.currencies,
        );
        if (coupon.duration === DurationType.TEMPORAL) {
          discountDurationValue = coupon.temporalAmount;
          discountDurationUnit = coupon.temporalUnit;
        }
        break;
      case DiscountType.FREE_TRIAL:
        discountAmount = undefined;
        discountDurationValue = coupon.discount.trial.length;
        discountDurationUnit = coupon.discount.trial.unit;
        break;
      case DiscountType.PERCENT:
        discountAmount = coupon.discount.percent;
        if (coupon.duration === DurationType.TEMPORAL) {
          discountDurationValue = coupon.temporalAmount;
          discountDurationUnit = coupon.temporalUnit;
        }
        break;
    }
    return {
      storeCode,
      offerCode: coupon.code,
      offerTypeId: null, // DB has this data
      couponState: coupon.state,
      planCode: extractPlanCode(coupon?.plans),
      eligiblePlanCodes: extractEligiblePlanCodes(coupon?.plans),
      offerName: coupon.name,
      offerCodeType: coupon.couponType,
      discountType: discountType,
      discountAmount: discountAmount,
      discountDurationType: coupon.duration as DurationType,
      discountDurationValue: discountDurationValue,
      discountDurationUnit: discountDurationUnit,
      totalUniqueCodes:
        coupon.couponType === 'bulk' ? coupon.uniqueCouponCodesCount : null,
      endDateTime: coupon.redeemBy ? coupon.redeemBy.toISOString() : null,
      noEndDate: coupon.redeemBy === null,
      couponExpiredAt: coupon.expiredAt,
      welcomeEmailText: coupon.invoiceDescription,
      updatedAt: coupon.updatedAt,
      couponCreatedAt: coupon.createdAt,
      couponUpdatedAt: coupon.updatedAt,
      coupon: returnCoupon ? coupon : null,
    };
  }
  return null;
};

const mapRetentionCouponToPayload = (
  coupon: recurly.Coupon,
  storeCode: string,
  currency: string,
  returnCoupon?: boolean,
): RetentionOfferRecurlyPayload => {
  if (coupon) {
    // SAMOC-324 - receives 'free_trial' (from Rly). need to set it to 'trial' (for publish to work)
    const discountType = coupon.discount.type as DiscountType;
    let discountAmount = 0;
    let discountDurationValue = undefined;
    let discountDurationUnit = '';
    switch (discountType) {
      case DiscountType.FIXED_PRICE:
        discountAmount = findCouponDiscountAmount(
          currency,
          coupon.discount.currencies,
        );
        if (coupon.duration === DurationType.TEMPORAL) {
          discountDurationValue = coupon.temporalAmount;
          discountDurationUnit = coupon.temporalUnit;
        }
        break;
      case DiscountType.PERCENT:
        discountAmount = coupon.discount.percent;
        if (coupon.duration === DurationType.TEMPORAL) {
          discountDurationValue = coupon.temporalAmount;
          discountDurationUnit = coupon.temporalUnit;
        }
        break;
    }
    return {
      offerCode: coupon.code,
      storeCode: storeCode,
      couponState: coupon.state,
      eligiblePlans: extractEligiblePlanCodes(coupon?.plans),
      offerName: coupon.name,
      discountType: discountType,
      discountAmount: discountAmount,
      discountDurationType: coupon.duration as DurationType,
      discountDurationValue: discountDurationValue,
      discountDurationUnit: discountDurationUnit,
      endDateTime: coupon.redeemBy ? coupon.redeemBy.toISOString() : null,
      noEndDate: coupon.redeemBy === null,
      couponExpiredAt: coupon.expiredAt,
      updatedAt: coupon.updatedAt,
      welcomeEmailText: coupon.invoiceDescription,
      couponCreatedAt: coupon.createdAt,
      couponUpdatedAt: coupon.updatedAt,
      isUpgrade: coupon.redemptionResource === 'Subscription',
      coupon: returnCoupon ? coupon : null,
    };
  }
  return null;
};

const mapExtensionCouponToPayload = (
  coupon: recurly.Coupon,
  storeCode: string,
  currency: string,
  returnCoupon?: boolean,
): ExtensionOfferRecurlyPayload => {
  if (coupon) {
    // SAMOC-324 - receives 'free_trial' (from Rly). need to set it to 'trial' (for publish to work)
    const discountAmount = findCouponDiscountAmount(
      currency,
      coupon.discount.currencies,
    );
    const durationAmount = coupon.temporalAmount;
    const durationUnit = coupon.temporalUnit;
    return {
      offerCode: coupon.code,
      storeCode: storeCode,
      couponState: coupon.state,
      eligibleCharges: extractEligiblePlanCodes(coupon?.plans),
      offerTitle: coupon.name,
      discountAmount: discountAmount,
      durationType: coupon.duration as DurationType,
      durationAmount: durationAmount,
      durationUnit: durationUnit,
      couponExpiredAt: coupon.expiredAt,
      updatedAt: coupon.updatedAt,
      couponCreatedAt: coupon.createdAt,
      couponUpdatedAt: coupon.updatedAt,
      isUpgrade: coupon.redemptionResource === 'Subscription',
      coupon: returnCoupon ? coupon : null,
    };
  }
  return null;
};

// Plan functions

export const getPlansRecurlyPayload = async (
  ids: string[],
  store: StoreModel,
  env: Env,
): Promise<PlanRecurlyPayload[]> => {
  if (!store.rlyApiKeyProd) {
    env = Env.STG;
  }
  const perform = async () => {
    const client = await getRecurlyClient(store, env);
    const recurlyPlans = [];
    const batches = [];
    const apiLimit = 200; // this should not be set to 0 > infinite loop
    for (let i = 0; i < ids.length; i += apiLimit) {
      batches.push(ids.slice(i, i + apiLimit));
    }
    for (const planIds of batches) {
      const plans = client.listPlans({ ids: planIds });
      for await (const plan of plans.each()) {
        recurlyPlans.push(mapPlanToPayload(await getCurrency(store), plan));
      }
    }
    return recurlyPlans;
  };
  try {
    return await pRetry(perform, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getPlansRecurlyPayload failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Get all plans failed on ${env.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

export const getPlanRecurlyPayload = async (
  planCode: string,
  store: StoreModel,
  env: Env,
): Promise<PlanRecurlyPayload> => {
  if (!store.rlyApiKeyProd) {
    env = Env.STG;
  }
  logger.debug(`${logPrefix(env)} getPlan`);
  const getPlanOp = async () => {
    const client = await getRecurlyClient(store, env);
    return await client.getPlan(`code-${planCode}`);
  };

  try {
    const recurlyPlan = await pRetry(getPlanOp, pRetryOptions);
    return mapPlanToPayload(await getCurrency(store), recurlyPlan);
  } catch (err) {
    logger.error(
      `${logPrefix(env)} getPlanRecurlyPayload failed, ${err.message}`,
      err,
    );
    if (err.type === 'not_found') {
      throw new RecurlyError(`${err.message} on ${env.toUpperCase()}`, 404);
    } else {
      throw new RecurlyError(
        `${logPrefix()} Failed to get Plan on ${env.toUpperCase()}, ${
          err.message
        }`,
        err.statusCode ? err.statusCode : 500,
      );
    }
  }
};

export const createPlan = async (
  plan: PlanModel,
  env: Env,
): Promise<recurly.Plan> => {
  logger.debug(`${logPrefix(env)} createPlan`);
  const client = await getRecurlyClient(plan.Store, env);
  return await client.createPlan(await getCreatePlanPayload(plan));
};

export const updatePlan = async (
  currentPlanModel: PlanModel,
  updatePlanModel: PlanAttributes,
  env: Env,
): Promise<recurly.Plan> => {
  logger.debug(`${logPrefix(env)} updatePlan`);
  const client = await getRecurlyClient(currentPlanModel.Store, env);
  return await client.updatePlan(
    `code-${currentPlanModel.planCode}`,
    getUpdatePlanPayload(
      updatePlanModel,
      await getCurrency(currentPlanModel.Store),
    ),
  );
};

export const removePlan = async (
  planCode: string,
  store: StoreModel,
  env: Env,
): Promise<recurly.Plan> => {
  logger.debug(`${logPrefix(env)} removePlan`);
  const client = await getRecurlyClient(store, env);
  return await client.removePlan(`code-${planCode}`);
};

export const getCreatePlanPayload = async (
  plan: PlanModel,
): Promise<PlanCreationPayload> => {
  return {
    ...getUpdatePlanPayload(plan, await getCurrency(plan.Store)),
    intervalUnit: null, // plan.billingPeriodUnit,
    intervalLength: 0, // plan.billingPeriodLength,
  };
};

export const getUpdatePlanPayload = (
  plan: PlanAttributes,
  currency: string,
): PlanUpdatePayload => {
  return {
    code: plan.planCode,
    name: plan.planCode, // per Flex request, plan name should be set as plan code so they are unique.
    trialUnit: null, // plan.trialUnit,
    trialLength: 0, // plan.trialLength,
    trialRequiresBillingInfo: true,
    totalBillingCycles: 1,
    autoRenew: true,
    taxCode: '',
    taxExempt: false,
    currencies: [
      {
        currency: currency,
        setupFee: 0,
        unitAmount: 0, // plan.price,
      },
    ],
  };
};

export const fetchBulkCode = async (
  offer: OfferModel,
  targetEnv: Env,
): Promise<string> => {
  logger.debug(
    `${logPrefix(targetEnv)} Fetching unique coupon code for bulk offer`,
  );
  const fetchOp = async () => {
    const rlyCred: RecurlyCredential = getRecurlyCredential(
      offer.Plan.Store,
      targetEnv,
    );
    const rlyClient = createRecurlyClient(rlyCred.apiKey);
    const codes = rlyClient.listUniqueCouponCodes(`code-${offer.offerCode}`);

    let bulkCode: string;
    for await (const code of codes.each()) {
      if (!code.redeemedAt) {
        bulkCode = code.code;
        break;
      }
    }
    return bulkCode;
  };
  try {
    return await pRetry(fetchOp, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(targetEnv)} fetchBulkCode failed, ${err.message}`,
      err,
    );
    throw new RecurlyError(
      `${logPrefix()} Fetch bulk code failed on ${targetEnv.toUpperCase()}, ${
        err.message
      }`,
      err.statusCode ? err.statusCode : 500,
    );
  }
};

const findPlanPrice = (code: string, currencies: PlanPricing[]): number => {
  let fallback: PlanPricing = null;
  for (const plan of currencies) {
    if (plan.currency === code) {
      return plan.unitAmount;
    }
    if (plan.unitAmount) {
      fallback = plan;
    }
  }
  return fallback ? fallback.unitAmount : 0;
};

const mapPlanToPayload = (
  currency: string,
  plan: recurly.Plan,
): PlanRecurlyPayload => {
  if (plan) {
    return {
      planName: plan.name,
      planCode: plan.code,
      price: findPlanPrice(currency, plan.currencies),
      billingCycleDuration: plan.intervalLength,
      billingCycleUnit: plan.intervalUnit,
      totalBillingCycles: plan.totalBillingCycles,
      trialDuration: plan.trialLength,
      trialUnit: plan.trialUnit,
      state: plan.state,
      planId: plan.id,
    };
  }
  return null;
};

const getCurrency = async (store: StoreModel): Promise<string> => {
  if (store && store.Region) {
    return store.Region.currency;
  }
  if (store) {
    const region = await Region.findByPk(store.regionCode);
    if (region) {
      return region.currency;
    }
  }
  return 'USD';
};

const getRecurlyClient = async (
  store: StoreModel,
  env: Env,
): Promise<recurly.Client> => {
  const credential = getRecurlyCredential(store, env);
  return createRecurlyClient(credential.apiKey);
};
