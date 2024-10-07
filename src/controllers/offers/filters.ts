import { NextFunction, Request, Response } from 'express';
import Logger from '../../util/logger';
import { retWithSuccess } from '../../models/SamocResponse';
import asyncHandler from 'express-async-handler';
import {
  FilterState,
  RetentionOfferUserEligibilityPayload,
  RetentionOfferUserEligibilityRule,
  RetentionOfferWeightedList,
} from '../../types/payload';
import {
  CONFIG_SET_ID,
  getAccessToken,
  getConfigOfVersion,
  getConfigValue,
  getRetentionOfferCountry,
  GLSet,
  RetentionConfigurationValue,
  RetentionCountry,
  RetentionOfferList,
  RetentionOfferUserEligibility,
  RetentionOfferUserEligibilityConditions,
  RetentionOfferUserEligibilityWeightedList,
  rollbackToVersion,
  updateExtensionOfferCountry,
  updateRetentionOfferCountries,
  updateDefaultRetentionConfig,
} from '../../services/GhostLocker';
import {
  getRetentionOffersSlackChatMessage,
  publishSlackMessage,
} from '../../services/Slack';
import {
  getFlexSiteUrl,
  getStoreModel,
  processOfferError,
  updateSpinnerText,
} from '../../util/utils';
import {
  Env,
  OfferTypes,
  PlatformEnum,
  SlackConfigType,
} from '../../types/enum';
import {
  OfferType,
  Platform,
  Region,
  RetentionOffer,
  SlackConfig,
  Store,
  UserEligibility,
} from '../../models';
import {
  UserEligibilityModel,
  UserEligibilityStatus,
} from '../../models/UserEligibility';
import { AppError } from '../../util/errorHandler';
import { allStores } from './campaign/utils';
import * as PlayAuth from '../../services/PlayAuth';
import { RegionModel } from 'src/models/Region';
import { StoreModel } from 'src/models/Store';
import { SlackConfigModel } from 'src/models/SlackConfig';

const logger = Logger(module);

const baseEnv = (): Env => (process.env.FILTER_BASE_ENV || Env.PROD) as Env;
const stgEnv = (): Env => (process.env.FILTER_STG_ENV || Env.STG) as Env;
const prodEnv = (): Env => (process.env.FILTER_PROD_ENV || Env.PROD) as Env;

const SLACK_BOT_NAME = 'testBot1';

const getLastFilter = async (store: string): Promise<UserEligibilityModel> => {
  const filters = store
    ? await UserEligibility.findAll({
        where: { storeCode: store },
        order: [['createdAt', 'DESC']],
      })
    : await UserEligibility.findAll({
        where: {
          storeCode: '',
        },
        order: [['createdAt', 'DESC']],
      });
  return filters.length > 0 ? filters[0] : null;
};

const areEqual = (obj1: any, obj2: any) => {
  //Loop through properties in object 1
  let p;
  for (p in obj1) {
    //Check property exists on both objects
    if (obj1.hasOwnProperty(p) !== obj2.hasOwnProperty(p)) return false;

    switch (typeof obj1[p]) {
      //Deep compare objects
      case 'object':
        if (!areEqual(obj1[p], obj2[p])) {
          return false;
        }
        break;
      //Compare function code
      case 'function':
        if (
          typeof obj2[p] == 'undefined' ||
          (p != 'compare' && obj1[p].toString() != obj2[p].toString())
        )
          return false;
        break;
      //Compare values
      default:
        if (obj1[p] != obj2[p]) return false;
    }
  }

  //Check object 2 for any extra properties
  for (p in obj2) {
    if (typeof obj1[p] == 'undefined') return false;
  }
  return true;
};

interface UserEligibilityData {
  country: string;
  retentionOffersLists: RetentionOfferList[];
  userEligibility: RetentionOfferUserEligibility[];
}

interface UserEligibilityState {
  regions: UserEligibilityData[];
  revision: number;
}

const stateData = (state: UserEligibilityData): UserEligibilityData => {
  if (!state || !state.retentionOffersLists || !state.userEligibility) {
    return null;
  }
  return {
    country: state.country,
    retentionOffersLists: state.retentionOffersLists,
    userEligibility: state.userEligibility,
  };
};

const loadUserEligibilityState = async (
  regionCodes: string[],
  env: Env,
): Promise<UserEligibilityState> => {
  const token = await getAccessToken(env);
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
  const regions: UserEligibilityData[] = [];
  if (!regionCodes) {
    for (const country of configValue.countries) {
      if (
        !!country &&
        !!country.retentionOffersLists &&
        !!country.userEligibility
      ) {
        regions.push({
          country: country.country,
          retentionOffersLists: country.retentionOffersLists,
          userEligibility: country.userEligibility,
        });
      }
    }
  } else {
    for (const regionCode of regionCodes) {
      const country = configValue.countries.find(
        (entry) => entry.country.toLowerCase() === regionCode.toLowerCase(),
      );
      if (
        !!country &&
        !!country.retentionOffersLists &&
        !!country.userEligibility
      ) {
        regions.push({
          country: country.country,
          retentionOffersLists: country.retentionOffersLists,
          userEligibility: country.userEligibility,
        });
      }
    }
  }
  return {
    regions,
    revision: config.configurationVersion,
  };
};

