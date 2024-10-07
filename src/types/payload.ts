import { DiscountType, DurationType } from './enum';
import { UserEligibilityStatus } from '../models/UserEligibility';
import { StoreTranslatedStatus } from '../models/StoreTranslations';
import { StoreModel } from '../models/Store';

interface OfferBasePayload {
  storeCode?: string; // store code. e.g. flex-web-us
  campaign?: string; // campaign ID
  campaignName?: string; // campaign name
  offerCode: string; // offerCode
  offerTypeId: number; // offerTypeId: 1=Default Signup, 2=Acquisition Offers
  planCode?: string; // planCode
}

export interface OfferDbPayload extends OfferBasePayload {
  offerCTA?: string; // cta
  offerBusinessOwner?: string; // businessOwner
  offerVanityUrl?: string; // vanityUrl
  publishDateTime?: string; // iso format: yyyy-mm-ddThh:mm:ssZ
  lastModifiedAt?: any;
  totalUniqueCodes?: number;
  dataIntegrityStatus?: boolean;
  dataIntegrityCheckTime?: Date;
  dataIntegrityErrorMessage?: string;
  errMessage?: string | null;
}

interface OfferExternalPayload extends OfferBasePayload {
  discountType: string; // discountType: [fixed, trial]
  discountAmount?: number; // discountAmount
  discountDurationType?: string;
  discountDurationValue?: number; // discountDurationValue
  discountDurationUnit?: string; // discountDurationUnit: [day, week, month, year]
  updatedAt?: Date;
  glValidationError?: string;
}

export interface LocalizedPayload {
  offerHeader: string; // offer title
  offerBodyText: string; // description
  offerBoldedText?: string; // total line
  offerAppliedBannerText: string; // bannerText
  legalDisclaimer: string; // legalDisclaimer
  offerBgImageUrl: string; // imageUrl
  welcomeEmailText?: string; // stored in Recurly!
  claimOfferTerms?: string;
  offerTitle?: string;
  offerDescription?: string;
  offerTerms?: string;
  bannerText?: string;
}

export interface OfferContentfulPayload extends OfferExternalPayload {
  offerHeader: string; // offer title
  offerBodyText: string; // description
  offerBoldedText?: string; // total line
  offerAppliedBannerText: string; // bannerText
  legalDisclaimer: string; // legalDisclaimer
  offerBgImageUrl: string; // imageUrl
  environments: string[];
  entryState?: string; // contentful entry state
  contentfulUpdatedAt?: Date;
  contentfulImageUpdatedAt?: Date;
  claimOfferTerms?: string;
  localized?: { [key: string]: LocalizedPayload };
}

export interface OfferRecurlyPayload extends OfferExternalPayload {
  eligiblePlanCodes?: string[];
  offerName: string; // recurly coupon internal name
  offerCodeType: string; // offerCodeType: [single_code, bulk]
  totalUniqueCodes?: number; // totalUniqueCodes
  endDateTime?: string; // iso format: yyyy-mm-ddThh:mm:ssZ
  noEndDate: boolean;
  couponState?: string; // coupon state on recurly
  couponExpiredAt?: Date;
  welcomeEmailText: string; // invoiceDescription
  couponCreatedAt?: Date;
  couponUpdatedAt?: Date;
  coupon?: any;
}

export interface OfferRequestPayload
  extends OfferRecurlyPayload,
    OfferContentfulPayload,
    OfferDbPayload {}

export interface OfferRecurlyResponsePayload extends OfferRecurlyPayload {
  OfferType?: {
    id: number; // 1=Default Signup, 2=Acquisition Offers
    title: string;
  };
  Plan?: {
    planCode: string; // planCode
    price: number;
    trialDuration?: number;
    trialUnit?: string;
    Store?: StoreModel;
  };
  Status?: {
    id: number;
    title: string;
    description: string;
    sortPriority?: number;
  };
  totalRedemptions?: number;
  statusId: number;
  isInWorkflow?: string;
  csvFileName?: string;
  origTotalUniqueCodes?: number;
  offerBoldedTextHint?: string;
  offerUrl?: string;
}

export interface OfferResponsePayload
  extends OfferDbPayload,
    OfferRecurlyResponsePayload,
    OfferContentfulPayload {}

export interface PlanRecurlyPayload {
  planName: string; // plane name
  planId: string; // plan id
  planCode: string; // planCode
  price: number; // price
  billingCycleDuration?: number; // billingPeriodLength
  billingCycleUnit?: string; // billingPeriodUnit: [days, months]
  totalBillingCycles?: number; // billingCycles
  trialDuration?: number; // trialLength
  trialUnit?: string; // trialUnit: [days, months]
  state?: string; // plan state: [active, inactive]
  storeCode?: string
}

