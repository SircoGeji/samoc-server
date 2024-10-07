import { StatusEnum } from '../../src/types/enum';
import { ExtensionOfferAttributes } from '../../src/models/web/ExtensionOffer';

export interface MockDbExtensionOfferAtt extends ExtensionOfferAttributes {
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export enum Stage {
  Draft,
  Stage,
  Prod,
}

export interface Config {
  prefix: string;
  type: Stage;
  hasUpgrade?: boolean;
  hasEligiblePlans?: boolean;
  hasUsersOnPlans?: boolean;
  bambooBuildKey?: string;
}

const getStatusId = (t: Stage): StatusEnum => {
  switch (t) {
    case Stage.Prod:
      return StatusEnum.PROD;
    case Stage.Stage:
      return StatusEnum.STG;
    case Stage.Draft:
      return StatusEnum.DFT;
  }
};

export const mockExtensionOffer = (
  config: Config,
): MockDbExtensionOfferAtt => {
  const ts = new Date().getTime();
  return {
    couponId: config.type !== Stage.Draft ? config.prefix : undefined,
    upgradeCouponId:
      config.type !== Stage.Draft && config.hasUpgrade
        ? config.prefix + '_u'
        : '',
    offerCode: `ext_samocqa_int_${config.prefix}_${ts}`,
    upgradeOfferCode: config.hasUpgrade
      ? `ext_samocqa_int_${config.prefix}_${ts}_upgrade`
      : undefined,
    storeCode: 'flex-web-us',
    eligiblePlans: config.hasEligiblePlans ? 'flexy' : undefined,
    switchToPlan: config.hasUpgrade ? 'flexy' : '',
    usersOnPlans: config.hasUsersOnPlans ? 'flex' : '',
    businessOwner: 'business owner',
    statusId: getStatusId(config.type),
    createdBy: 1,
    lastModifiedBy: 1,
    bambooBuildKey: config.bambooBuildKey,
    draftData: JSON.parse('{}'),
    createdAt: '2020-11-04T20:36:19.426Z',
    updatedAt: '2020-11-04T20:36:19.426Z',
    deletedAt: null,
  };
};
