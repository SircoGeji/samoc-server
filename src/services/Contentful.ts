import { createClient } from 'contentful-management';
import pRetry from 'p-retry';
import Logger from '../util/logger';
import {
  ContentfulEntryState,
  DiscountType,
  DurationType,
  Env,
  getOfferTypeLabel,
} from '../types/enum';
import {
  ExtensionOfferContentfulPayload,
  LocalizedPayload,
  OfferContentfulPayload,
  OfferResponsePayload,
  PlanRecurlyPayload,
  RetentionOfferContentfulPayload,
} from '../types/payload';
import { OfferModel } from '../models/Offer';
import { PlanModel } from '../models/Plan';
import { AppError, ContentfulError } from '../util/errorHandler';
import { Store } from '../models';
import { pRetryOptions, sanitizeUnit } from '../util/utils';
import {
  Entry,
  EntryProps,
} from 'contentful-management/dist/typings/entities/entry';
import { Environment } from 'contentful-management/dist/typings/entities/environment';
import pluralize from 'pluralize';
import { RetentionOfferModel } from '../models/RetentionOffer';
import {
  allContentfulLocales,
  allLanguages,
} from '../controllers/offers/campaign/utils';
import { LanguageModel } from '../models/Language';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Contentful:`;
  } else {
    return `Contentful:`;
  }
};
const IMAGE_TITLE_PREFIX = 'backgroundImg-';
const IMAGE_TITLE_PREFIX_SMALL = 'bgImg-';
// TODO: retrieve locale from store
const DEFAULT_LOCALE = 'en-US';

const getEnvironment = async (storeCode: string): Promise<Environment> => {
  if (!storeCode) {
    throw new AppError(`Invalid store code: ${storeCode}`);
  }
  const contentfulCredential = await getContentfulCredential(storeCode);
  const client = createClient({
    accessToken: contentfulCredential.apiKey,
  });
  let space;
  try {
    space = await client.getSpace(contentfulCredential.spaceId);
  } catch (err) {
    if (JSON.parse(err.message).status === 404) {
      throw new ContentfulError(
        `Contentful: Space Id '${contentfulCredential.spaceId}' not found`,
        406,
      );
    } else {
      handleError(err);
    }
  }
  return await space.getEnvironment(contentfulCredential.envId);
};

const findEntryByCouponCode = async (
  regionCode: string,
  ctfEnv: Environment,
  offerCode: string,
): Promise<Entry> => {
  const entries: any = await ctfEnv.getEntries({
    content_type: 'specialOffer',
    'fields.couponCode': offerCode,
  });
  if (entries?.items?.length === 1) {
    return entries.items[0];
  } else if (entries?.items?.length > 1) {
    for (const entry of entries.items) {
      if (
        entry.sys.id === offerCode ||
        entry.sys.id === `${offerCode}-${regionCode}`
      ) {
        return entry;
      }
    }
    throw new ContentfulError(
      `Contentful: Offer '${offerCode}' not found in ${regionCode.toUpperCase()} region.`,
      404,
    );
  } else {
    throw new ContentfulError(
      `Contentful: Offer '${offerCode}' not found in ${regionCode.toUpperCase()} region.`,
      404,
    );
  }
};

const getAllSpecialOffersBatch = async (
  storeCode: string,
  codes: string[],
  ignoreImages: boolean,
): Promise<OfferContentfulPayload[]> => {
  logger.debug('Contentful: Special Offers being fetched');
  const fetchOffersOp = async () => {
    const [regionCode] = storeCode.split('-').slice(-1);
    const ctfEnv = await getEnvironment(storeCode);
    const entries = await ctfEnv.getEntries({
      content_type: 'specialOffer',
      'fields.couponCode[in]': codes.join(','),
    });
    let imagesByCode: Map<string, any> | null = null;
    if (!ignoreImages) {
      const images1 = await ctfEnv.getEntries({
        content_type: 'image',
        'sys.id[in]': codes
          .map((code) => `${IMAGE_TITLE_PREFIX}${code}`)
          .join(','),
      });
      const images2 = await ctfEnv.getEntries({
        content_type: 'image',
        'sys.id[in]': codes
          .map((code) => `${IMAGE_TITLE_PREFIX}${code}-${regionCode}`)
          .join(','),
      });
      const images3 = await ctfEnv.getEntries({
        content_type: 'image',
        'sys.id[in]': codes
          .map((code) => `${IMAGE_TITLE_PREFIX_SMALL}${code}-${regionCode}`)
          .join(','),
      });
      const images = Array.prototype.concat(
        images1.items,
        images2.items,
        images3.items,
      );
      imagesByCode = new Map(images.map((e) => [e.sys.id, e]));
    }

    return entries.items
      .filter((entry) =>
        entry.fields.country[DEFAULT_LOCALE].includes(regionCode),
      )
      .map((entry) => {
        const offerCode = entry.fields.couponCode[DEFAULT_LOCALE][0];
        const assetEntry =
          imagesByCode?.get(`${IMAGE_TITLE_PREFIX}${offerCode}`) ||
          imagesByCode?.get(
            `${IMAGE_TITLE_PREFIX}${offerCode}-${regionCode}`,
          ) ||
          imagesByCode?.get(
            `${IMAGE_TITLE_PREFIX_SMALL}${offerCode}-${regionCode}`,
          );
        return {
          storeCode,
          offerCode,
          offerTypeId: 0, // DB has this value
          planCode: '', // DB has this value
          offerHeader: entry.fields.offerTitle?.[DEFAULT_LOCALE],
          offerBodyText: entry.fields.offerDescription?.[DEFAULT_LOCALE],
          offerBoldedText: entry.fields.total?.[DEFAULT_LOCALE],
          discountType: '', // recurly has this value
          discountAmount: entry.fields.offerPrice?.[DEFAULT_LOCALE],
          offerAppliedBannerText: entry.fields.bannerText?.[DEFAULT_LOCALE],
          legalDisclaimer: entry.fields.offerTerms?.[DEFAULT_LOCALE],
          environments: entry.fields.environments?.[DEFAULT_LOCALE], // ["Dev", "Prod"]
          offerBgImageUrl: assetEntry?.fields.path?.[DEFAULT_LOCALE],
          claimOfferTerms: entry.fields.claimOfferTerms?.[DEFAULT_LOCALE],
          entryState: getEntryState(entry),
          updatedAt: new Date(entry.sys.updatedAt),
          contentfulUpdatedAt: new Date(entry.sys.updatedAt),
          contentfulImageUpdatedAt: assetEntry
            ? new Date(assetEntry.sys.updatedAt)
            : null,
        };
      });
  };
  try {
    return await pRetry(fetchOffersOp, pRetryOptions);
  } catch (err) {
    handleError(err);
  }
};

export const getAllSpecialOffers = async (
  storeCode: string,
  codes: string[],
  ignoreImages: boolean,
) => {
  const chunk = 50;
  let result: OfferContentfulPayload[] = [];
  for (let i = 0, j = codes.length; i < j; i += chunk) {
    const batch = codes.slice(i, i + chunk);
    result = result.concat(
      await getAllSpecialOffersBatch(storeCode, batch, ignoreImages),
    );
  }
  return result;
};

export const getImageEntry = async (
  ctfEnv: Environment,
  regionCode: string,
  offerCode: string,
  entry: any,
) => {
  const region = regionCode === 'us' ? 'en-US' : regionCode;
  let entries;
  if (entry.fields.backgroundImages[region]) {
    entries = await ctfEnv.getEntries({
      content_type: 'image',
      'sys.id': entry.fields.backgroundImages[region][0].sys.id,
    });
  } else {
    entries = await ctfEnv.getEntries({
      content_type: 'image',
      'sys.id[in]': `${IMAGE_TITLE_PREFIX_SMALL}${offerCode}-${region},${IMAGE_TITLE_PREFIX}${offerCode}-${region},${IMAGE_TITLE_PREFIX}${offerCode}`,
    });
  }

  if (entries?.items?.length !== 1) {
    throw new ContentfulError(
      `Contentful: ${entries?.items?.length} images for offers '${offerCode}' were found.`,
      409,
    );
  }
  return entries.items[0];
};

const defaultLocalized = (pl: OfferContentfulPayload): LocalizedPayload => {
  return {
    legalDisclaimer: pl.legalDisclaimer,
    offerAppliedBannerText: pl.offerAppliedBannerText,
    offerBgImageUrl: pl.offerBgImageUrl,
    offerBodyText: pl.offerBodyText,
    offerBoldedText: pl.offerBoldedText,
    offerHeader: pl.offerHeader,
    claimOfferTerms: pl.claimOfferTerms,
  };
};
/**
 * fetchSpecialOffer
 *  - fetches SpecialOffer entity from Contentful
 *
 * @param offerCode
 * @param storeCode
 */
export const fetchSpecialOffer = async (
  region: string,
  offerCode: string,
  storeCode: string,
  ignoreImage = false,
): Promise<OfferContentfulPayload> => {
  logger.debug('Contentful: Special Offer being fetched');
  const languages = await allLanguages();

  const locales = await allContentfulLocales();

  const fetchOfferOp = async (): Promise<OfferContentfulPayload> => {
    const ctfEnv = await getEnvironment(storeCode);
    const entry = await findEntryByCouponCode(region, ctfEnv, offerCode);
    const assetEntry = ignoreImage
      ? null
      : await getImageEntry(ctfEnv, region, offerCode, entry);
    const data: any = {
      storeCode,
      offerCode: entry.fields.couponCode[DEFAULT_LOCALE][0],
      offerTypeId: 0, // DB has this value
      planCode: '', // DB has this value
      discountType: '', // recurly has this value
      discountAmount: entry.fields.offerPrice?.[DEFAULT_LOCALE],
      environments: entry.fields.environments[DEFAULT_LOCALE], // ["Dev", "Prod"]
      entryState: getEntryState(entry),

      offerAppliedBannerText: entry.fields.bannerText?.[DEFAULT_LOCALE],
      legalDisclaimer: entry.fields.offerTerms?.[DEFAULT_LOCALE],
      offerHeader: entry.fields.offerTitle?.[DEFAULT_LOCALE],
      offerBodyText: entry.fields.offerDescription?.[DEFAULT_LOCALE],
      offerBoldedText: entry.fields.total?.[DEFAULT_LOCALE],
      offerBgImageUrl: assetEntry?.fields.path[DEFAULT_LOCALE],
      claimOfferTerms: entry.fields.claimOfferTerms?.[DEFAULT_LOCALE],

      updatedAt: new Date(entry.sys.updatedAt),
      contentfulUpdatedAt: new Date(entry.sys.updatedAt),
      contentfulImageUpdatedAt: assetEntry
        ? new Date(assetEntry.sys.updatedAt)
        : null,
    };

    const localizeds: { [key: string]: LocalizedPayload } = {};

    for (const loc in entry.fields.bannerText) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.offerAppliedBannerText = entry.fields.bannerText[loc];
      }
    }
    for (const loc in entry.fields.offerTerms) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.legalDisclaimer = entry.fields.offerTerms[loc];
      }
    }
    for (const loc in entry.fields.offerTitle) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.offerHeader = entry.fields.offerTitle[loc];
      }
    }
    for (const loc in entry.fields.offerDescription) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.offerBodyText = entry.fields.offerDescription[loc];
      }
    }
    for (const loc in entry.fields.claimOfferTerms) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.claimOfferTerms = entry.fields.claimOfferTerms[loc];
      }
    }
    for (const loc in entry.fields.total) {
      if (locales[loc]) {
        let localized = localizeds[locales[loc]];
        if (!localized) {
          localized = defaultLocalized(data);
          localizeds[locales[loc]] = localized;
        }
        localized.offerBoldedText = entry.fields.total[loc];
      }
    }
    if (assetEntry) {
      for (const loc in assetEntry.fields.path) {
        if (locales[loc]) {
          let localized = localizeds[locales[loc]];
          if (!localized) {
            localized = defaultLocalized(data);
            localizeds[locales[loc]] = localized;
          }
          localized.offerBgImageUrl = assetEntry.fields.path[loc];
        }
      }
    }
    data.localized = localizeds;

    return data;
  };
  try {
    return await pRetry(fetchOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err);
  }
};

export const getEntryState = (entry: Entry): ContentfulEntryState => {
  if (entry.isArchived()) {
    return ContentfulEntryState.ARCHIVED;
  } else if (entry.isDraft()) {
    return ContentfulEntryState.DRAFT;
  } else if (entry.isPublished()) {
    return ContentfulEntryState.PUBLISHED;
  }
};

export const couponExists = async (
  regionCode: string,
  offerCode: string,
  storeCode: string,
): Promise<boolean> => {
  logger.debug(`Contentful: Checking to see if coupon '${offerCode}' exists`);
  const fetchOfferOp = async () => {
    const ctfEnv = await getEnvironment(storeCode);
    const entries = await ctfEnv.getEntries({
      content_type: 'specialOffer',
      'fields.couponCode': offerCode,
    });
    for (const item of entries.items) {
      if (item.fields.country[DEFAULT_LOCALE].includes(regionCode)) {
        return true;
      }
    }
    return false;
  };
  try {
    return await pRetry(fetchOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err);
  }
};

export const createSpecialOffer = async (
  payload: OfferResponsePayload,
  plan: PlanModel,
  recurlyPlan: PlanRecurlyPayload,
  env: Env,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} Special Offer being created`);
  checkValidPlan(plan);
  // check to see if coupon code (id or field) already exists
  if (
    await couponExists(
      plan.Store.regionCode,
      payload.offerCode,
      plan.Store.storeCode,
    )
  ) {
    throw new ContentfulError(
      `Contentful: Special Offer '${payload.offerCode}' already exists`,
      409,
    );
  }
  const createOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(plan.storeCode);
    const regionCode = plan.Store.regionCode;
    let links: LinkEntry[];
    const languages = await allLanguages();
    if (payload.offerBgImageUrl) {
      logger.debug('Contentful: Image being created');
      links = await publishNewImage(
        ctfEnv,
        payload,
        regionCode,
        offerEnv,
        languages,
      );
    }
    await publishNewOffer(
      ctfEnv,
      payload,
      plan,
      recurlyPlan,
      links,
      offerEnv,
      languages,
    );
  };
  try {
    await pRetry(createOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const createRetentionSpecialOffer = async (
  payload: RetentionOfferContentfulPayload,
  recurlyPlan: PlanRecurlyPayload,
  regionCode: string,
  env: Env,
  upgradeOffer: boolean,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} Special Offer being created`);
  // TODO: Validate plans
  // checkValidPlan(plan);

  // check to see if coupon code (id or field) already exists
  if (await couponExists(regionCode, payload.offerCode, payload.storeCode)) {
    throw new ContentfulError(
      `Contentful: Special Offer '${payload.offerCode}' already exists`,
      409,
    );
  }
  const createOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(payload.storeCode);
    const languages = await allLanguages();
    await publishNewRetentionOffer(
      ctfEnv,
      payload,
      recurlyPlan,
      regionCode,
      offerEnv,
      upgradeOffer,
      languages,
    );
  };
  try {
    await pRetry(createOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const createExtensionSpecialOffer = async (
  payload: ExtensionOfferContentfulPayload,
  recurlyPlan: PlanRecurlyPayload,
  regionCode: string,
  env: Env,
  upgradeOffer: boolean,
): Promise<void> => {
  logger.debug(`${logPrefix(env)} Special Offer being created`);
  // TODO: Validate plans
  // checkValidPlan(plan);

  // check to see if coupon code (id or field) already exists
  if (await couponExists(regionCode, payload.offerCode, payload.storeCode)) {
    throw new ContentfulError(
      `Contentful: Special Offer '${payload.offerCode}' already exists`,
      409,
    );
  }
  const createOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(payload.storeCode);
    const languages = await allLanguages();
    await publishNewExtensionOffer(
      ctfEnv,
      payload,
      recurlyPlan,
      regionCode,
      offerEnv,
      upgradeOffer,
      languages,
    );
  };
  try {
    await pRetry(createOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, env);
  }
};

export const updateSpecialOffer = async (
  payload: OfferContentfulPayload,
  offerCode: string,
  plan: PlanModel,
  env: Env,
  recurlyPlan: PlanRecurlyPayload,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Special Offer ${offerCode} is being updated.`,
  );
  checkValidPlan(plan);
  const languages = await allLanguages();
  const updateOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(plan.storeCode);
    let entry = await findEntryByCouponCode(
      plan.Store.regionCode,
      ctfEnv,
      offerCode,
    );
    if (payload.offerBgImageUrl) {
      let assetEntry = await getImageEntry(
        ctfEnv,
        plan.Store.regionCode,
        offerCode,
        entry,
      );
      if (payload.localized && Object.keys(payload).length > 0) {
        for (const lang in payload.localized) {
          const l = payload.localized[lang];
          const locale = languages[plan.Store.regionCode][lang].contentfulCode;
          assetEntry.fields.path[locale] = l.offerBgImageUrl;
          assetEntry.fields.environments[locale] = offerEnv;
        }
      } else {
        //FLEX: Map fields here
        assetEntry.fields.path[DEFAULT_LOCALE] = payload.offerBgImageUrl;
        assetEntry.fields.environments[DEFAULT_LOCALE] = offerEnv;
      }
      assetEntry = await assetEntry.update();
      await assetEntry.publish();
    }
    if (payload.localized && Object.keys(payload).length > 0) {
      for (const lang in payload.localized) {
        const l = payload.localized[lang];
        const locale = languages[plan.Store.regionCode][lang].contentfulCode;
        entry.fields.offerTitle[locale] = l.offerHeader;
        entry.fields.offerDescription[locale] = l.offerBodyText;
        if (entry.fields.claimOfferTerms && l.claimOfferTerms) {
          entry.fields.claimOfferTerms[locale] = l.claimOfferTerms;
        }
        entry.fields.bannerText[locale] = l.offerAppliedBannerText;
        entry.fields.offerTerms[locale] = l.legalDisclaimer;
        entry.fields.environments[locale] = offerEnv;
        entry.fields.total[locale] = l.offerBoldedText
          ? l.offerBoldedText
          : getFormattedTotal(payload, recurlyPlan);
      }
    } else {
      //FLEX: Map fields here - values not editable should not be included
      entry.fields.offerTitle[DEFAULT_LOCALE] = payload.offerHeader;
      entry.fields.offerDescription[DEFAULT_LOCALE] = payload.offerBodyText;
      if (payload.claimOfferTerms) {
        entry.fields.claimOfferTerms[DEFAULT_LOCALE] = payload.claimOfferTerms;
      }
      entry.fields.bannerText[DEFAULT_LOCALE] = payload.offerAppliedBannerText;
      entry.fields.offerTerms[DEFAULT_LOCALE] = payload.legalDisclaimer;
      entry.fields.environments[DEFAULT_LOCALE] = offerEnv;
      entry.fields.total[DEFAULT_LOCALE] = payload.offerBoldedText
        ? payload.offerBoldedText
        : getFormattedTotal(payload, recurlyPlan);
    }
    entry = await entry.update();
    entry = await entry.publish();
    logger.debug(
      `Contentful: Special Offer ${entry.sys.id} updated and republished`,
    );
  };
  try {
    await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    if (err.toString().includes('BadRequest')) {
      const msg = JSON.parse(err.message).message;
      throw new ContentfulError(`Contentful: Update offer failed: ${msg}`, 400);
    } else {
      handleError(err, env);
    }
  }
};

