import {
  LocalizedPayload,
  OfferResponsePayload,
  RetentionOfferResponsePayload,
} from '../../../types/payload';
import { CampaignLanguage, CampaignPayload, CampaignRegion } from './payloads';
import {
  Campaign,
  Currency,
  Language,
  Offer,
  Plan,
  Region,
  RetentionOffer,
  Store,
} from '../../../models';
import { StoreModel } from '../../../models/Store';
import { PlanModel } from '../../../models/Plan';
import {
  CodeType,
  DiscountType,
  DurationType,
  OfferTypes,
  PlatformEnum,
  StatusEnum,
} from '../../../types/enum';
import { CampaignModel } from '../../../models/Campaign';
import { LanguageModel } from '../../../models/Language';
import {
  generateOfferUrlFromData,
  checkOfferInWorkflowQueue,
  getTargetEnv,
} from '../../../util/utils';
import { Op } from 'sequelize';
import { getCsvFileNameIfExists } from '../index';
import { OfferModel } from '../../../models/Offer';
import { CurrencyInfoPayload } from '../../../types/payload';

export const allPlans = async (): Promise<{
  [key: string]: PlanModel;
}> => {
  return (await Plan.findAll()).reduce(
    (map: { [key: string]: PlanModel }, val) => {
      map[val.planCode] = val;
      return map;
    },
    {},
  );
};

export const allStores = async (): Promise<{
  [key: string]: StoreModel;
}> => {
  return (
    await Store.findAll({
      include: [{ model: Region, include: [{ model: Currency }] }],
      where: {
        [Op.or]: [
          { platformCode: PlatformEnum.WEB, rlySubdomainStg: { [Op.ne]: null } },
          { platformCode: PlatformEnum.ANDROID }
        ]
      }
    })
  ).reduce((map: { [key: string]: StoreModel }, val) => {
    map[val.storeCode] = val;
    return map;
  }, {});
};

export const allWebStores = async (): Promise<{
  [key: string]: StoreModel;
}> => {
  return (
    await Store.findAll({
      include: [{ model: Region, include: [{ model: Currency }] }],
      where: {
        [Op.or]: [
          { platformCode: PlatformEnum.WEB, rlySubdomainStg: { [Op.ne]: null } }
        ]
      }
    })
  ).reduce((map: { [key: string]: StoreModel }, val) => {
    map[val.storeCode] = val;
    return map;
  }, {});
};

export const allLanguages = async (): Promise<{
  [key: string]: { [key: string]: LanguageModel };
}> => {
  return (await Language.findAll()).reduce(
    (map: { [key: string]: { [key: string]: LanguageModel } }, val) => {
      if (map[val.regionCode]) {
        map[val.regionCode][val.languageCode] = val;
      } else {
        map[val.regionCode] = { [val.languageCode]: val };
      }
      return map;
    },
    {},
  );
};

export const allContentfulLocales = async (): Promise<{
  [key: string]: string;
}> => {
  return (await Language.findAll()).reduce(
    (map: { [key: string]: string }, val) => {
      map[val.contentfulCode] = val.languageCode;
      return map;
    },
    {},
  );
};

const stateToStatus = (status: StatusEnum) => {
  switch (status) {
    case StatusEnum.DFT:
    case StatusEnum.STG:
    case StatusEnum.STG_VALDN_PEND:
    case StatusEnum.STG_VALDN_PASS:
    case StatusEnum.PROD_PEND:
    case StatusEnum.PROD:
    case StatusEnum.PROD_VALDN_PEND:
    case StatusEnum.PROD_VALDN_PASS:
      return 'valid';
    case StatusEnum.STG_RETD:
    case StatusEnum.PROD_RETD:
      return 'retired';
    default:
      return 'failed';
  }
};

const isValidStatus = (status: StatusEnum): boolean => {
  switch (status) {
    case StatusEnum.DFT:
    case StatusEnum.STG:
    case StatusEnum.STG_VALDN_PEND:
    case StatusEnum.STG_VALDN_PASS:
    case StatusEnum.PROD_PEND:
    case StatusEnum.PROD:
    case StatusEnum.PROD_VALDN_PEND:
    case StatusEnum.PROD_VALDN_PASS:
      return true;
  }
  return false;
};