const getFilterState = async (
  store: string,
  stgState: UserEligibilityState,
  prodState: UserEligibilityState,
) => {
  const result: FilterState = {
    stgVer: stgState.revision,
    prodVer: prodState.revision,
    status: UserEligibilityStatus.NEW,
    canDelete: false,
    canRetire: false,
    errorMessage: null,
    testUrl: getFlexSiteUrl(prodEnv(), store ? store.slice(-2) : null),
  };

  retry: for (;;) {
    let lastFilter = await getLastFilter(store);

    if (!lastFilter) {
      return result;
    }

    if (lastFilter.statusId === UserEligibilityStatus.DFT) {
      for (const savedData of (lastFilter.prodData as any) as UserEligibilityData[]) {
        const prodRegion = prodState.regions.find(
          (r) => r.country == savedData.country,
        );
        if (prodRegion && !areEqual(savedData, stateData(prodRegion))) {
          result.status = UserEligibilityStatus.NEW;
          result.errorMessage = `User eligibility settings were updated on PROD after DFT was created for ${prodRegion.country.toUpperCase()}`;
          await lastFilter.destroy({ force: false });
          lastFilter = await getLastFilter(store);
          continue retry;
        }
      }
      result.canRetire = true;
      delete result.testUrl;
    } else if (lastFilter.statusId === UserEligibilityStatus.STG) {
      if (stgEnv() != prodEnv()) {
        for (const savedData of (lastFilter.prodData as any) as UserEligibilityData[]) {
          if (!!savedData) {
            const prodRegion = prodState.regions.find(
              (r) => r.country == savedData.country,
            );
            if (prodRegion && !areEqual(savedData, stateData(prodRegion))) {
              result.status = UserEligibilityStatus.NEW;
              result.errorMessage = `User eligibility settings were updated on PROD after STG was created for ${savedData.country.toUpperCase()}`;
              await lastFilter.destroy({ force: false });
              lastFilter = await getLastFilter(store);
              continue retry;
            }
          }
        }
      }
      for (const savedData of (lastFilter.draftData as any) as UserEligibilityData[]) {
        if (!!savedData) {
          const stgRegion = stgState.regions.find(
            (r) => r.country == savedData.country,
          );
          if (stgRegion && !areEqual(savedData, stateData(stgRegion))) {
            result.status = UserEligibilityStatus.NEW;
            result.errorMessage = `User eligibility settings were updated on STG outside SAMOC for ${savedData.country.toUpperCase()}`;
            await lastFilter.destroy({ force: false });
            continue retry;
          }
        }
      }
      result.canRetire = true;
      result.testUrl = getFlexSiteUrl(stgEnv(), store.slice(-2));
    } else if (lastFilter.statusId === UserEligibilityStatus.PROD) {
      // TODO: implement content-based rollback
      if (lastFilter.prodRollbackVersion + 1 === prodState.revision) {
        result.canRetire = true;
      } else {
        result.status = UserEligibilityStatus.NEW;
        return result;
      }
    }
    result.status = lastFilter.statusId;
    result.updatedBy = lastFilter.createdBy;
    result.updatedAt = lastFilter.get('LastModifiedAt') as Date;

    return result;
  }
};

const geListName = (listName: string, index: number): string => {
  const split = listName.split(/: */);
  return split.length > 1 ? split.pop() : index ? `List ${index}` : 'List';
};

const getRuleName = (
  listName: string,
  isDefault: boolean,
  index: number,
): string => {
  let name = listName;
  const lowerCaseName = name.toLowerCase();
  if (
    lowerCaseName.startsWith('SAMOC') &&
    (lowerCaseName.indexOf('primary') != -1 ||
      lowerCaseName.indexOf('secondary') != -1)
  ) {
    name = name.replace(/([0-9]+%[-_ ]*)?:.*$/gi, '');
    name = name.replace(/[-_ ]*primary[-_ ]*$/gi, '');
    name = name.replace(/[-_ ]*secondary[-_ ]$/gi, '');
    name = name.replace(/^samoc[-_ ]*/gi, '');
    name = name.trim();
    if (name === 'Default' && !isEmptyCondition) {
      name = `Criteria ${index + 1}`;
    }
  } else {
    if (isDefault) {
      name = 'Default';
    } else {
      name = `Criteria ${index + 1} (${listName})`;
    }
  }
  return name;
};

export const extractRules = (country: UserEligibilityData) => {
  if (!country || !country.retentionOffersLists || !country.userEligibility) {
    return null;
  }
  const listsByName = new Map<string, string[]>(
    country.retentionOffersLists.map((list) => [list.name, list.offerIds]),
  );
  let hasDefault = false;
  const rules = country.userEligibility.map((cond, index) => {
    let primaryListName: string | null = null;
    const primaryLists = cond.offers.primaryOffersLists.map(
      (list, listIndex) => {
        const offers = listsByName.get(list.listName);
        if (!primaryListName) {
          primaryListName = list.listName;
        }
        return {
          name: geListName(list.listName, listIndex),
          weight: list.weight,
          offers: offers,
        };
      },
    );
    let secondaryListName: string | null = null;
    const secondaryLists = cond.offers.secondaryOffersLists.map(
      (list, listIndex) => {
        const offers = listsByName.get(list.listName);
        if (!secondaryListName) {
          secondaryListName = list.listName;
        }
        return {
          name: geListName(list.listName, listIndex),
          weight: list.weight,
          offers: offers,
        };
      },
    );
    const hasEmptyCondition = isEmptyCondition(cond.conditions);
    const name = getRuleName(
      primaryListName ?? secondaryListName ?? '',
      hasEmptyCondition,
      index,
    );
    hasDefault = hasDefault || hasEmptyCondition || name === 'Default';
    if (!cond.conditions.planLengthInMonths) {
      delete cond.conditions.planLengthInMonths;
    }
    // use == to catch undefined
    if (cond.conditions.isInFreeTrial == null) {
      delete cond.conditions.isInFreeTrial;
    }
    if (!cond.conditions.activeCoupons?.length) {
      delete cond.conditions.activeCoupons;
    }
    if (!cond.conditions.inactiveCoupons?.length) {
      delete cond.conditions.inactiveCoupons;
    }
    const rule: RetentionOfferUserEligibilityRule = {
      ...cond.conditions,
      name,
      countries: [country.country],
      primaryLists: primaryLists.filter((list) => list.offers.length > 0),
      secondaryLists: secondaryLists.filter((list) => list.offers.length > 0),
      exclusiveOfferOverrides: cond.exclusiveOfferOverrides || null,
    };
    return rule;
  });
  return rules;
};

const getStringFromRule = (
  rule: RetentionOfferUserEligibilityRule,
  globalMapping: Map<string, Map<string, string>>,
): string => {
  const mapping = globalMapping.get(rule.countries[0]);
  let tempRulePrimaryOffers = '';
  let tempRuleSecondaryOffers = '';
  let tempRuleExclusiveOfferOverrides = '';
  if (!!rule.primaryLists && rule.primaryLists.length) {
    rule.primaryLists.forEach((list) => {
      const offers = list.offers.map((offer) => mapping?.get(offer) ?? offer);
      tempRulePrimaryOffers += `${list.weight}/${offers.join('/')}`;
    });
  }
  if (!!rule.secondaryLists && rule.secondaryLists.length) {
    rule.secondaryLists.forEach((list) => {
      const offers = list.offers.map((offer) => mapping?.get(offer) ?? offer);
      tempRuleSecondaryOffers += `${list.weight}/${offers.join('/')}`;
    });
  }
  if (!!rule.exclusiveOfferOverrides) {
    rule.exclusiveOfferOverrides.forEach((offer: any) => {
      tempRuleExclusiveOfferOverrides += `${offer.country}/${
        !!offer.state ? offer.state : ''
      }/${offer.offerId}`;
    });
  }
  return `${rule.planLengthInMonths}/${rule.isInFreeTrial}/${rule.activeCoupons}/${rule.inactiveCoupons}/${tempRulePrimaryOffers}/${tempRuleSecondaryOffers}/${tempRuleExclusiveOfferOverrides}`;
};

