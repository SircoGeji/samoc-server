import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { StatusModel } from '../Status';
import { StoreModel } from '../Store';

export interface ExtensionOfferAttributes {
  couponId?: string; // recurly coupon code id
  upgradeCouponId: string; // recurly coupon code id
  offerCode: string; // code
  upgradeOfferCode?: string; // code
  storeCode: string;
  switchToPlan: string;
  usersOnPlans: string;
  statusId: number;
  createdBy: number;
  lastModifiedBy: number;
  eligibleCharges: string;
  discountAmount: number;
  durationType: string;
  durationAmount: number;
  durationUnit: string;
  offerTitle: string;
  offerDescription: string;
  offerTerms: string;
  bannerText: string;
  offerBusinessOwner: string;
  draftData?: JSON | any;
}

export interface ExtensionOfferModel extends ExtensionOfferInternalModel {
  Store?: StoreModel;
  Status?: StatusModel;
}

export interface ExtensionOfferInternalModel
  extends Model<ExtensionOfferAttributes>,
    ExtensionOfferAttributes {}

type ExtensionOfferStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): ExtensionOfferInternalModel;
};

export const extensionOfferFactory = (
  sequelize: Sequelize,
): ExtensionOfferStatic => {
  const attributes = {
    couponId: {
      type: DataTypes.STRING(50),
      field: 'CouponId',
    },
    upgradeCouponId: {
      type: DataTypes.STRING(50),
      field: 'UpgradeCouponId',
    },
    offerCode: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: 'OfferCode',
    },
    upgradeOfferCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'UpgradeOfferCode',
    },
    storeCode: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: 'StoreCode',
    },
    eligibleCharges: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'EligibleCharges',
    },
    switchToPlan: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'SwitchToPlan',
    },
    usersOnPlans: {
      type: DataTypes.STRING(255),
      field: 'UsersOnPlans',
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'StatusID',
    },
    createdBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'CreatedBy',
    },
    lastModifiedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'LastModifiedBy',
    },
    discountAmount: {
      type: DataTypes.FLOAT(9, 2),
      field: 'DiscountAmount',
    },
    durationType: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'DurationType',
    },
    durationUnit: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'DurationUnit',
    },
    durationAmount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'DurationAmount',
    },
    offerTitle: {
      type: DataTypes.STRING(255),
      field: 'OfferTitle',
    },
    offerDescription: {
      type: DataTypes.STRING(255),
      field: 'OfferDescription',
    },
    offerTerms: {
      type: DataTypes.STRING(500),
      field: 'OfferTerms',
    },
    bannerText: {
      type: DataTypes.STRING(255),
      field: 'BannerText',
    },
    offerBusinessOwner: {
      type: DataTypes.STRING(255),
      field: 'OfferBusinessOwner',
    },
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
    },
  };
  const options = {
    tableName: 'ExtensionOffers',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return sequelize.define('ExtensionOffers', attributes, options);
};