const campaignStatus = (offers: { statusId: StatusEnum }[]): StatusEnum => {
  let validStatus = 0;
  let maxStatus = 0;
  for (const offer of offers) {
    if (isValidStatus(offer.statusId)) {
      if (validStatus === 0 || validStatus > offer.statusId) {
        validStatus = offer.statusId;
      }
    }
    if (maxStatus < offer.statusId) {
      maxStatus = offer.statusId;
    }
  }
  return validStatus > 0 ? validStatus : maxStatus;
};

export const convertToCampaign = async (
  campaignModel: CampaignModel,
  payload: OfferResponsePayload[],
  offerModels: OfferModel[],
): Promise<CampaignPayload> => {
  const stores = await allStores();

  const regions: CampaignRegion[] = [];
  const languages: CampaignLanguage[] = [];

  for (const offer of payload) {
    const store = stores[offer.storeCode];
    const env = getTargetEnv(offerModels[payload.indexOf(offer)]);
    regions.push({
      code: store.regionCode.toUpperCase(),
      price: offer.discountAmount,
      totalUniqueCodes: offer.totalUniqueCodes,
      origTotalUniqueCodes: offer.origTotalUniqueCodes,
      durationType: offer.discountDurationType,
      durationValue: offer.discountDurationValue,
      durationUnit: offer.discountDurationUnit,
      planCode: offer.planCode,
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      offerCodeStatus: stateToStatus(offer.statusId),
      statusId: offer.statusId,
      couponState: offer.couponState,
      couponCreatedAt: offer.couponCreatedAt,
      couponExpiredAt: offer.couponExpiredAt,
      couponUpdatedAt: offer.couponUpdatedAt,
      environments: offer.environments,
      entryState: offer.entryState,
      offerUrl: offer.offerUrl,
      isInWorkflow: await checkOfferInWorkflowQueue(offer.offerCode),
      csvFileName: getCsvFileNameIfExists(
        store.storeCode,
        offer.offerCode,
        offer.offerCodeType,
        env,
      ),
    });
    if (offer.localized) {
      for (const key in offer.localized) {
        const loc = offer.localized[key];
        languages.push({
          code: `${store.regionCode.toUpperCase()}-${key}`,
          marketingHeadline: loc.offerHeader,
          offerAppliedBanner: loc.offerAppliedBannerText,
          offerBgImageUrl: loc.offerBgImageUrl,
          offerHeadline: loc.offerBodyText,
          offerTerms: loc.legalDisclaimer,
          subhead: loc.offerBoldedText,
          contentfulImageUpdatedAt: offer.contentfulImageUpdatedAt,
          contentfulUpdatedAt: offer.contentfulUpdatedAt,
          offerUrl: generateOfferUrlFromData(
            store.regionCode,
            key,
            offer.statusId,
            offer.offerCode,
            offer.offerCodeType,
          ),
          welcomeEmailText: offer.welcomeEmailText,
          claimOfferTerms: loc.claimOfferTerms,
        });
      }
    } else {
      languages.push({
        code: `${store.regionCode.toUpperCase()}-en`,
        marketingHeadline: offer.offerHeader,
        offerAppliedBanner: offer.offerAppliedBannerText,
        offerBgImageUrl: offer.offerBgImageUrl,
        offerHeadline: offer.offerBodyText,
        offerTerms: offer.legalDisclaimer,
        subhead: offer.offerBoldedText,
        contentfulImageUpdatedAt: offer.contentfulImageUpdatedAt,
        contentfulUpdatedAt: offer.contentfulUpdatedAt,
        welcomeEmailText: offer.welcomeEmailText,
        claimOfferTerms: offer.claimOfferTerms,
      });
    }
  }

  let result: CampaignPayload;
  let defaultOffer: OfferResponsePayload = null;
  for (const offer of payload) {
    if (!defaultOffer || defaultOffer.statusId < offer.statusId) {
      defaultOffer = offer;
    }
  }
  if (campaignModel) {
    result = JSON.parse(JSON.stringify(campaignModel.data)) as CampaignPayload;
  } else {
    const offer = defaultOffer;
    result = {
      ...offer,
      marketingHeadline: offer.offerHeader,
      offerAppliedBanner: offer.offerAppliedBannerText,
      offerBgImageUrl: offer.offerBgImageUrl,
      offerHeadline: offer.offerBodyText,
      offerTerms: offer.legalDisclaimer,
      subhead: offer.offerBoldedText,
      welcomeEmailText: offer.welcomeEmailText,
      claimOfferTerms: offer.claimOfferTerms,
    };
    if (!result.campaignName) {
      result.campaignName = offer.offerName;
    }
  }
  result.regions = regions;
  result.languages = languages;
  result.statusId = campaignStatus(payload);
  if (result.endDateTime === 'Invalid date') {
    result.endDateTime = null;
  }
  result.offerTypeId = defaultOffer.offerTypeId;
  result.couponState = defaultOffer.couponState;
  result.entryState = defaultOffer.entryState;
  result.environments = defaultOffer.environments;
  result.couponExpiredAt = defaultOffer.couponExpiredAt;
  result.couponCreatedAt = defaultOffer.couponCreatedAt;
  result.couponUpdatedAt = defaultOffer.couponUpdatedAt;
  result.welcomeEmailText = result.welcomeEmailText
    ? result.welcomeEmailText
    : defaultOffer.welcomeEmailText;
  result.claimOfferTerms = result.claimOfferTerms
    ? result.claimOfferTerms
    : defaultOffer.claimOfferTerms;

  return result;
};

