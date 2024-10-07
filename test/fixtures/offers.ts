import { OfferAttributes } from '../../src/models/Offer';
import { StatusEnum } from '../../src/types/enum';

export interface MockDbOfferAtt extends OfferAttributes {
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export const prodOffer: MockDbOfferAtt = {
  couponId: 'ntjt65j5xwox',
  offerCode: `samocqa_create_offer_int_${new Date().getTime()}`,
  offerTypeId: 2,
  planCode: 'flex',
  cta: 'offer cta',
  businessOwner: 'business owner',
  vanityUrl: 'vanity url',
  onTime: new Date('2021-11-03 09:00:00'),
  statusId: StatusEnum.PROD,
  createdBy: 1,
  lastModifiedBy: 1,
  bambooBuildKey: 'asdfdsf',
  draftData: JSON.parse('{}'),
  createdAt: '2020-11-04T20:36:19.426Z',
  updatedAt: '2020-11-04T20:36:19.426Z',
  deletedAt: null,
};

export const draftOffer: MockDbOfferAtt = {
  couponId: '',
  offerCode: `samocqa_create_offer_int_${new Date().getTime()}`,
  offerTypeId: 2,
  planCode: 'flex',
  cta: '',
  businessOwner: '',
  vanityUrl: '',
  onTime: null,
  statusId: StatusEnum.DFT,
  createdBy: 1,
  lastModifiedBy: null,
  bambooBuildKey: '',
  draftData: JSON.parse(
    '{"offerCTA": "Offer CTA content goes here.", "planCode": "flex", "noEndDate": false, "offerCode": "samocqa_mi3mfe", "offerName": "Exclusive Offer for samocqa_mi3mfe Subscribers", "endDateTime": "2020-12-05T18:00:00.000Z", "offerHeader": "Exclusive Offer for samocqa_mi3mfe Subscribers", "offerTypeId": 2, "discountType": "fixed", "offerBodyText": "Offer Body Text for samocqa_mi3mfe goes here.", "offerCodeType": "single_code", "discountAmount": 1, "offerVanityUrl": "/vanityUrlGoesHere", "legalDisclaimer": "By selecting \\"CLAIM OFFER\\", you agree to authorize this charge and to the flex <a ng-click=\\"vm.showTerms()\\">Terms of Service</a> and <a ng-click=\\"vm.showPrivacy()\\">Privacy Policy</a>.", "offerBgImageUrl": "https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560", "offerBoldedText": "Get flex with your new samocqa_mi3mfe subscription. Home to hit Original Series like Power and Outlander and thousands of movies.", "publishDateTime": "2020-11-05T18:00:00.000Z", "welcomeEmailText": "Welcome text goes here", "offerBusinessOwner": "Business Owner", "discountDurationUnit": "month", "discountDurationValue": 1, "offerAppliedBannerText": "$x/MONTH FOR y MONTHS PROMO APPLIED"}',
  ),
  createdAt: '2020-11-04T20:36:19.426Z',
  updatedAt: '2020-11-04T20:36:19.426Z',
  deletedAt: null,
};

export const stageOffer: MockDbOfferAtt = {
  couponId: 'nt82li6d5dop',
  offerCode: `samocqa_create_offer_int_${new Date().getTime()}`,
  offerTypeId: 2,
  planCode: 'flex',
  cta: 'offer cta',
  businessOwner: 'business owner',
  vanityUrl: 'vanity url',
  onTime: new Date('2021-11-03 09:00:00'),
  statusId: StatusEnum.STG,
  createdBy: 1,
  lastModifiedBy: 1,
  bambooBuildKey: 'asdfdsf',
  draftData: JSON.parse('{}'),
  createdAt: '2020-11-04T20:36:19.426Z',
  updatedAt: '2020-11-04T20:36:19.426Z',
  deletedAt: null,
};