// plan payload (to be cleaned up later)
export interface PlanRequestPayload {
  planCode: string; // planCode
  price: number; // price
  billingCycleDuration?: number; // billingPeriodLength
  billingCycleUnit?: string; // billingPeriodUnit: [days, months]
  trialDuration?: number; // trialLength
  trialUnit?: string; // trialUnit: [days, months]
}

export interface PlanResponsePayload extends PlanRequestPayload {
  numberOfUsers: number;
  statusId: number;
  Status?: {
    id: number;
    title: string;
    description: string;
  };
  storeCode?: string
}

export interface UserRequestPayload {
  username: string;
  password: string;
}

export interface UserResponsePayload {
  sub: string;
  email: string;
  role: string[];
  exp: number;
}

export interface LoginResponsePayload {
  token: string;
  user: UserResponsePayload;
}

export interface StorePayload {
  es?: RegionInfoPayload;
  gb?: RegionInfoPayload;
  it?: RegionInfoPayload;
  mx?: RegionInfoPayload;
  us?: RegionInfoPayload;
  de?: RegionInfoPayload;
}

export interface RegionInfoPayload {
  displayName: string;
  description: string;
  brands: BrandPayload;
  currency: CurrencyInfoPayload;
  languages: { [key: string]: LanguageInfoPayload };
}

interface BrandPayload {
  pantaya?: BrandInfoPayload;
  flex?: BrandInfoPayload;
  flexplay?: BrandInfoPayload;
}

export interface BrandInfoPayload {
  displayName: string;
  platforms: PlatformPayload;
}

export interface CurrencyInfoPayload {
  code: string;
  name: string;
  ratio: number;
  prefix: string;
}

export interface LanguageInfoPayload {
  name: string;
  isFallback: boolean;
}

interface PlatformPayload {
  android?: PlatformInfoPayload;
  ios?: PlatformInfoPayload;
  web?: PlatformInfoPayload;
}

export interface PlatformInfoPayload {
  displayName: string;
  storeCode: string;
}

// Retention offers
interface RetentionOfferBasePayload {
  offerCode: string; // offerCode
  storeCode: string; // storeCode
}

// Extension offers
interface ExtensionOfferBasePayload {
  offerCode: string; // offerCode
  storeCode: string; // storeCode
}

export interface RetentionOfferDbPayload extends RetentionOfferBasePayload {
  campaign?: string; // campaign ID
  campaignName?: string; // campaign name
  offerBusinessOwner: string; // businessOwner
  eligiblePlans: string[]; // list of eligible plan codes (can be empty iff offer is eligible for all plans)
  upgradePlan?: string;
  isCouponless?: boolean;
  usersOnPlans?: string[];
  publishDateTime?: string; // iso format: yyyy-mm-ddThh:mm:ssZ
  lastModifiedAt?: any;
}

export interface ExtensionOfferDbPayload extends ExtensionOfferBasePayload {
  upgradeOfferCode?: string; // code
  switchToPlan?: string;
  upgradePlan?: string;
  usersOnPlans?: string[];
  statusId?: number;
  createdBy?: string;
  lastModifiedBy?: string;
  eligibleCharges: string[];
  durationType: string;
  discountAmount: number;
  durationAmount: number;
  durationUnit: string;
  offerTitle: string;
  offerDescription: string;
  offerTerms: string;
  offerBusinessOwner: string;
  bannerText?: string;
}

interface RetentionOfferExternalPayload extends RetentionOfferBasePayload {
  eligiblePlans: string[]; // list of eligible plan codes (can be empty iff offer is eligible for all plans)
  isCouponless?: boolean;
  totalUniqueCodes?: number,
  origTotalUniqueCodes?: number,
  discountType: DiscountType; // discountType: [fixed, percent]
  durationType?: string;
  discountAmount: number; // discountAmount
  discountDurationType: string; // duration type [forever, single_use, temporal]
  discountDurationValue: number; // discountDurationValue
  discountDurationUnit: string; // discountDurationUnit: [day, week, month, year]
  updatedAt?: Date;
  glValidationError?: string;
}

interface ExtensionOfferExternalPayload extends ExtensionOfferBasePayload {
  eligibleCharges: string[]; // list of eligible plan codes (can be empty iff offer is eligible for all plans)
  discountAmount: number;
  durationType: string;
  durationAmount: number;
  durationUnit: string;
  updatedAt?: Date;
}