export const updateRetentionSpecialOffer = async (
  payload: RetentionOfferContentfulPayload,
  storeCode: string,
  offerCode: string,
  env: Env,
  regionCode: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Special Offer ${offerCode} is being updated.`,
  );
  // TODO add validation
  // checkValidPlan(plan);
  const updateOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(storeCode);
    const languages = await allLanguages();
    let entry = await findEntryByCouponCode(regionCode, ctfEnv, offerCode);
    //FLEX: Map fields here - values not editable should not be included
    if (payload.localized && Object.keys(payload).length > 0) {
      for (const lang in payload.localized) {
        const l = payload.localized[lang];
        const locale = languages[regionCode][lang].contentfulCode;
        entry.fields.offerTitle[locale] = l.offerHeader;
        entry.fields.offerDescription[locale] = l.offerBodyText;
        entry.fields.claimOfferTerms[locale] = l.claimOfferTerms;
        entry.fields.bannerText[locale] = l.offerAppliedBannerText;
        entry.fields.offerTerms[locale] = l.legalDisclaimer;
        entry.fields.environments[locale] = offerEnv;
        entry.fields.total[locale] = l.offerBoldedText ?? '';
      }
    } else {
      //FLEX: Map fields here - values not editable should not be included
      entry.fields.offerTitle[DEFAULT_LOCALE] = payload.offerHeader;
      entry.fields.offerDescription[DEFAULT_LOCALE] = payload.offerBodyText;
      entry.fields.claimOfferTerms[DEFAULT_LOCALE] = payload.claimOfferTerms;
      entry.fields.bannerText[DEFAULT_LOCALE] = payload.offerAppliedBannerText;
      entry.fields.offerTerms[DEFAULT_LOCALE] = payload.legalDisclaimer;
      entry.fields.environments[DEFAULT_LOCALE] = offerEnv;
      entry.fields.total[DEFAULT_LOCALE] = payload.offerBoldedText ?? '';
    }
    entry = await entry.update();
    entry = await entry.publish();
    logger.debug(
      `Contentful: Special Offer ${entry.sys.id} updated and republished`,
    );
  };
  try {
    await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    if (err.toString().includes('BadRequest')) {
      const msg = JSON.parse(err.message).message;
      throw new ContentfulError(`Contentful: Update offer failed: ${msg}`, 400);
    } else {
      handleError(err, env);
    }
  }
};

export const updateExtensionSpecialOffer = async (
  payload: ExtensionOfferContentfulPayload,
  storeCode: string,
  offerCode: string,
  env: Env,
  regionCode: string,
): Promise<void> => {
  logger.debug(
    `${logPrefix(env)} Special Offer ${offerCode} is being updated.`,
  );
  // TODO add validation
  // checkValidPlan(plan);
  const updateOfferOp = async () => {
    const offerEnv = getOfferEnv(env);
    const ctfEnv = await getEnvironment(storeCode);
    const languages = await allLanguages();
    let entry = await findEntryByCouponCode(regionCode, ctfEnv, offerCode);
    //FLEX: Map fields here - values not editable should not be included
    if (payload.localized && Object.keys(payload).length > 0) {
      for (const lang in payload.localized) {
        const l = payload.localized[lang];
        const locale = languages[regionCode][lang].contentfulCode;
        entry.fields.offerTitle[locale] = l.offerTitle;
        entry.fields.offerDescription[locale] = l.offerDescription;
        entry.fields.offerTerms[locale] = l.offerTerms;
        entry.fields.bannerText[locale] = l.bannerText;
        entry.fields.environments[locale] = offerEnv;
        // entry.fields.total[locale] = '';
      }
    } else {
      //FLEX: Map fields here - values not editable should not be included
      entry.fields.offerTitle[DEFAULT_LOCALE] = payload.offerTitle;
      entry.fields.offerDescription[DEFAULT_LOCALE] = payload.offerDescription;
      entry.fields.offerTerms[DEFAULT_LOCALE] = payload.offerTerms;
      entry.fields.bannerText[DEFAULT_LOCALE] = payload.bannerText;
      entry.fields.environments[DEFAULT_LOCALE] = offerEnv;
      // entry.fields.total[DEFAULT_LOCALE] = '';
    }
    entry = await entry.update();
    entry = await entry.publish();
    logger.debug(
      `Contentful: Special Offer ${entry.sys.id} updated and republished`,
    );
  };
  try {
    await pRetry(updateOfferOp, pRetryOptions);
  } catch (err) {
    if (err.toString().includes('BadRequest')) {
      const msg = JSON.parse(err.message).message;
      throw new ContentfulError(`Contentful: Update offer failed: ${msg}`, 400);
    } else {
      handleError(err, env);
    }
  }
};

export const setEnvForSpecialOffer = async (
  region: string,
  offerCode: string,
  storeCode: string,
  toEnv: Env,
  updateImage = true,
): Promise<void> => {
  const publishOfferOp = async () => {
    logger.debug(`Contentful: Special Offer ${offerCode} is being published`);
    const offerEnv = getOfferEnv(toEnv);
    const ctfEnv = await getEnvironment(storeCode);
    const entry = await findEntryByCouponCode(region, ctfEnv, offerCode);
    if (updateImage) {
      let imageEntry = await getImageEntry(ctfEnv, region, offerCode, entry);
      imageEntry.fields.environments[DEFAULT_LOCALE] = offerEnv;
      imageEntry = await imageEntry.update();
      await imageEntry.publish();
    }
    let offerEntry = await findEntryByCouponCode(region, ctfEnv, offerCode);
    offerEntry.fields.environments[DEFAULT_LOCALE] = offerEnv;
    offerEntry = await offerEntry.update();
    await offerEntry.publish();
  };
  try {
    await pRetry(publishOfferOp, pRetryOptions);
  } catch (err) {
    handleError(err, toEnv);
  }
};

export const archiveSpecialOffer = async (offer: OfferModel): Promise<void> => {
  checkValidPlan(offer.Plan);
  const deleteOfferOp = async () => {
    logger.debug(
      `Contentful: Special Offer ${offer.offerCode}'s status is being changed.`,
    );
    const ctfEnv = await getEnvironment(offer.Plan.storeCode);
    const entry = await findEntryByCouponCode(
      offer.Plan.Store.regionCode,
      ctfEnv,
      offer.offerCode,
    );
    const imageEntry = await getImageEntry(
      ctfEnv,
      offer.Plan.Store.regionCode,
      offer.offerCode,
      entry,
    );
    await unPublish(ctfEnv, imageEntry);
    await unPublish(ctfEnv, entry);
  };
  try {
    await pRetry(deleteOfferOp, pRetryOptions);
  } catch (err) {
    // we don't care about 404 error because we are deleting anyway
    // throw known non-404 error to caller
    if (err instanceof ContentfulError) {
      if (err.statusCode != 404) {
        throw err;
      }
    } else {
      // for unknown error, try to parse and throw non-404 error to caller
      const contentfulError = JSON.parse(err.message);
      if (contentfulError.status != 404) {
        handleError(err);
      }
    }
  }
};