interface Country {
  name: string;
  rules: string[];
}

interface Merged {
  countries: Set<number>;
  rule: string;
}

// Merge rules for different countries
// 1. For each country calculate number of collisions for the last rule
//    (collision here if there are some other country which has the same rule, and it's not the last one)
// 2. Select a country with the smallest number of collisions
// 3. Insert this rule to the resulting list - there are several cases here:
//    - such rule was not processed yet, just add it to the front
//    - this rule was already processed for another country, in this case find the position of the most recently added
//      such rule and position of the most recently added rule for this country
//        - if there is no rule for the country or this rule position is greater than the position of the existing rule,
//          update the existing one
//        - otherwise add it to the front
// repeat these steps until all rules are processes.
const mergeRules = (input: Country[]): Merged[] => {
  const result: Merged[] = [];

  for (;;) {
    let best_collisions = 0;
    let best_country: number | null = null;
    for (let idx = 0; idx < input.length; idx++) {
      const country = input[idx];
      if (country.rules.length > 0) {
        const rule = country.rules[country.rules.length - 1];
        let collisions = 0;
        for (const anotherCountry of input) {
          const pos = anotherCountry.rules.indexOf(rule);
          if (pos >= 0 && pos != anotherCountry.rules.length - 1) {
            collisions++;
          }
        }
        if (best_country === null || best_collisions > collisions) {
          best_country = idx;
          best_collisions = collisions;
        }
      }
    }
    if (best_country === null) {
      break;
    }
    const rule = input[best_country].rules.pop();
    const merge_position = result.findIndex((val) => val.rule === rule);
    let insert_position: number | null = null;
    if (merge_position >= 0) {
      const country_position = result.findIndex((val) =>
        val.countries.has(best_country),
      );
      if (country_position >= 0 && country_position > merge_position) {
        insert_position = merge_position;
      }
    }
    if (insert_position !== null) {
      result[insert_position].countries.add(best_country);
    } else {
      result.unshift({ countries: new Set([best_country]), rule });
      for (let idx = 0; idx < input.length; idx++) {
        const country = input[idx];
        if (
          country.rules.length > 0 &&
          country.rules[country.rules.length - 1] === rule
        ) {
          country.rules.pop();
          result[0].countries.add(idx);
        }
      }
    }
  }

  return result;
};

const sortRules = async (rules: RetentionOfferUserEligibilityRule[]) => {
  const allOffers = await RetentionOffer.findAll();
  const offerToCampaign = new Map<string, Map<string, string>>();
  for (const offer of allOffers) {
    const country = offer.storeCode.slice(-2).toUpperCase();
    let map = offerToCampaign.get(country);
    if (!map) {
      map = new Map<string, string>();
      offerToCampaign.set(country, map);
    }
    map.set(offer.offerCode, offer.campaign);
    if (offer.upgradeOfferCode) {
      map.set(offer.upgradeOfferCode, offer.campaign + '_upgrade');
    }
  }

  const countryRules: Map<string, Country> = new Map();
  const countryRulesMapping: Map<
    string,
    Map<string, RetentionOfferUserEligibilityRule>
  > = new Map();
  for (const rule of rules) {
    const str = getStringFromRule(rule, offerToCampaign);
    for (const c of rule.countries) {
      let country = countryRules.get(c);
      if (!country) {
        country = {
          name: c,
          rules: [],
        };
        countryRules.set(c, country);
      }
      country.rules.push(str);
      let mapping = countryRulesMapping.get(c);
      if (!mapping) {
        mapping = new Map();
        countryRulesMapping.set(c, mapping);
      }
      mapping.set(str, rule);
    }
  }
  const countriesByIdx = Array.from(countryRules.values());
  countriesByIdx.sort().reverse();
  const merged = mergeRules(countriesByIdx);
  const processedRules: Set<string> = new Set();
  let suffix = 0;
  const result: RetentionOfferUserEligibilityRule[] = [];
  for (const mergedRule of merged) {
    if (processedRules.has(mergedRule.rule)) {
      suffix++;
    } else {
      processedRules.add(mergedRule.rule);
    }
    for (const countryIdx of mergedRule.countries) {
      const country = countriesByIdx[countryIdx];
      const rule = countryRulesMapping.get(country.name).get(mergedRule.rule);
      rule.suffix = suffix;
      result.push(rule);
    }
  }
  return result;
};

