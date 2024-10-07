import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  getRecurlyCredential,
  getStoreModel,
  PLAN_QUERY_OPTS,
  processOfferError,
  RETENTION_OFFER_QUERY_OPTS,
} from '../../util/utils';
import { Env } from '../../types/enum';
import {
  getAccessToken,
  getConfigValue,
  getRetentionOfferCountry,
  GLSet,
  RetentionConfigurationValue,
  RetentionCountry,
  RetentionOffer,
} from '../../services/GhostLocker';
import { RetentionOffer as RetentionOfferFactory } from '../../models';
import {
  AllowedOffersForTerm,
  PlanRecurlyPayload,
  RetentionOfferRecurlyPayload,
} from '../../types/payload';
import { StoreModel } from '../../models/Store';
import * as Recurly from '../../services/Recurly';
import { getRetentionOfferRecurlyPayload } from '../../services/Recurly';
import { Plan } from '../../models';
import { allStores, allWebStores } from './campaign/utils';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import { RecurlyCredential } from '../../types/recurly';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get Offer Controller:`;
  } else {
    return `Get Offer Controller:`;
  }
};

const baseEnv = (): Env => (process.env.FILTER_BASE_ENV || Env.PROD) as Env;
const stgEnv = (): Env => (process.env.FILTER_STG_ENV || Env.STG) as Env;
const prodEnv = (): Env => (process.env.FILTER_PROD_ENV || Env.PROD) as Env;

interface RetentionOfferData
  extends RetentionOfferRecurlyPayload,
    RetentionOffer {
  campaign?: string;
  campaignName?: string;
}

type OffersByCode = { [code: string]: RetentionOfferData };
type PlansByCode = { [code: string]: PlanRecurlyPayload };

const asyncLimit = (fn: any, n: number) => {
  let pendingPromises: any = [];
  return async function (...args: any) {
    while (pendingPromises.length >= n) {
      await Promise.race(pendingPromises).catch(() => {});
    }

    const p = fn.apply(this, args);
    pendingPromises.push(p);
    await p.catch(() => {});
    pendingPromises = pendingPromises.filter((pending: any) => pending !== p);
    return p;
  };
};

const getRetentionOffers = async (
  storeModel: StoreModel,
  country: RetentionCountry,
  filter: (code: string) => boolean,
  env: Env,
  campaignMapping: Map<string, [string, string]>,
  recurlyCredential: RecurlyCredential,
): Promise<OffersByCode> => {
  const result: OffersByCode = {};
  if (!country || !country.retentionOffers) {
    return null;
  }
  const offers = country.retentionOffers;
  await Promise.all(
    offers.map(
      asyncLimit(async (offer: RetentionOffer) => {
        if (offer.storeOfferId === 'samocqa_ret_230626_299_for_1mo_upgrade') {
          let storeOfferId = offer.storeOfferId;
        }
        if (filter(offer.storeOfferId)) {
          try {
            const recurlyOffer = await getRetentionOfferRecurlyPayload(
              offer.storeOfferId,
              storeModel,
              env,
              recurlyCredential,
            );
            let [campaign, campaignName] = campaignMapping.get(
              recurlyOffer.offerCode,
            ) ?? [null, null];
            if (!campaign) {
              campaign = recurlyOffer.offerCode;
            } else {
              if (recurlyOffer.isUpgrade) {
                campaign = campaign + '_upgrade';
              }
            }
            if (!campaignName) {
              campaignName = recurlyOffer.offerName;
            } else {
              if (recurlyOffer.isUpgrade) {
                campaignName = campaignName + ' (Upgrade)';
              }
            }
            result[recurlyOffer.offerCode] = {
              ...recurlyOffer,
              ...offer,
              campaign,
              campaignName,
            };
          } catch (err) {
            logger.warn(err.message);
          }
        }
      }, 20),
    ),
  );
  return result;
};

const billingDurationInMonths = (plan: PlanRecurlyPayload): number => {
  return plan.billingCycleUnit === 'days'
    ? plan.billingCycleDuration / 30
    : plan.billingCycleDuration;
};

const findAllowedOffersForPlan = (
  plan: PlanRecurlyPayload,
  plans: PlansByCode,
  offers: OffersByCode,
  ignoreAppliesToUsersOnPlans: boolean,
): RetentionOfferData[] => {
  const result: RetentionOfferData[] = [];
  if (!offers) {
    return null;
  }
  for (const [offerCode, offer] of Object.entries(offers)) {
    if (offer.forceUserToPlanCode) {
      // upgrade offer
      const upgradePlan = plans[offer.forceUserToPlanCode];
      if (!upgradePlan) {
        continue;
      }
      if (
        billingDurationInMonths(upgradePlan) < billingDurationInMonths(plan)
      ) {
        continue;
      }
      if (
        !ignoreAppliesToUsersOnPlans &&
        offer.appliesToUsersOnPlans &&
        offer.appliesToUsersOnPlans.length > 0 &&
        !offer.appliesToUsersOnPlans.includes(plan.planCode)
      ) {
        continue;
      }
    } else {
      // retention offer
      if (
        offer.eligiblePlans &&
        offer.eligiblePlans.length > 0 &&
        !offer.eligiblePlans.includes(plan.planCode)
      ) {
        continue;
      }
    }
    result.push(offer);
  }
  return result;
};

/**
 * GET /api/offers/retention/terms/?store=<storeCode>
 * Get list of plans with allowed retention offers (including upgrade)
 * @param {Request}     req
 * @param {Response}    res
 */
export const getRetentionOffersForDurations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - getRetentionOffersForPlans');
    const { store } = req.query;
    const storeModels = [];
    if (store) {
      storeModels.push(await getStoreModel(store as string));
    } else {
      let storesByCode = await allWebStores();
      for (const storeCode of Object.getOwnPropertyNames(storesByCode)) {
        storeModels.push(storesByCode[storeCode]);
      }
    }
    // httpContext.set('storeCode', store);
    const env = baseEnv();
    const allOffersByTerm = new Map<number, RetentionOfferRecurlyPayload[]>();

    let config: RetentionConfigurationValue;
    let otherConfig: RetentionConfigurationValue;
    if (stgEnv() !== prodEnv()) {
      const otherEnv = env !== stgEnv() ? stgEnv() : prodEnv();
      const [token, otherToken] = await Promise.all([
        getAccessToken(env),
        getAccessToken(otherEnv),
      ]);
      [config, otherConfig] = await Promise.all([
        getConfigValue(GLSet.RET_RECURLY_V2, env, token),
        getConfigValue(GLSet.RET_RECURLY_V2, otherEnv, otherToken),
      ]);
    } else {
      const token = await getAccessToken(env);
      config = await getConfigValue(GLSet.RET_RECURLY_V2, Env.STG, token);
    }
    try {
      const allPromises:  Promise<Map<number, Map<string, RetentionOfferData>>>[] = [];
      for (const storeModel of storeModels) {
        allPromises.push(
          (async () => {
            const country = await getRetentionOfferCountry(
              storeModel.regionCode,
              config,
            );
            let filter = (code: string) => true;
            if (stgEnv() !== prodEnv()) {
              const otherCountry = await getRetentionOfferCountry(
                storeModel.regionCode,
                otherConfig,
              );
              if (!!otherCountry && !!otherCountry.retentionOffers) {
                filter = (code: string) =>
                otherCountry.retentionOffers.find(
                  (offer) => offer.storeOfferId === code,
                ) !== undefined;
              }
            }
            const campaignMapping = new Map<string, [string, string]>();
            const offerModels: RetentionOfferModel[] = await RetentionOfferFactory.findAll(
              {
                ...RETENTION_OFFER_QUERY_OPTS,
                where: { storeCode: storeModel.storeCode },
              },
            );
            offerModels.forEach((m) => {
              campaignMapping.set(m.offerCode, [
                m.campaign,
                m.Campaign?.name ? m.Campaign.name : null,
              ]);
              if (m.upgradeOfferCode) {
                campaignMapping.set(m.upgradeOfferCode, [
                  m.campaign,
                  m.Campaign?.name ? m.Campaign.name : null,
                ]);
              }
            });
            const recurlyCredentials = getRecurlyCredential(storeModel, env);
            const offersByCode = await getRetentionOffers(
              storeModel,
              country,
              filter,
              env,
              campaignMapping,
              recurlyCredentials,
            );
            const plans = await Plan.findAll({
              ...PLAN_QUERY_OPTS,
              where: { storeCode: storeModel.storeCode },
            });
            const plansByCode: PlansByCode = {};
            if (plans && plans.length > 0) {
              const ids = plans.map((pl) => pl.planId);
              const recurlyPlans = await Recurly.getPlansRecurlyPayload(
                ids,
                storeModel,
                Env.PROD, // Plans always come from PROD environment
              );
              for (const plan of recurlyPlans) {
                plansByCode[plan.planCode] = plan;
              }
            }
            const offersByTerm = new Map<
              number,
              Map<string, RetentionOfferData>
            >();
            const allOffers = new Map<string, RetentionOfferData>();
            for (const [code, plan] of Object.entries(plansByCode)) {
              const term = billingDurationInMonths(plan);
              const allowedOffers = findAllowedOffersForPlan(
                plan,
                plansByCode,
                offersByCode,
                true,
              );
              if (!!allowedOffers && !!allowedOffers.length) {
                let termOffers = offersByTerm.get(term);
                if (!termOffers) {
                  termOffers = new Map<string, RetentionOfferData>();
                  offersByTerm.set(term, termOffers);
                }
                allowedOffers.forEach((offer) => {
                  termOffers.set(offer.offerCode, offer);
                  allOffers.set(offer.offerCode, offer);
                });
              }
            }
            offersByTerm.set(0, allOffers);
            return offersByTerm;
          })(),
        );
      }
      const offersByTermForAllRegions = await Promise.all(allPromises)
      for (const offersByTerm of offersByTermForAllRegions) {
        offersByTerm.forEach((val, key) => {
          allOffersByTerm.set(key, [
            ...(allOffersByTerm.get(key) ?? []),
            ...Array.from(val.values()),
          ]);
        });
      }

      const result: AllowedOffersForTerm[] = [];
      allOffersByTerm.forEach((allowedOffers, term) => {
        result.push({ term, allowedOffers });
      });
      retWithSuccess(req, res, {
        message: `Retention offers for plans`,
        data: result,
      });
    } catch (err) {
      logger.error(
        `${logPrefix()} getRetentionOffersForPlans failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);