export const archiveRetentionSpecialOffer = async (
  offer: RetentionOfferModel,
): Promise<void> => {
  const deleteOfferOp = async () => {
    logger.debug(
      `Contentful: Special Offer ${offer.offerCode}'s status is being changed.`,
    );
    const ctfEnv = await getEnvironment(offer.storeCode);
    const entry = await findEntryByCouponCode(
      offer.Store.regionCode,
      ctfEnv,
      offer.offerCode,
    );
    await unPublish(ctfEnv, entry);
  };
  try {
    await pRetry(deleteOfferOp, pRetryOptions);
  } catch (err) {
    // we don't care about 404 error because we are deleting anyway
    // throw known non-404 error to caller
    if (err instanceof ContentfulError) {
      if (err.statusCode != 404) {
        throw err;
      }
    } else {
      // for unknown error, try to parse and throw non-404 error to caller
      const contentfulError = JSON.parse(err.message);
      if (contentfulError.status != 404) {
        handleError(err);
      }
    }
  }
};

export const restoreSpecialOffer = async (offer: OfferModel): Promise<void> => {
  checkValidPlan(offer.Plan);
  const restoreOp = async () => {
    logger.debug(
      `Contentful: Special Offer ${offer.offerCode}'s status is being restored.`,
    );
    const ctfEnv = await getEnvironment(offer.Plan.storeCode);
    let entry = await findEntryByCouponCode(
      offer.Plan.Store.regionCode,
      ctfEnv,
      offer.offerCode,
    );
    let imageEntry = await getImageEntry(
      ctfEnv,
      offer.Plan.Store.regionCode,
      offer.offerCode,
      entry,
    );
    if (imageEntry.isArchived()) {
      imageEntry = await imageEntry.unarchive();
      await imageEntry.publish();
    }
    if (entry.isArchived()) {
      entry = await entry.unarchive();
      await entry.publish();
    }
  };
  try {
    await pRetry(restoreOp, pRetryOptions);
  } catch (err) {
    handleError(err);
  }
};