/**
 * GET /api/offers/retention/rules?store=<storeCode>
 * Get all user eligibility rules for retention offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const getRetentionOfferRules = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Retention Offer - getRetentionOfferRules');
    const { store } = req.query;
    const storeModels = [];
    if (store) {
      storeModels.push(await getStoreModel(store as string));
    } else {
      const storesByCode = await allStores();
      for (const storeCode of Object.getOwnPropertyNames(storesByCode)) {
        storeModels.push(storesByCode[storeCode]);
      }
    }

    const message = 'Found User Eligibility Rules';
    const rules: RetentionOfferUserEligibilityRule[] = [];
    const lastFilter = await getLastFilter(store ? (store as string) : '');
    const stgState = await loadUserEligibilityState(null, stgEnv());
    const prodState =
      stgEnv() != prodEnv()
        ? await loadUserEligibilityState(null, prodEnv())
        : stgState;
    const filterState = await getFilterState(
      store ? (store as string) : '',
      stgState,
      prodState,
    );
    const isStg = filterState.status === UserEligibilityStatus.STG;
    const baseToken = await getAccessToken(baseEnv());
    const baseConfig = await getConfigValue(
      GLSet.RET_RECURLY_V2,
      baseEnv(),
      baseToken,
    );

    if (!store && !lastFilter) {
      let stgConfig = null;
      if (isStg) {
        const token = await getAccessToken(stgEnv());
        stgConfig = await getConfigValue(GLSet.RET_RECURLY_V2, stgEnv(), token);
      }
      const regionModels: RegionModel[] = await Region.findAll();
      for (const regionModel of regionModels) {
        const config = isStg ? stgConfig : baseConfig;
        const country = await getRetentionOfferCountry(
          regionModel.title,
          config,
        );
        const newRules = extractRules(country);
        if (!!newRules && newRules.length) {
          newRules.forEach((rule) => {
            rules.push(rule);
          });
        }
      }

      const result: RetentionOfferUserEligibilityPayload = {
        regions: regionModels.map((region) => region.title),
        filterState,
        rules,
      };
      retWithSuccess(req, res, {
        message,
        data: result,
      });
    } else {
      lastFilter.draftData = !!lastFilter.draftData
        ? JSON.parse(JSON.stringify(lastFilter.draftData)).filter(
            (region: any) => region !== null,
          )
        : null;
      const regions = lastFilter?.regions ? lastFilter?.regions.split(',') : [];
      const env = isStg ? stgEnv() : baseEnv();

      if (filterState.status === UserEligibilityStatus.DFT) {
        const draftData: UserEligibilityData[] = JSON.parse(
          JSON.stringify(lastFilter.draftData),
        );
        for (const storeModel of storeModels) {
          const region = storeModel.regionCode.toUpperCase();
          let country: UserEligibilityData = await getRetentionOfferCountry(
            storeModel.regionCode,
            baseConfig,
          );
          if (
            regions.length == 0 ||
            regions.includes(storeModel.regionCode.toUpperCase())
          ) {
            const data = draftData.find((c) => c.country === region);
            if (data) {
              country = data;
            }
          }
          const newRules = extractRules(country);
          if (!!newRules && newRules.length) {
            newRules.forEach((rule) => {
              rules.push(rule);
            });
          }
        }
      } else {
        let stgConfig = null;
        if (isStg) {
          const token = await getAccessToken(stgEnv());
          stgConfig = await getConfigValue(
            GLSet.RET_RECURLY_V2,
            stgEnv(),
            token,
          );
        }

        for (const storeModel of storeModels) {
          const config =
            isStg &&
            (regions.length == 0 ||
              regions.includes(storeModel.regionCode.toUpperCase()))
              ? stgConfig
              : baseConfig;
          const country = await getRetentionOfferCountry(
            storeModel.regionCode,
            config,
          );
          const newRules = extractRules(country);
          if (!!newRules && newRules.length) {
            newRules.forEach((rule) => {
              rules.push(rule);
            });
          }
        }
      }

      if (rules.length === 0) {
        retWithSuccess(req, res, {
          message: `No cancellation offers found for store (${store}) and environment (${env})`,
          data: null,
        });
      } else {
        const result: RetentionOfferUserEligibilityPayload = {
          regions: lastFilter?.regions
            ? lastFilter.regions.split(',')
            : undefined,
          filterState,
          rules: await sortRules([
            ...rules.filter((r) => !regions.includes(r.countries[0])),
            ...rules.filter((r) => regions.includes(r.countries[0])),
          ]),
        };
        retWithSuccess(req, res, {
          message,
          data: result,
        });
      }
    }
  },
);

/**
 * GET /api/offers/extension/rules?store=<storeCode>
 * Get all user eligibility rules for extension offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const getExtensionOfferRules = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Extension Offer - getExtensionOfferRules');
    const { store } = req.query;
    const storeModel: StoreModel = await getStoreModel(store as string);
    const stgToken = await getAccessToken(Env.STG);
    const stgConfig = await getConfigValue(GLSet.UNIVERSAL, Env.STG, stgToken);
    const prodToken = await getAccessToken(Env.PROD);
    const prodConfig = await getConfigValue(
      GLSet.UNIVERSAL,
      Env.PROD,
      prodToken,
    );

    const data = {
      stgConfig,
      prodConfig,
    };
    const message = 'Found User Extension Offer Type Rules';

    retWithSuccess(req, res, {
      message,
      data,
    });
  },
);

/**
 * PUT /api/offers/extension/rules?store=<storeCode>&envState=<envCode>
 * Update user eligibility rules for extension offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateExtensionOfferRules = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Extension Offer - updateExtensionOfferRules');
    const { store, stateEnv, changedBy } = req.query;
    const storeModel: StoreModel = await getStoreModel(store as string);
    const env = stateEnv === Env.PROD ? Env.PROD : Env.STG;

    const updateResp = await updateExtensionOfferCountry(
      storeModel.regionCode,
      env,
      req.body,
      changedBy as string,
    );
    const message = 'User Extension Offer Type Rules updated successfully';

    retWithSuccess(req, res, {
      message,
      data: updateResp.data,
    });
  },
);

const getBaseListName = (
  name: string,
  index: number,
  suffix: string,
): string => {
  const strIndex = index ? ' ' + index : '';
  return `SAMOC ${name}${strIndex} ${suffix}`;
};

interface UpdateListsResult {
  newLists: RetentionOfferList[];
  ruleLists: RetentionOfferUserEligibilityWeightedList[];
}

const isEmptyCondition = (
  conditions: RetentionOfferUserEligibilityConditions,
): boolean => {
  return (
    !conditions.planLengthInMonths &&
    conditions.isInFreeTrial == null && // must use == here to catch undefined !!!
    !conditions.activeCoupons?.length &&
    !conditions.inactiveCoupons?.length
  );
};

const updateLists = (
  name: string,
  nameIndex: number,
  suffix: string,
  lists: RetentionOfferWeightedList[],
  listsByName: Map<string, RetentionOfferList>,
): UpdateListsResult | null => {
  const baseListName = getBaseListName(name, nameIndex, suffix);

  const relativeListNames = new Set<string>();
  const nonEmptyLists = lists.filter(
    (list) => list.offers.length > 0 && list.weight > 0,
  );
  const weights = nonEmptyLists.reduce((sum, list) => sum + list.weight, 0);
  if (weights > 100) {
    throw new AppError('total list weight exceeds 100%', 500);
  }
  const newLists: RetentionOfferList[] = [];
  const ruleLists: RetentionOfferUserEligibilityWeightedList[] = [];
  let relativeListIndex = 1;
  for (const list of nonEmptyLists) {
    let listName = list.name;
    while (relativeListNames.has(listName)) {
      listName = list.name
        ? `${list.name} ${relativeListIndex}`
        : `${relativeListIndex}`;
      relativeListIndex += 1;
    }
    relativeListNames.add(listName);
    const fullListName = `${baseListName}: ${listName}`;
    if (listsByName.has(fullListName)) {
      return null;
    }
    newLists.push({
      name: fullListName,
      offerIds: list.offers,
    });
    ruleLists.push({
      listName: fullListName,
      weight: list.weight,
    });
  }
  if (weights < 100) {
    let relativeEmptyListIndex = 1;
    let listName = 'Empty';
    while (relativeListNames.has(listName)) {
      listName = `Empty ${relativeEmptyListIndex++}`;
    }
    const fullListName = `${baseListName}: ${listName}`;
    if (listsByName.has(fullListName)) {
      return null;
    }
    newLists.push({
      name: fullListName,
      offerIds: [],
    });
    ruleLists.push({
      listName: fullListName,
      weight: 100 - weights,
    });
  }
  return { newLists, ruleLists };
};

export const updateCountryRules = (
  country: RetentionCountry,
  rules: RetentionOfferUserEligibilityRule[],
): void => {
  const listsByName = new Map<string, RetentionOfferList>();
  const userEligibility: RetentionOfferUserEligibility[] = [];
  for (const condition of rules) {
    if (!condition.name) {
      condition.name = 'Default';
    }
    let ruleNameIndex = 0;

    // create unique names for offer lists
    let primaryLists: UpdateListsResult = null;
    let secondaryLists: UpdateListsResult = null;
    for (;;) {
      primaryLists = updateLists(
        condition.name,
        ruleNameIndex,
        'Primary',
        condition.primaryLists,
        listsByName,
      );
      if (!primaryLists) {
        ruleNameIndex++;
        continue;
      }

      secondaryLists = updateLists(
        condition.name,
        ruleNameIndex,
        'Secondary',
        condition.secondaryLists,
        listsByName,
      );
      if (!secondaryLists) {
        ruleNameIndex++;
        continue;
      }
      break;
    }
    for (const list of primaryLists.newLists) {
      listsByName.set(list.name, list);
    }
    for (const list of secondaryLists.newLists) {
      listsByName.set(list.name, list);
    }
    let resultObj: any = {
      conditions: {
        planLengthInMonths: condition.planLengthInMonths,
        isInFreeTrial: condition.isInFreeTrial,
        activeCoupons: condition.activeCoupons,
        inactiveCoupons: condition.inactiveCoupons,
      },
      offers: {
        primaryOffersLists: primaryLists.ruleLists,
        secondaryOffersLists: secondaryLists.ruleLists,
      },
      exclusiveOfferOverrides: null,
    };
    if (condition.exclusiveOfferOverrides) {
      resultObj.exclusiveOfferOverrides = condition.exclusiveOfferOverrides;
    }
    userEligibility.push(resultObj);
  }

  const newLists: RetentionOfferList[] = [];
  for (const list of listsByName) {
    newLists.push(list[1]); // replace existing list with a new one
  }
  if (
    !!country &&
    !!country.retentionOffersLists &&
    !!country.userEligibility
  ) {
    for (const list of country.retentionOffersLists) {
      if (!listsByName.has(list.name)) {
        if (!list.name.startsWith('SAMOC')) {
          // keep non-SAMOC lists
          newLists.push(list);
        }
      }
    }
    country.retentionOffersLists = newLists;
    country.userEligibility = userEligibility;
  }
};

/**
 * PUT /api/retention/rules?store=<storeCode>&publish=<true|false>
 * Get all cancellation offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateRetentionRules = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { store, publish } = req.query;

    const payload = req.body as RetentionOfferUserEligibilityPayload;

    const storeCode = store ? (store as string) : '';
    const storeModels = storeCode
      ? [await getStoreModel(storeCode)]
      : Object.values(await allStores());
    const isProd = publish === 'true';
    const isDraft = publish === 'draft';
    const env = isProd ? prodEnv() : stgEnv();

    const regionCodes = storeCode
      ? [storeModels[0].regionCode]
      : payload.regions.map((s) => s.toLowerCase());

    updateSpinnerText('Updating user eligibility rules...');

    const stgState = await loadUserEligibilityState(null, stgEnv());
    const prodState =
      stgEnv() != prodEnv()
        ? await loadUserEligibilityState(null, prodEnv())
        : stgState;

    const actualState = await getFilterState(storeCode, stgState, prodState);
    if (actualState.errorMessage) {
      return next(
        processOfferError(new AppError(actualState.errorMessage, 400)),
      );
    }

    if (
      actualState.status !== payload.filterState.status ||
      actualState.prodVer !== payload.filterState.prodVer ||
      actualState.stgVer !== payload.filterState.stgVer
    ) {
      return next(
        processOfferError(
          new AppError(`Cancellation offers were updated by another user`, 400),
        ),
      );
    }

    const token = await getAccessToken(env);
    const config = await getConfigValue(
      GLSet.RET_RECURLY_V2,
      env as Env,
      token,
    );

    try {
      const stgStateData: UserEligibilityData[] = [];
      const prodStateData: UserEligibilityData[] = [];
      const dftData: UserEligibilityData[] = [];
      const updatedCountries = new Map<string, RetentionCountry>();
      for (const storeModel of storeModels) {
        if (!regionCodes.includes(storeModel.regionCode.toLowerCase())) {
          continue;
        }
        const country = await getRetentionOfferCountry(
          storeModel.regionCode,
          config,
        );

        const filteredRules = payload.rules.filter(
          (r) =>
            !r.countries ||
            r.countries.includes(storeModel.regionCode.toUpperCase()),
        );
        if (isDraft) {
          if (payload.filterState.status === UserEligibilityStatus.STG) {
            return next(
              processOfferError(
                new AppError(
                  `Workflow violation - pushed to STG filters can't be saved as DTF`,
                  400,
                ),
              ),
            );
          }
          updateCountryRules(country, filteredRules);
          dftData.push(stateData(country));
          const prodCountryData = prodState.regions.find(
            (r) =>
              r.country.toLowerCase() == storeModel.regionCode.toLowerCase(),
          );
          prodStateData.push(stateData(prodCountryData));
        } else {
          if (
            isProd &&
            payload.filterState.status !== UserEligibilityStatus.STG
          ) {
            return next(
              processOfferError(
                new AppError(
                  `Workflow violation - create filters on stage before publishing`,
                  400,
                ),
              ),
            );
          }
          updateCountryRules(country, filteredRules);
          updatedCountries.set(storeModel.regionCode, country);
          dftData.push(stateData(country));
          const prodCountryData = prodState.regions.find(
            (r) =>
              r.country.toLowerCase() == storeModel.regionCode.toLowerCase(),
          );
          const stgCountryData = prodState.regions.find(
            (r) =>
              r.country.toLowerCase() == storeModel.regionCode.toLowerCase(),
          );
          prodStateData.push(stateData(prodCountryData));
          stgStateData.push(stateData(stgCountryData));
        }

        // clear PlayAuth cache
        updateSpinnerText('Clearing PlayAuth cache...');
        await PlayAuth.clearOfferCache(
          storeModel,
          isProd ? Env.PROD : Env.STG,
          GLSet.RET_RECURLY_V2,
        );
      }
      if (isDraft) {
        let lastFilter = await getLastFilter(storeCode);
        if (!lastFilter || lastFilter.statusId !== UserEligibilityStatus.DFT) {
          lastFilter = await UserEligibility.build({
            storeCode,
            statusId: UserEligibilityStatus.NEW,
            prodData: JSON.parse(JSON.stringify(prodStateData)),
            prodRollbackVersion: prodState.revision,
          });
        }
        lastFilter.createdBy = payload.filterState.updatedBy ?? 'Unknown';
        lastFilter.statusId = UserEligibilityStatus.DFT;
        lastFilter.draftData = JSON.parse(JSON.stringify(dftData));
        lastFilter.regions = payload.regions ? payload.regions.join(',') : null;
        await lastFilter.save();
      } else {
        let lastFilter = await getLastFilter(storeCode);
        if (!lastFilter || lastFilter.statusId === UserEligibilityStatus.PROD) {
          lastFilter = await UserEligibility.build({
            storeCode,
            statusId: UserEligibilityStatus.NEW,
            prodData: JSON.parse(JSON.stringify(prodStateData)),
            prodRollbackVersion: prodState.revision,
          });
        }
        if (lastFilter.statusId !== UserEligibilityStatus.STG) {
          lastFilter.stgData = JSON.parse(JSON.stringify(stgStateData));
          lastFilter.stgRollbackVersion = stgState.revision;
        }
        lastFilter.draftData = JSON.parse(JSON.stringify(dftData));
        lastFilter.regions = payload.regions ? payload.regions.join(',') : null;

        //TODO:
        if (isProd && stgEnv() === prodEnv()) {
          lastFilter.prodRollbackVersion = lastFilter.stgRollbackVersion;
          lastFilter.statusId = UserEligibilityStatus.PROD;
        } else {
          const [
            updateResp,
            updatedPayload,
          ] = await updateRetentionOfferCountries(
            updatedCountries,
            env,
            payload.filterState.updatedBy ?? 'Unknown',
            true,
          );
          lastFilter.createdBy = payload.filterState.updatedBy;
          if (isProd) {
            const slackConfigModels: SlackConfigModel[] = await SlackConfig.findAll(
              {
                where: {
                  type: SlackConfigType.FILTERS,
                },
              },
            );
            const regionCodesUC = regionCodes.map((regionCode) =>
              regionCode.toUpperCase(),
            );
            if (!!slackConfigModels && !!slackConfigModels.length) {
              for (let slackConfigModel of slackConfigModels) {
                if (slackConfigModel.enabled) {
                  let previousVersion = null;
                  let currentVersion = null;
                  if (env === prodEnv()) {
                    previousVersion = lastFilter.prodRollbackVersion;
                    currentVersion = lastFilter.prodRollbackVersion + 1;
                  } else if (env === stgEnv()) {
                    previousVersion = lastFilter.stgRollbackVersion;
                    currentVersion = lastFilter.stgRollbackVersion + 1;
                  }
                  const message = getRetentionOffersSlackChatMessage(
                    env,
                    regionCodesUC.join(', '),
                    updateResp,
                    payload.filterState.updatedBy,
                    isProd,
                    previousVersion,
                    currentVersion,
                  );
                  await publishSlackMessage(slackConfigModel, message);
                }
              }
            }
            lastFilter.statusId = UserEligibilityStatus.PROD;
          } else {
            lastFilter.statusId = UserEligibilityStatus.STG;
          }
        }
        await lastFilter.save();
      }

      retWithSuccess(req, res, {
        message: isDraft
          ? 'Cancellation offers were successfully saved as DFT'
          : isProd
          ? 'Cancellation offers were successfully published on PROD'
          : 'Cancellation offers were successfully pushed to STG',
        data: {},
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * PUT /api/retention/filters/retire?store=<storeCode>
 * Get all cancellation offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const retireRetentionFilters = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { store } = req.query;
    const storeCode = store ? (store as string) : '';
    const payload = req.body as FilterState;
    updateSpinnerText('Rolling back filters...');
    const stgState = await loadUserEligibilityState(null, stgEnv());
    const prodState =
      stgEnv() != prodEnv()
        ? await loadUserEligibilityState(null, prodEnv())
        : stgState;
    try {
      const filterState = await getFilterState(storeCode, stgState, prodState);
      if (
        filterState.status !== payload.status ||
        filterState.prodVer !== payload.prodVer ||
        filterState.stgVer !== payload.stgVer
      ) {
        return next(
          processOfferError(
            new AppError(
              `Cancellation offers were updated by another user`,
              400,
            ),
          ),
        );
      }

      if (
        !filterState.canRetire ||
        filterState.status == UserEligibilityStatus.NEW
      ) {
        return next(
          processOfferError(new AppError(`Rollback is not supported`, 400)),
        );
      }
      const lastFilter = await getLastFilter(storeCode);
      if (!lastFilter) {
        return next(
          processOfferError(
            new AppError(`Can't retire non-existent filters`, 400),
          ),
        );
      }

      if (
        filterState.status === UserEligibilityStatus.PROD &&
        stgEnv() !== prodEnv()
      ) {
        if (lastFilter.prodRollbackVersion + 1 === prodState.revision) {
          await rollbackToVersion(
            GLSet.RET_RECURLY_V2,
            '',
            lastFilter.prodRollbackVersion,
            prodEnv(),
          );
        } else {
          // TODO: implement content-based rollback
        }
      }
      if (
        filterState.status === UserEligibilityStatus.STG ||
        filterState.status === UserEligibilityStatus.PROD
      ) {
        if (lastFilter.stgRollbackVersion + 1 === stgState.revision) {
          await rollbackToVersion(
            GLSet.RET_RECURLY_V2,
            '',
            lastFilter.stgRollbackVersion,
            stgEnv(),
          );
        } else {
          const regions = lastFilter?.regions
            ? lastFilter?.regions.split(',')
            : [];

          const token = await getAccessToken(Env.STG);
          const config = await getConfigValue(
            GLSet.RET_RECURLY_V2,
            Env.STG,
            token,
          );
          const countries = new Map<string, RetentionCountry>();
          for (const savedData of (lastFilter.stgData as any) as UserEligibilityData[]) {
            const regionCode = savedData.country.toLowerCase();
            const country = await getRetentionOfferCountry(regionCode, config);
            if (
              !!country &&
              !!country.retentionOffersLists &&
              !!savedData &&
              !!savedData.retentionOffersLists
            ) {
              if (regions.length == 0 || regions.includes(savedData.country)) {
                country.retentionOffersLists = savedData.retentionOffersLists;
                country.userEligibility = savedData.userEligibility;
              }
              countries.set(regionCode, country);
            }
          }
          await updateRetentionOfferCountries(
            countries,
            Env.STG,
            payload.updatedBy ?? 'Unknown',
          );
        }
      }
      await lastFilter.destroy();
      retWithSuccess(req, res, {
        message:
          filterState.status === UserEligibilityStatus.DFT
            ? 'Cancellation offers DFT was deleted successfully'
            : `Cancellation offers were rolled back successfully`,
        data: {},
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * Update last filter up to current GL retention rules config
 * PUT /api/offers/ghost-locker/rules
 * @param {Request}     req
 * @param {Response}    res
 */