export const convertFromCampaign = async (
  payload: CampaignPayload,
  setBrackets?: boolean,
): Promise<OfferResponsePayload[]> => {
  const plans = await allPlans();
  const stores = await Store.findAll({
    include: [
      { model: Region, include: [{ model: Language }, { model: Currency }] },
    ],
    order: ['RegionCode', 'BrandCode', 'PlatformCode'],
  });
  let regionsAdditionalData: any = [];
  if (stores && stores.length > 0) {
    stores.forEach((value) => {
      const storeModel = value as StoreModel;
      const currency: CurrencyInfoPayload = {
        code: storeModel.Region.Currency.code,
        name: storeModel.Region.Currency.name,
        ratio: storeModel.Region.Currency.ratio,
        prefix: storeModel.Region.Currency.prefix,
      };
      const region: any = {
        code: storeModel.Region.title,
        currency: currency,
      };
      regionsAdditionalData.push(region);
    });
  }

  const result: OfferResponsePayload[] = [];
  for (const region of payload.regions) {
    const setBracketsValues: boolean = setBrackets ? setBrackets : region.statusId !== StatusEnum.DFT;
    const planModel = plans[region.planCode];
    const languagePrefix = `${region.code}-`;
    const localized: { [key: string]: LocalizedPayload } = {};
    let welcomeEmailText = '';
    for (const language of payload.languages) {
      if (language.code.startsWith(languagePrefix)) {
        const languageCode = language.code.substr(languagePrefix.length);
        const regionData: CampaignRegion = payload.regions.find((region) => {
          return region.code === language.code.substring(0, 2);
        });
        const regionsAddData = regionsAdditionalData.find((region: any) => {
          return region.code === regionData.code;
        });
        const currencyPrefix = regionsAddData.currency.prefix;
        localized[languageCode] = {
          legalDisclaimer: setBracketsValues && language.offerTerms?.length
            ? getFieldsValuesInBrackets(language.offerTerms, regionData, currencyPrefix, payload)
            : language.offerTerms,
          offerAppliedBannerText: setBracketsValues && language.offerAppliedBanner?.length
            ? getFieldsValuesInBrackets(language.offerAppliedBanner, regionData, currencyPrefix, payload)
            : language.offerAppliedBanner,
          offerBgImageUrl: language.offerBgImageUrl,
          offerBodyText: setBracketsValues && language.offerHeadline?.length
            ? getFieldsValuesInBrackets(language.offerHeadline, regionData, currencyPrefix, payload)
            : language.offerHeadline,
          offerBoldedText: setBracketsValues && language.subhead?.length
            ? getFieldsValuesInBrackets(language.subhead, regionData, currencyPrefix, payload)
            : language.subhead,
          offerHeader: setBracketsValues && language.marketingHeadline?.length
            ? getFieldsValuesInBrackets(language.marketingHeadline, regionData, currencyPrefix, payload)
            : language.marketingHeadline,
          welcomeEmailText: setBracketsValues && language.welcomeEmailText?.length
            ? getFieldsValuesInBrackets(language.welcomeEmailText, regionData, currencyPrefix, payload)
            : language.welcomeEmailText,
          claimOfferTerms: setBracketsValues && language.claimOfferTerms?.length
            ? getFieldsValuesInBrackets(language.claimOfferTerms, regionData, currencyPrefix, payload)
            : language.claimOfferTerms,
        };
        if (languageCode != 'en' || welcomeEmailText === '') {
          welcomeEmailText = setBracketsValues && language.welcomeEmailText?.length
            ? getFieldsValuesInBrackets(language.welcomeEmailText, regionData, currencyPrefix, payload)
            : language.welcomeEmailText;
        }
      }
    }
    if (!localized['en']) {
      localized['en'] = {
        legalDisclaimer: payload.offerTerms,
        offerAppliedBannerText: payload.offerAppliedBanner,
        offerBgImageUrl: payload.offerBgImageUrl,
        offerBodyText: payload.offerHeadline,
        offerBoldedText: payload.subhead,
        offerHeader: payload.marketingHeadline,
        welcomeEmailText: payload.welcomeEmailText,
        claimOfferTerms: payload.claimOfferTerms,
      };
    }
    const defaultLocalized: LocalizedPayload = localized['en'];
    if (payload.endDateTime === 'Invalid date') {
      payload.endDateTime = null;
    }
    const offer: OfferResponsePayload = {
      campaign: payload.campaign,
      campaignName: payload.campaignName,
      discountAmount: region.price,
      discountDurationType: DurationType.TEMPORAL,
      discountDurationUnit: region.durationUnit,
      discountDurationValue: region.durationValue,
      discountType: payload.discountType,
      eligiblePlanCodes: [region.planCode],
      endDateTime: payload.endDateTime,
      legalDisclaimer: defaultLocalized.legalDisclaimer,
      localized: localized,
      noEndDate: payload.noEndDate,
      offerAppliedBannerText: defaultLocalized.offerAppliedBannerText,
      offerBgImageUrl: defaultLocalized.offerBgImageUrl,
      claimOfferTerms: defaultLocalized.claimOfferTerms,
      offerBodyText: defaultLocalized.offerBodyText,
      offerBoldedText: defaultLocalized.offerBoldedText,
      offerCode: region.offerCode,
      offerCodeType: payload.offerCodeType,
      offerHeader: defaultLocalized.offerHeader,
      offerName: region.offerName,
      offerTypeId: payload.offerTypeId,
      planCode: region.planCode,
      storeCode: planModel.storeCode,
      welcomeEmailText,
      offerBusinessOwner: payload.offerBusinessOwner,
      statusId: region.statusId,
      environments: [],
      totalUniqueCodes: payload.totalUniqueCodes,
    };
    result.push(offer);
  }
  return result;
};