export const restoreRetentionSpecialOffer = async (
  offer: RetentionOfferModel,
): Promise<void> => {
  // TODO Validate Plans
  // checkValidPlan(offer.Plan);
  const restoreOp = async () => {
    logger.debug(
      `Contentful: Special Offer ${offer.offerCode}'s status is being restored.`,
    );
    const ctfEnv = await getEnvironment(offer.storeCode);
    let entry = await findEntryByCouponCode(
      offer.Store.regionCode,
      ctfEnv,
      offer.offerCode,
    );
    if (entry.isArchived()) {
      entry = await entry.unarchive();
      await entry.publish();
    }
  };
  try {
    await pRetry(restoreOp, pRetryOptions);
  } catch (err) {
    handleError(err);
  }
};

const handleError = (err: any, env?: Env) => {
  logger.error(
    `${env ? logPrefix(env) : logPrefix()} Operation failed, ${err.message}`,
    err,
  );
  if (err.name === 'AccessTokenInvalid') {
    throw new ContentfulError(
      `Contentful: operation failed, Invalid access token.`,
      401,
    );
  } else {
    let msg: string;
    if (err.message.startsWith('Contentful')) {
      msg = err.message;
    } else if (err.name === 'NotFound') {
      msg = JSON.parse(err.message).message;
    } else {
      msg = `Contentful: operation failed, ${err.message}`;
    }
    throw new ContentfulError(
      msg,
      err.statusCode || JSON.parse(err.message).status || 500,
    );
  }
};

