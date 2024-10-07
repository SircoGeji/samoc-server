import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { StatusModel } from './Status';
import { StoreModel } from './Store';
import { CampaignModel } from './Campaign';

export interface RetentionOfferAttributes {
  couponId?: string; // recurly coupon code id
  upgradeCouponId?: string; // recurly coupon code id
  offerCode: string; // code
  upgradeOfferCode?: string; // code
  storeCode: string;
  campaign: string;
  campaignName: string;
  eligiblePlans?: string;
  switchToPlan?: string;
  isCouponless?: boolean;
  usersOnPlans?: string;
  businessOwner?: string;
  statusId?: number;
  // createdAt: Date; // handled by Sequelize
  createdBy?: number;
  // lastModifiedAt?: Date; // handled by Sequelize
  lastModifiedBy?: number;
  // deletedAt: Date; // handled by Sequelize
  bambooBuildKey?: string;
  draftData?: JSON | any;
  glRollbackVersion?: number;
  dataIntegrityStatus?: boolean;
  dataIntegrityCheckTime?: Date;
  dataIntegrityErrorMessage?: string;
}

export interface RetentionOfferModel extends RetentionOfferInternalModel {
  Store?: StoreModel;
  Status?: StatusModel;
  Campaign?: CampaignModel;
}

export interface RetentionOfferInternalModel
  extends Model<RetentionOfferAttributes>,
    RetentionOfferAttributes {}

type RetentionOfferStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): RetentionOfferInternalModel;
};

export const retentionOfferFactory = (
  sequelize: Sequelize,
): RetentionOfferStatic => {
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
    campaign: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Campaign',
    },
    campaignName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'CampaignName',
    },
    eligiblePlans: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'EligiblePlans',
    },
    switchToPlan: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'SwitchToPlan',
    },
    isCouponless: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'IsCouponless',
    },
    usersOnPlans: {
      type: DataTypes.STRING(255),
      field: 'UsersOnPlans',
    },
    businessOwner: {
      type: DataTypes.STRING(255),
      field: 'BusinessOwner',
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
    bambooBuildKey: {
      type: DataTypes.STRING(32),
      field: 'BambooBuildKey',
    },
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
    },
    glRollbackVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'GlRollbackVersion',
    },
    dataIntegrityStatus: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'DataIntegrityStatus',
    },
    dataIntegrityCheckTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'DataIntegrityCheckTime',
    },
    dataIntegrityErrorMessage: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'DataIntegrityErrorMessage',
    },
  };
  const options = {
    tableName: 'RetentionOffers',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return sequelize.define('RetentionOffers', attributes, options);
};