export const getFieldsValuesInBrackets = 
  (fieldValue: string, regionData: CampaignRegion, currencyPrefix: string, campaignData: CampaignPayload) => {
  const resultPrice: string = `${currencyPrefix} ${regionData.price}`;
  const durationValueNumber: number = regionData.durationValue
    ? regionData.durationValue
    : Number(regionData.durationType
      .substring(0, regionData.durationType.indexOf('-')));
  const durationUnitString: string = regionData.durationUnit?.length
    ? regionData.durationUnit
    : regionData.durationType
      .substring(regionData.durationType.indexOf('-') + 1, regionData.durationType.length - 1);
  const resultDuration: string = 
    regionData.durationType !== 'single_use'
    ? `${durationValueNumber} ${durationUnitString}${regionData.durationValue > 1 ? 's' : ''}`
    : 'single use';
  let result = fieldValue;
  if (campaignData.discountType === DiscountType.FIXED_PRICE) {
    result = result.replace(/{{price}}/g, resultPrice)
  }
  result = result.replace(/{{duration}}/g, resultDuration)
  return result;
};

export const uniqueCampaignId = async (offerCode: string): Promise<string> => {
  let idx = 0;
  for (;;) {
    const campaign = await Campaign.findByPk(offerCode);
    const offers = await Offer.findAll({ where: { campaign: offerCode } });
    const retentionOffers = await RetentionOffer.findAll({
      where: { campaign: offerCode },
    });
    if (!campaign && offers.length === 0 && retentionOffers.length === 0) {
      return offerCode;
    }
    idx++;
    offerCode = `${offerCode}_${idx}`;
  }
};