const unPublish = async (ctfEnv: Environment, entry: Entry) => {
  // delete offer content
  if (entry) {
    logger.debug(
      'Contentful: Special Offer entry found, proceed with un-publish',
    );
    if (entry.isPublished()) {
      entry = await entry.unpublish();
    }
    if (!entry.isArchived()) {
      await entry.archive();
      logger.debug(
        `Contentful: Special Offer (${entry.sys.id}) entry archived.`,
      );
    }
  } else {
    logger.debug(
      'Contentful: Special Offer entry not found, nothing to un-publish.',
    );
  }
};

const SPECIAL_OFFER_ENTITY_TYPE = 'specialOffer';

const publishNewOffer = async (
  ctfEnv: Environment,
  payload: OfferContentfulPayload,
  plan: PlanModel,
  recurlyPlan: PlanRecurlyPayload,
  links: LinkEntry[],
  offerEnv: string[],
  languages: { [key: string]: { [key: string]: LanguageModel } },
): Promise<void> => {
  // const plan = offer.Plan;
  const data: any = {
    //FLEX: Map fields here
    fields: {
      title: {
        [DEFAULT_LOCALE]: `[SAMOC] [${plan.Store.regionCode.toUpperCase()}] ${
          payload.offerCode
        } - ${getOfferTypeLabel(payload.offerTypeId)}`,
      },
      country: {
        [DEFAULT_LOCALE]: [plan.Store.regionCode],
      },
      couponCode: {
        [DEFAULT_LOCALE]: [payload.offerCode],
      },
      offerTitle: {
        [DEFAULT_LOCALE]: payload.offerHeader,
      },
      offerDescription: {
        [DEFAULT_LOCALE]: payload.offerBodyText,
      },
      bannerText: {
        [DEFAULT_LOCALE]: payload.offerAppliedBannerText,
      },
      offerPrice: {
        [DEFAULT_LOCALE]:
          payload.discountType === DiscountType.FIXED_PRICE
            ? payload.discountAmount
            : recurlyPlan.price, // TODO: get amount from regionCode
      },
      billingFrequency: {
        [DEFAULT_LOCALE]: sanitizeUnit(recurlyPlan.billingCycleUnit),
      },
      total: {
        [DEFAULT_LOCALE]: payload.offerBoldedText
          ? payload.offerBoldedText
          : getFormattedTotal(payload, recurlyPlan),
      },
      commitmentUnit: {
        [DEFAULT_LOCALE]: `${recurlyPlan.billingCycleDuration} ${recurlyPlan.billingCycleUnit}`,
      },
      offerTerms: {
        [DEFAULT_LOCALE]: payload.legalDisclaimer,
      },
      backgroundImages: {
        [DEFAULT_LOCALE]: links,
      },
      freeTrial: {
        [DEFAULT_LOCALE]: payload.discountType === DiscountType.FREE_TRIAL,
      },
      environments: {
        [DEFAULT_LOCALE]: offerEnv,
      },
    },
  };
  if (payload.localized && Object.keys(payload).length > 0) {
    for (const lang in payload.localized) {
      const l = payload.localized[lang];
      const locale = languages[plan.Store.regionCode][lang].contentfulCode;
      data.fields.offerTitle[locale] = l.offerHeader;
      data.fields.offerDescription[locale] = l.offerBodyText;
      // data.fields.claimOfferTerms[locale] = l.claimOfferTerms;
      data.fields.bannerText[locale] = l.offerAppliedBannerText;
      data.fields.total[locale] = l.offerBoldedText
        ? l.offerBoldedText
        : getFormattedTotal(payload, recurlyPlan);
      data.fields.offerTerms[locale] = l.legalDisclaimer;
    }
  }

  const entry = await publishContent(
    ctfEnv,
    SPECIAL_OFFER_ENTITY_TYPE,
    `${payload.offerCode}-${plan.Store.regionCode}`,
    data,
  );
  logger.debug(
    `Contentful: Special Offer ${entry.sys.id} created and published.`,
  );
};