export interface RetentionOfferContentfulPayload
  extends RetentionOfferExternalPayload {
  offerHeader: string; // offer title
  offerBodyText: string; // description
  offerBoldedText?: string; // total line
  offerAppliedBannerText: string; // bannerText
  legalDisclaimer: string; // legalDisclaimer
  environments: string[];
  entryState?: string; // contentful entry state
  localized?: { [key: string]: LocalizedPayload };
  claimOfferTerms?: string;
}

export interface ExtensionOfferContentfulPayload
  extends ExtensionOfferExternalPayload {
  offerTitle: string;
  offerDescription: string;
  offerTerms: string;
  bannerText: string; // bannerText
  environments: string[];
  entryState?: string; // contentful entry state
  localized?: { [key: string]: LocalizedPayload };
}

export interface RetentionOfferRecurlyPayload
  extends RetentionOfferExternalPayload {
  offerName: string; // recurly coupon internal name
  endDateTime?: string; // iso format: yyyy-mm-ddThh:mm:ssZ
  noEndDate: boolean;
  couponState?: string; // coupon state on recurly
  welcomeEmailText?: string; // invoiceDescription
  couponExpiredAt?: Date;
  couponCreatedAt?: Date;
  couponUpdatedAt?: Date;
  offerCodeType?: string;
  isUpgrade?: boolean;
  coupon?: any;
  upgradePlan?: string;
}

export interface ExtensionOfferRecurlyPayload
  extends ExtensionOfferExternalPayload {
  offerTitle: string; // recurly coupon internal name
  couponState?: string; // coupon state on recurly
  couponExpiredAt?: Date;
  couponCreatedAt?: Date;
  couponUpdatedAt?: Date;
  isUpgrade?: boolean;
  coupon?: any;
  upgradePlan?: string;
}

export interface RetentionOfferResponsePayload
  extends RetentionOfferDbPayload,
    RetentionOfferRecurlyPayload,
    RetentionOfferContentfulPayload {
  statusId: number;
}

// Payload for retention offers available for plans
export interface AllowedOffersForTerm {
  term: number;
  allowedOffers: RetentionOfferRecurlyPayload[];
}

export interface UpdateOffersForPlan {
  planCode: string;
  primaryOfferCodes: string[];
  secondaryOfferCodes: string[];
}

export interface FilterState {
  stgVer: number;
  prodVer: number;
  status: UserEligibilityStatus;
  canDelete: boolean;
  canRetire: boolean;
  updatedAt?: Date;
  updatedBy?: string;
  errorMessage?: string;
  testUrl?: string;
}

export interface StoreTranslatedState {
  stgVer: number;
  prodVer: number;
  status: StoreTranslatedStatus;
  canDelete: boolean;
  canRetire: boolean;
  updatedAt?: Date;
  updatedBy?: string;
  errorMessage?: string;
}

export interface StoreTranslatedPayload {
  translatedState: StoreTranslatedState;
  translations: any;
}

export interface RetentionOfferWeightedList {
  name: string;
  weight: number;
  offers: string[];
}

export interface RetentionOfferUserEligibilityRule {
  name?: string;
  countries?: string[];
  planLengthInMonths?: number;
  isInFreeTrial?: boolean;
  activeCoupons?: string[];
  inactiveCoupons?: string[];
  primaryLists: RetentionOfferWeightedList[];
  secondaryLists: RetentionOfferWeightedList[];
  suffix?: number;
  exclusiveOfferOverrides?: any;
}

export interface RetentionOfferUserEligibilityPayload {
  regions?: string[];
  filterState: FilterState;
  rules: RetentionOfferUserEligibilityRule[];
}

export interface OfferDitResultRequest {
  dataIntegrityStatus?: boolean;
  dataIntegrityErrorMessage?: string;
}

export interface SKURegions {
  regionCode?: string;
  planTitle?: string;
  term?: string;
  marketingDescription?: string;
  savingsDescription?: string;
  longDescription?: string;
  details?: string;
  termDuration?: string;
  disclaimer?: string;
}

export interface SKUDbPayload {
  store?: string;
  storeParentSKUId?: string;
  storeSKUId?: string;
  name?: string;
  linkId?: string;
  SKURegions?: SKURegions[];
}

export interface AndroidModulePayload {
  moduleType?: number;
  moduleUniqueId?: number;
  data?: JSON;
}