export const convertOrUpdateCampaignInDb = async (
  payload: CampaignPayload,
): Promise<CampaignModel> => {
  const data: CampaignPayload = { ...payload };
  // Don't store regions and languages in DB JSON
  delete data.regions;
  delete data.languages;
  const campaignModel: CampaignModel = await Campaign.findByPk(data.campaign);
  if (campaignModel) {
    campaignModel.name = data.campaignName;
    campaignModel.data = JSON.parse(JSON.stringify(data));
    return await campaignModel.save();
  } else {
    return await Campaign.create({
      id: data.campaign,
      name: data.campaignName,
      data: data,
    });
  }
};

//////

export const retentionConvertToCampaign = async (
  campaignModel: CampaignModel,
  payload: RetentionOfferResponsePayload[],
): Promise<CampaignPayload> => {
  const stores = await allStores();

  const regions: CampaignRegion[] = [];
  const languages: CampaignLanguage[] = [];
  for (const offer of payload) {
    const store = stores[offer.storeCode];
    regions.push({
      code: store.regionCode.toUpperCase(),
      totalUniqueCodes: offer.totalUniqueCodes,
      origTotalUniqueCodes: offer.origTotalUniqueCodes,
      price: offer.discountAmount,
      durationType: offer.discountDurationType,
      durationValue: offer.discountDurationValue,
      durationUnit: offer.discountDurationUnit,
      planCode: null,
      eligiblePlans: offer.eligiblePlans,
      eligiblePlanCodes: offer.eligiblePlans,
      offerCode: offer.offerCode,
      offerName: offer.offerName,
      offerCodeStatus: stateToStatus(offer.statusId),
      statusId: offer.statusId,
      couponState: offer.couponState,
      couponCreatedAt: offer.couponCreatedAt,
      couponExpiredAt: offer.couponExpiredAt,
      couponUpdatedAt: offer.couponUpdatedAt,
      environments: offer.environments,
      entryState: offer.entryState,
      createUpgradeOffer: !!offer.upgradePlan,
      upgradePlan: offer.upgradePlan,
      usersOnPlans:
        offer.usersOnPlans && offer.usersOnPlans.length > 0
          ? offer.usersOnPlans
          : ['-'],
      offerUrl: null,
    });
    if (offer.localized) {
      for (const key in offer.localized) {
        const loc = offer.localized[key];
        languages.push({
          code: `${store.regionCode.toUpperCase()}-${key}`,
          marketingHeadline: loc.offerHeader,
          offerAppliedBanner: loc.offerAppliedBannerText,
          offerBgImageUrl: loc.offerBgImageUrl,
          offerHeadline: loc.offerBodyText,
          offerTerms: loc.legalDisclaimer,
          subhead: loc.offerBoldedText,
          contentfulImageUpdatedAt: null,
          contentfulUpdatedAt: null,
          offerUrl: null,
          welcomeEmailText: offer.welcomeEmailText,
          claimOfferTerms: loc.claimOfferTerms,
        });
      }
    } else {
      languages.push({
        code: `${store.regionCode.toUpperCase()}-en`,
        marketingHeadline: offer.offerHeader,
        offerAppliedBanner: offer.offerAppliedBannerText,
        offerBgImageUrl: null,
        offerHeadline: offer.offerBodyText,
        offerTerms: offer.legalDisclaimer,
        subhead: offer.offerBoldedText,
        contentfulImageUpdatedAt: null,
        contentfulUpdatedAt: null,
        welcomeEmailText: offer.welcomeEmailText,
        claimOfferTerms: offer.claimOfferTerms,
      });
    }
  }

  let result: CampaignPayload;
  let defaultOffer: RetentionOfferResponsePayload = null;
  for (const offer of payload) {
    if (!defaultOffer || defaultOffer.statusId < offer.statusId) {
      defaultOffer = offer;
    }
  }
  if (campaignModel) {
    result = JSON.parse(JSON.stringify(campaignModel.data)) as CampaignPayload;
  } else {
    const offer = defaultOffer;
    result = {
      ...offer,
      marketingHeadline: offer.offerHeader,
      offerAppliedBanner: offer.offerAppliedBannerText,
      offerBgImageUrl: null,
      offerHeadline: offer.offerBodyText,
      offerTerms: offer.legalDisclaimer,
      subhead: offer.offerBoldedText,
      welcomeEmailText: offer.welcomeEmailText,
      offerCodeType: CodeType.SINGLE_CODE,
      offerTypeId: OfferTypes.RETENTION,
      claimOfferTerms: offer.claimOfferTerms,
    };
    if (!result.campaignName) {
      result.campaignName = offer.offerName;
    }
  }
  result.regions = regions;
  result.languages = languages;
  result.statusId = campaignStatus(payload);
  if (result.endDateTime === 'Invalid date') {
    result.endDateTime = null;
  }
  result.offerTypeId = OfferTypes.RETENTION;
  result.couponState = defaultOffer.couponState;
  result.entryState = defaultOffer.entryState;
  result.environments = defaultOffer.environments;
  result.couponExpiredAt = defaultOffer.couponExpiredAt;
  result.couponCreatedAt = defaultOffer.couponCreatedAt;
  result.couponUpdatedAt = defaultOffer.couponUpdatedAt;
  result.welcomeEmailText = result.welcomeEmailText
    ? result.welcomeEmailText
    : defaultOffer.welcomeEmailText;

  return result;
};