const publishNewRetentionOffer = async (
  ctfEnv: Environment,
  payload: RetentionOfferContentfulPayload,
  recurlyPlan: PlanRecurlyPayload,
  regionCode: string,
  offerEnv: string[],
  upgradeOffer: boolean,
  languages: { [key: string]: { [key: string]: LanguageModel } },
): Promise<void> => {
  const couponCodes = upgradeOffer
    ? [payload.offerCode, `${payload.offerCode}_upgrade`]
    : [payload.offerCode];
  // const plan = offer.Plan;

  const data: any = {
    //FLEX: Map fields here
    fields: {
      title: {
        [DEFAULT_LOCALE]: `[SAMOC] [${regionCode.toUpperCase()}] ${
          payload.offerCode
        } - Retention`,
      },
      country: {
        [DEFAULT_LOCALE]: [regionCode],
      },
      couponCode: {
        [DEFAULT_LOCALE]: couponCodes,
      },
      offerTitle: {
        [DEFAULT_LOCALE]: payload.offerHeader,
      },
      offerDescription: {
        [DEFAULT_LOCALE]: payload.offerBodyText,
      },
      claimOfferTerms: {
        [DEFAULT_LOCALE]: payload.claimOfferTerms,
      },
      bannerText: {
        [DEFAULT_LOCALE]: payload.offerAppliedBannerText,
      },
      offerPrice: {
        [DEFAULT_LOCALE]:
          payload.discountType === DiscountType.FIXED_PRICE
            ? payload.discountAmount
            : recurlyPlan.price, // TODO: get amount from regionCode
      },
      billingFrequency: {
        [DEFAULT_LOCALE]: sanitizeUnit(recurlyPlan.billingCycleUnit),
      },
      total: {
        [DEFAULT_LOCALE]: payload.offerBoldedText ?? '',
      },
      commitmentUnit: {
        [DEFAULT_LOCALE]: `${recurlyPlan.billingCycleDuration} ${recurlyPlan.billingCycleUnit}`,
      },
      offerTerms: {
        [DEFAULT_LOCALE]: payload.legalDisclaimer,
      },
      freeTrial: {
        [DEFAULT_LOCALE]: payload.discountType === DiscountType.FREE_TRIAL,
      },
      environments: {
        [DEFAULT_LOCALE]: offerEnv,
      },
    },
  };
  if (payload.localized && Object.keys(payload).length > 0) {
    for (const lang in payload.localized) {
      const l = payload.localized[lang];
      const locale = languages[regionCode][lang].contentfulCode;
      data.fields.offerTitle[locale] = l.offerHeader;
      data.fields.offerDescription[locale] = l.offerBodyText;
      data.fields.claimOfferTerms[locale] = l.claimOfferTerms;
      data.fields.bannerText[locale] = l.offerAppliedBannerText;
      data.fields.total[locale] = l.offerBoldedText ?? '';
      data.fields.offerTerms[locale] = l.legalDisclaimer;
    }
  }
  const entry = await publishContent(
    ctfEnv,
    SPECIAL_OFFER_ENTITY_TYPE,
    `${payload.offerCode}-${regionCode}`,
    data,
  );
  logger.debug(
    `Contentful: Special Offer ${entry.sys.id} created and published.`,
  );
};

