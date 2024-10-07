import { OfferTypes, StatusEnum } from '../../../types/enum';

export interface CampaignRegion {
  code: string; // Region code, e.g. 'MX'
  price: number; // offer price in region currency
  totalUniqueCodes?: number;
  origTotalUniqueCodes?: number;
  durationType?: string;
  durationValue?: number; // number of discountDurationUnits
  durationUnit?: string; // discountDurationUnit: [day, week, month, year]
  planCode?: string; // region plan code
  eligiblePlans?: string[];
  eligiblePlanCodes?: string[];
  offerCode: string;
  offerName: string;
  offerCodeStatus?: string;
  statusId?: number;
  offerUrl?: string;
  couponState?: string; // coupon state on recurly
  couponExpiredAt?: Date;
  couponCreatedAt?: Date;
  couponUpdatedAt?: Date;
  environments?: string[]; // contentful environments list
  entryState?: string; // contentful entry state
  createUpgradeOffer?: boolean;
  upgradePlan?: string;
  usersOnPlans?: string[];
  isInWorkflow?: string,
  csvFileName?: string;
}

export interface CampaignLanguage {
  code: string; // Region-Language code, e.g. 'DE-de'
  marketingHeadline: string; // Contentful 'Offer Title'
  offerHeadline: string; // Contentful 'Offer Description'
  subhead: string; // Contentful 'Total'
  offerAppliedBanner: string; // Contentful 'Banner Text'
  offerTerms: string; // Recurly 'Offer Terms'
  offerBgImageUrl: string; // Localized image URL
  contentfulImageUpdatedAt?: Date;
  contentfulUpdatedAt?: Date;
  offerUrl?: string;
  welcomeEmailText?: string;
  claimOfferTerms?: string; // Contentful 'Claim Offer Terms'
}

export interface CampaignPayload {
  statusId: StatusEnum;
  offerTypeId: OfferTypes;
  discountType: string; // DiscountType;
  offerCodeType: string;
  totalUniqueCodes?: number;
  campaign?: string;
  campaignName?: string;
  offerBusinessOwner?: string;
  endDateTime?: string;
  noEndDate: boolean;
  couponState?: string;
  environments?: string[];
  entryState?: string;
  couponExpiredAt?: Date;
  couponCreatedAt?: Date;
  couponUpdatedAt?: Date;

  marketingHeadline: string; // Contentful 'Offer Title'
  offerHeadline: string; // Contentful 'Offer Description'
  subhead: string; // Contentful 'Total'
  offerAppliedBanner: string; // Contentful 'Banner Text'
  offerTerms: string; // Recurly 'Offer Terms'
  offerBgImageUrl: string; // Localized image URL

  welcomeEmailText?: string;
  claimOfferTerms?: string;

  regions?: CampaignRegion[];
  languages?: CampaignLanguage[];
}

export type CampaignResponsePayload = CampaignPayload;