export const synchronizeFilters = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let { regions, createdBy } = req.body;
    regions = !!regions ? (regions as string).split(',') : null;
    let storeCode: string = null;

    try {
      if (!!regions && !!regions.length && regions.length === 1) {
        const storeModel: StoreModel = await Store.findOne({
          where: {
            platformCode: PlatformEnum.WEB,
            regionCode: regions[0].toLowerCase(),
          },
        });
        storeCode = !!storeModel ? storeModel.storeCode : null;
      }
      const stgState = await loadUserEligibilityState(regions, stgEnv());
      const prodState = await loadUserEligibilityState(regions, prodEnv());

      const message =
        !!stgState && !!prodState
          ? 'GhostLocker configuration found'
          : 'GhostLocker configuration not found';

      if ((!stgState && !prodState) || !prodState) {
        throw new AppError('GhostLocker PROD state not found', 404);
      }

      const stgData: JSON = JSON.parse(
        JSON.stringify(stgState.regions as any[]),
      );
      const prodData: JSON = JSON.parse(
        JSON.stringify(prodState.regions as any[]),
      );

      const stgRollbackVersion = stgState.revision;
      const prodRollbackVersion = prodState.revision;

      const payload: any = {
        storeCode,
        regions:
          !!regions && !!regions.length && regions.length === 1
            ? null
            : regions.join(','),
        statusId: UserEligibilityStatus.PROD,
        draftData: null,
        prodData,
        stgData,
        stgRollbackVersion,
        prodRollbackVersion,
        createdBy: createdBy as string,
      };

      let userEiligibilityModels: UserEligibilityModel[];
      if (!!storeCode) {
        userEiligibilityModels = await UserEligibility.findAll({
          where: { storeCode },
        });
      } else {
        userEiligibilityModels = await UserEligibility.findAll({
          where: { storeCode: null },
        });
      }

      if (!!userEiligibilityModels && userEiligibilityModels.length) {
        for (let userEiligibilityModel of userEiligibilityModels) {
          await userEiligibilityModel.destroy({ force: false });
        }
      }

      await UserEligibility.create(payload);

      retWithSuccess(req, res, {
        message,
        data: payload,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * Get two versions data of GL config
 * GET /api/offers/ghost-locker/versions
 * @param {Request}     req
 * @param {Response}    res
 */
export const getGLConfigVersionsData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // let { env, firstVersion, secondVersion } = req.query;
    const env = req.query.env as Env;
    const firstVersion = Number(req.query.firstVersion);
    const secondVersion = Number(req.query.secondVersion);

    try {
      const token = await getAccessToken(env);
      // get first config version data
      const firstConfig = await getConfigOfVersion(
        GLSet.RET_RECURLY_V2,
        firstVersion,
        token,
        env,
      );
      // get second config version data
      const secondConfig = await getConfigOfVersion(
        GLSet.RET_RECURLY_V2,
        secondVersion,
        token,
        env,
      );

      let message = 'GhostLocker configuration versions not found';
      let data = null;
      if (!!firstConfig && !!secondConfig) {
        message = 'GhostLocker configuration versions found';
        data = {
          firstVersion: JSON.parse(firstConfig.configurationValue),
          secondVersion: JSON.parse(secondConfig.configurationValue),
        };
      }

      retWithSuccess(req, res, {
        message,
        data,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/filters?regionCode
 * Get GL Default configs
 * @param {Request}     req
 * @param {Response}    res
 */
export const getDefaultGLConfigs = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('GhostLocker Controller - updateDefaultGLConfigs');
    const regionCode = req.query.regionCode as string;

    try {
      let data: any = {
        name: 'Default',
        isStgEqualProd: true,
        storeFront: [],
      };
      let message = 'GhostLocker configurations versions not found';

      // get access tokens
      const stgToken = await getAccessToken(Env.STG);
      const prodToken = await getAccessToken(Env.PROD);

      // get apple storefront config value
      const stgAppleConfig = await getConfigOfVersion(
        GLSet.RET_APPLE_V3,
        'current',
        stgToken,
        Env.STG,
      );
      const prodAppleConfig = await getConfigOfVersion(
        GLSet.RET_APPLE_V3,
        'current',
        prodToken,
        Env.PROD,
      );
      if (
        stgAppleConfig.configurationValue !== prodAppleConfig.configurationValue
      ) {
        data.isStgEqualProd = false;
      }
      const foundAppleCountry = JSON.parse(
        stgAppleConfig.configurationValue,
      ).countries.find((country: any) => country.country === regionCode);
      if (!!foundAppleCountry) {
        data.storeFront.push({
          name: 'Apple',
          isEnabled: foundAppleCountry.enabled,
          primaryLists: foundAppleCountry.primaryOffers,
          secondaryLists: foundAppleCountry.secondaryOffers,
        });
      }

      // get google storefront config value
      const stgGoogleConfig = await getConfigOfVersion(
        GLSet.RET_GOOGLE_V3,
        'current',
        stgToken,
        Env.STG,
      );
      const prodGoogleConfig = await getConfigOfVersion(
        GLSet.RET_GOOGLE_V3,
        'current',
        prodToken,
        Env.PROD,
      );
      if (
        stgGoogleConfig.configurationValue !==
        prodGoogleConfig.configurationValue
      ) {
        data.isStgEqualProd = false;
      }
      const foundGoogleCountry = JSON.parse(
        stgGoogleConfig.configurationValue,
      ).countries.find((country: any) => country.country === regionCode);
      if (!!foundGoogleCountry) {
        data.storeFront.push({
          name: 'Google',
          isEnabled: foundGoogleCountry.enabled,
          primaryLists: foundGoogleCountry.primaryOffers,
          secondaryLists: foundGoogleCountry.secondaryOffers,
        });
      }

      // get recurly storefront config value
      const stgRecurlyConfig = await getConfigOfVersion(
        GLSet.RET_RECURLY_V3,
        'current',
        stgToken,
        Env.STG,
      );
      const prodRecurlyConfig = await getConfigOfVersion(
        GLSet.RET_RECURLY_V3,
        'current',
        prodToken,
        Env.PROD,
      );
      if (
        stgRecurlyConfig.configurationValue !==
        prodRecurlyConfig.configurationValue
      ) {
        data.isStgEqualProd = false;
      }
      const foundRecurlyCountry = JSON.parse(
        stgRecurlyConfig.configurationValue,
      ).countries.find((country: any) => country.country === regionCode);
      if (!!foundRecurlyCountry) {
        data.storeFront.push({
          name: 'Recurly',
          isEnabled: foundRecurlyCountry.enabled,
          primaryLists: foundRecurlyCountry.primaryOffers,
          secondaryLists: foundRecurlyCountry.secondaryOffers,
        });
      }

      if (!!data.storeFront.length) {
        message = 'GhostLocker configurations versions were found';
      }
      retWithSuccess(req, res, {
        message,
        data,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * PUT /api/filters?regionCode&env
 * Update GL Default configs
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateDefaultGLConfigs = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('GhostLocker Controller - updateDefaultGLConfigs');
    const regionCode = req.query.regionCode as string;
    const env = req.query.env as Env;
    let message = 'GhostLocker configuration versions not found';

    try {
      const { applePayload, googlePayload, recurlyPayload } = req.body;
      let data: any = {};
      const token = await getAccessToken(env);
      if (!!applePayload) {
        data.applePayload = await updateDefaultRetentionConfig(
          GLSet.RET_APPLE_V3,
          regionCode,
          env,
          token,
          applePayload,
        );
      }
      if (!!googlePayload) {
        data.googlePayload = await updateDefaultRetentionConfig(
          GLSet.RET_GOOGLE_V3,
          regionCode,
          env,
          token,
          googlePayload,
        );
      }
      if (!!recurlyPayload) {
        data.recurlyPayload = await updateDefaultRetentionConfig(
          GLSet.RET_RECURLY_V3,
          regionCode,
          env,
          token,
          recurlyPayload,
        );
      }
      if (
        !!data.applePayload ||
        !!data.googlePayload ||
        !!data.recurlyPayload
      ) {
        message = 'GhostLocker configurations updated successfully';
      }
      retWithSuccess(req, res, {
        message,
        data,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/filters/sync?regionCode
 * Rollback default GL configs to PROD
 * @param {Request}     req
 * @param {Response}    res
 */
export const rollbackDefaultGLConfigsToProd = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('GhostLocker Controller - rollbackDefaultGLConfigsToProd');
    const regionCode = req.query.regionCode as string;

    try {
      let message = 'GhostLocker configurations versions not found';

      // get access tokens
      const stgToken = await getAccessToken(Env.STG);
      const prodToken = await getAccessToken(Env.PROD);

      // get apple storefront config value
      const prodAppleConfig = await getConfigOfVersion(
        GLSet.RET_APPLE_V3,
        'current',
        prodToken,
        Env.PROD,
      );

      // get google storefront config value
      const prodGoogleConfig = await getConfigOfVersion(
        GLSet.RET_GOOGLE_V3,
        'current',
        prodToken,
        Env.PROD,
      );

      // get recurly storefront config value
      const prodRecurlyConfig = await getConfigOfVersion(
        GLSet.RET_RECURLY_V3,
        'current',
        prodToken,
        Env.PROD,
      );

      // update STG default configs with PROD data
      let data: any = {};
      if (!!prodAppleConfig.configurationValue) {
        const foundCountry = JSON.parse(
          prodAppleConfig.configurationValue,
        ).countries.find((country: any) => country.country === regionCode);
        data.applePayload = await updateDefaultRetentionConfig(
          GLSet.RET_APPLE_V3,
          regionCode,
          Env.STG,
          stgToken,
          foundCountry,
        );
      }
      if (!!prodGoogleConfig.configurationValue) {
        const foundCountry = JSON.parse(
          prodGoogleConfig.configurationValue,
        ).countries.find((country: any) => country.country === regionCode);
        data.googlePayload = await updateDefaultRetentionConfig(
          GLSet.RET_GOOGLE_V3,
          regionCode,
          Env.STG,
          stgToken,
          foundCountry,
        );
      }
      if (!!prodRecurlyConfig.configurationValue) {
        const foundCountry = JSON.parse(
          prodRecurlyConfig.configurationValue,
        ).countries.find((country: any) => country.country === regionCode);
        data.recurlyPayload = await updateDefaultRetentionConfig(
          GLSet.RET_RECURLY_V3,
          regionCode,
          Env.STG,
          stgToken,
          foundCountry,
        );
      }
      if (
        !!data.applePayload ||
        !!data.googlePayload ||
        !!data.recurlyPayload
      ) {
        message = 'Configurations synchronized successfully';
      }
      retWithSuccess(req, res, {
        message,
        data,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);