const publishNewExtensionOffer = async (
  ctfEnv: Environment,
  payload: ExtensionOfferContentfulPayload,
  recurlyPlan: PlanRecurlyPayload,
  regionCode: string,
  offerEnv: string[],
  upgradeOffer: boolean,
  languages: { [key: string]: { [key: string]: LanguageModel } },
): Promise<void> => {
  const couponCodes = upgradeOffer
    ? [payload.offerCode, `${payload.offerCode}_upgrade`]
    : [payload.offerCode];
  // const plan = offer.Plan;

  const data: any = {
    //FLEX: Map fields here
    fields: {
      title: {
        [DEFAULT_LOCALE]: `[SAMOC] [${regionCode.toUpperCase()}] ${
          payload.offerCode
        } - Extension`,
      },
      country: {
        [DEFAULT_LOCALE]: [regionCode],
      },
      couponCode: {
        [DEFAULT_LOCALE]: couponCodes,
      },
      offerTitle: {
        [DEFAULT_LOCALE]: payload.offerTitle,
      },
      offerDescription: {
        [DEFAULT_LOCALE]: payload.offerDescription,
      },
      offerTerms: {
        [DEFAULT_LOCALE]: payload.offerTerms,
      },
      bannerText: {
        [DEFAULT_LOCALE]: payload.bannerText,
      },
      offerPrice: {
        [DEFAULT_LOCALE]: payload.discountAmount, // TODO: get amount from regionCode
      },
      billingFrequency: {
        [DEFAULT_LOCALE]: sanitizeUnit(recurlyPlan.billingCycleUnit),
      },
      total: {
        [DEFAULT_LOCALE]: '',
      },
      commitmentUnit: {
        [DEFAULT_LOCALE]: `${recurlyPlan.billingCycleDuration} ${recurlyPlan.billingCycleUnit}`,
      },
      freeTrial: {
        [DEFAULT_LOCALE]: false,
      },
      environments: {
        [DEFAULT_LOCALE]: offerEnv,
      },
    },
  };
  const entry = await publishContent(
    ctfEnv,
    SPECIAL_OFFER_ENTITY_TYPE,
    `${payload.offerCode}-${regionCode}`,
    data,
  );
  logger.debug(
    `Contentful: Special Offer ${entry.sys.id} created and published.`,
  );
};