export const retentionConvertFromCampaign = async (
  payload: CampaignPayload,
  setBrackets?: boolean,
): Promise<RetentionOfferResponsePayload[]> => {
  const plans = await allPlans();
  const stores = await Store.findAll({
    include: [
      { model: Region, include: [{ model: Language }, { model: Currency }] },
    ],
    order: ['RegionCode', 'BrandCode', 'PlatformCode'],
  });
  let regionsAdditionalData: any = [];
  if (stores && stores.length > 0) {
    stores.forEach((value) => {
      const storeModel = value as StoreModel;
      const currency: CurrencyInfoPayload = {
        code: storeModel.Region.Currency.code,
        name: storeModel.Region.Currency.name,
        ratio: storeModel.Region.Currency.ratio,
        prefix: storeModel.Region.Currency.prefix,
      };
      const region: any = {
        code: storeModel.Region.title,
        currency: currency,
      };
      regionsAdditionalData.push(region);
    });
  }

  const result: RetentionOfferResponsePayload[] = [];
  for (const region of payload.regions) {
    const setBracketsValues: boolean = setBrackets ? setBrackets : region.statusId !== StatusEnum.DFT;
    const planModel = plans[region.eligiblePlans[0]];
    const languagePrefix = `${region.code}-`;
    const localized: { [key: string]: LocalizedPayload } = {};
    let welcomeEmailText = '';
    for (const language of payload.languages) {
      if (language.code.startsWith(languagePrefix)) {
        const languageCode = language.code.substr(languagePrefix.length);
        const regionData: CampaignRegion = payload.regions.find((region) => {
          return region.code === language.code.substring(0, 2);
        });
        const regionsAddData = regionsAdditionalData.find((region: any) => {
          return region.code === regionData.code;
        });
        const currencyPrefix = regionsAddData.currency.prefix;
        localized[languageCode] = {
          legalDisclaimer: setBracketsValues && language.offerTerms?.length
            ? getFieldsValuesInBrackets(language.offerTerms, regionData, currencyPrefix, payload)
            : language.offerTerms,
          offerAppliedBannerText: setBracketsValues && language.offerAppliedBanner?.length
            ? getFieldsValuesInBrackets(language.offerAppliedBanner, regionData, currencyPrefix, payload)
            : language.offerAppliedBanner,
          offerBgImageUrl: language.offerBgImageUrl,
          offerBodyText: setBracketsValues && language.offerHeadline?.length
            ? getFieldsValuesInBrackets(language.offerHeadline, regionData, currencyPrefix, payload)
            : language.offerHeadline,
          offerBoldedText: setBracketsValues && language.subhead?.length
            ? getFieldsValuesInBrackets(language.subhead, regionData, currencyPrefix, payload)
            : language.subhead,
          offerHeader: setBracketsValues && language.marketingHeadline?.length
            ? getFieldsValuesInBrackets(language.marketingHeadline, regionData, currencyPrefix, payload)
            : language.marketingHeadline,
          welcomeEmailText: setBracketsValues && language.welcomeEmailText?.length
            ? getFieldsValuesInBrackets(language.welcomeEmailText, regionData, currencyPrefix, payload)
            : language.welcomeEmailText,
          claimOfferTerms: setBracketsValues && language.claimOfferTerms?.length
            ? getFieldsValuesInBrackets(language.claimOfferTerms, regionData, currencyPrefix, payload)
            : language.claimOfferTerms,
        };
        if (languageCode != 'en' || welcomeEmailText === '') {
          welcomeEmailText = setBracketsValues && language.welcomeEmailText?.length
            ? getFieldsValuesInBrackets(language.welcomeEmailText, regionData, currencyPrefix, payload)
            : language.welcomeEmailText;
        }
      }
    }
    if (!localized['en']) {
      localized['en'] = {
        legalDisclaimer: payload.offerTerms,
        offerAppliedBannerText: payload.offerAppliedBanner,
        offerBgImageUrl: payload.offerBgImageUrl,
        offerBodyText: payload.offerHeadline,
        offerBoldedText: payload.subhead,
        offerHeader: payload.marketingHeadline,
        welcomeEmailText: payload.welcomeEmailText,
        claimOfferTerms: payload.claimOfferTerms,
      };
    }
    const defaultLocalized: LocalizedPayload = localized['en'];
    if (payload.endDateTime === 'Invalid date') {
      payload.endDateTime = null;
    }
    const offer: RetentionOfferResponsePayload = {
      campaign: payload.campaign,
      campaignName: payload.campaignName,
      totalUniqueCodes: region.totalUniqueCodes,
      origTotalUniqueCodes: region.origTotalUniqueCodes,
      discountAmount: region.price,
      discountDurationType:
        region.durationType === DurationType.SINGLE_USE
          ? DurationType.SINGLE_USE
          : DurationType.TEMPORAL,
      discountDurationUnit: region.durationUnit,
      discountDurationValue: region.durationValue,
      discountType: payload.discountType as DiscountType,
      eligiblePlans: region.eligiblePlans,
      endDateTime: payload.endDateTime,
      legalDisclaimer: defaultLocalized.legalDisclaimer,
      localized: localized,
      noEndDate: payload.noEndDate,
      offerAppliedBannerText: defaultLocalized.offerAppliedBannerText,
      offerBodyText: defaultLocalized.offerBodyText,
      offerBoldedText: defaultLocalized.offerBoldedText,
      claimOfferTerms: defaultLocalized.claimOfferTerms,
      offerCodeType: payload.offerCodeType,
      offerCode: region.offerCode,
      offerHeader: defaultLocalized.offerHeader,
      offerName: region.offerName,
      storeCode: planModel.storeCode,
      welcomeEmailText,
      offerBusinessOwner: payload.offerBusinessOwner,
      statusId: region.statusId,
      environments: [],
      upgradePlan: region.upgradePlan,
      usersOnPlans:
        region.usersOnPlans &&
        region.usersOnPlans.length == 1 &&
        region.usersOnPlans[0] === '-'
          ? []
          : region.usersOnPlans,
    };
    result.push(offer);
  }
  return result;
};