//Total should generate something like - <span>$5/month for 3 months, 7-day free trial</span>
export const getFormattedTotal = (
  payload: OfferContentfulPayload,
  plan: PlanRecurlyPayload,
): string => {
  // Fixed price offers
  if (payload.discountType === DiscountType.FIXED_PRICE) {
    if (!plan.trialDuration || !plan.trialUnit) {
      // No trial
      return `<span>ONLY $${payload.discountAmount}/${pluralize(
        payload.discountDurationUnit,
        1,
      ).toUpperCase()} FOR ${pluralize(
        payload.discountDurationUnit.toUpperCase(),
        payload.discountDurationValue,
        true,
      )}</span>`;
    }
    // Include free trial
    return `<span>$${payload.discountAmount}/${pluralize.singular(
      payload.discountDurationUnit,
    )} for ${payload.discountDurationValue} ${pluralize(
      payload.discountDurationUnit,
      payload.discountDurationValue,
    )}, ${plan.trialDuration}-${pluralize(
      plan.trialUnit,
      plan.trialDuration,
    )} free trial</span>`;
  } else if (payload.discountType === DiscountType.FREE_TRIAL) {
    // Free trial offers
    return `<span>$${plan.price}/${pluralize(
      plan.billingCycleUnit,
      plan.billingCycleDuration,
      plan.billingCycleDuration > 1,
    )}, ${payload.discountDurationValue}-${pluralize(
      payload.discountDurationUnit,
      payload.discountDurationValue,
    )} free trial</span>`;
  } else {
    // not supported
  }
};

export const getFormattedRetentionTotal = (
  payload: RetentionOfferContentfulPayload,
  plan: PlanRecurlyPayload,
): string => {
  // Fixed price offers
  if (payload.discountType === DiscountType.FIXED_PRICE) {
    if (payload.discountDurationType !== DurationType.SINGLE_USE) {
      return `<span>ONLY $${payload.discountAmount}/${pluralize(
        plan.billingCycleUnit.toUpperCase(),
        plan.billingCycleDuration,
        true,
      ).toUpperCase()} FOR ${pluralize(
        payload.discountDurationUnit.toUpperCase(),
        payload.discountDurationValue,
        true,
      )}</span>`;
    } else {
      return `<span>ONLY $${payload.discountAmount} FOR ${pluralize(
        plan.billingCycleUnit,
        plan.billingCycleDuration,
        true,
      )}</span>`;
    }
  } else if (payload.discountType === DiscountType.PERCENT) {
    if (payload.discountDurationType !== DurationType.SINGLE_USE) {
      return `<span>${payload.discountAmount}% OFF FOR ${pluralize(
        payload.discountDurationUnit.toUpperCase(),
        payload.discountDurationValue,
        true,
      )}</span>`;
    } else {
      return `<span>${payload.discountAmount}% OFF FOR ${pluralize(
        plan.billingCycleUnit,
        plan.billingCycleDuration,
        true,
      )}</span>`;
    }
  } else {
    // not supported
  }
};

const publishNewImage = async (
  ctfEnv: Environment,
  payload: OfferContentfulPayload,
  regionCode: string,
  imageEnv: string[],
  languages: { [key: string]: { [key: string]: LanguageModel } },
): Promise<LinkEntry[]> => {
  const title = `${IMAGE_TITLE_PREFIX_SMALL}${payload.offerCode}-${regionCode}`;
  const data = {
    //FLEX: Map fields here
    fields: {
      title: {
        [DEFAULT_LOCALE]: title,
      },
      country: {
        [DEFAULT_LOCALE]: [regionCode],
      },
      path: {
        [DEFAULT_LOCALE]: payload.offerBgImageUrl,
      },
      environments: {
        [DEFAULT_LOCALE]: imageEnv,
      },
    },
  };
  if (payload.localized && Object.keys(payload).length > 0) {
    for (const lang in payload.localized) {
      const l = payload.localized[lang];
      const locale = languages[regionCode][lang].contentfulCode;
      (data as any).fields.path[locale] = l.offerBgImageUrl;
    }
  }

  const entry = await publishContent(ctfEnv, 'image', title, data);
  logger.debug(`Contentful: Image ${entry.sys.id} created and published.`);
  return [
    {
      sys: {
        type: 'Link',
        linkType: 'Entry',
        id: entry.sys.id,
      },
    },
  ];
};

const publishContent = async (
  ctfEnv: Environment,
  contentTypeId: string,
  id: string,
  data: Pick<EntryProps, 'fields'>,
): Promise<Entry> => {
  const entry = await ctfEnv.createEntryWithId(contentTypeId, id, data);
  return await entry.publish();
};

const getContentfulCredential = async (
  storeCode: string,
): Promise<ContentfulCredential> => {
  const store = await Store.findByPk(storeCode);
  if (store) {
    return {
      spaceId: store.cfSpaceId,
      envId: store.cfEnvId,
      apiKey: store.cfApiKey,
    };
  } else {
    throw new AppError(
      `Contentful: Store not found with store code (${storeCode})`,
    );
  }
};

const checkValidPlan = (plan: PlanModel) => {
  // ensure we have plan info before continuing
  if (!plan) {
    throw new AppError('Contentful: Check failed: Plan not found.,', 404);
  }
  // ensure we have store info before continuing
  if (!plan.Store) {
    throw new AppError(
      `Contentful: Check failed, Plan (${plan.planCode}) doesn't have Store information.`,
      404,
    );
  }
};

const getOfferEnv = (env: Env) => {
  if (env === Env.PROD) {
    return ['Dev', 'Prod'];
  }
  return ['Dev'];
};

interface ContentfulCredential {
  spaceId: string;
  envId: string;
  apiKey: string;
}

interface LinkEntry {
  sys: {
    type: string;
    linkType: string;
    id: string;
  };
}
