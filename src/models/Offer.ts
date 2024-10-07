import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { OfferTypeModel } from './OfferType';
import { PlanModel } from './Plan';
import { StatusModel } from './Status';
import { CampaignModel } from './Campaign';

export interface OfferAttributes {
  couponId?: string; // recurly coupon code id
  offerCode: string; // code
  storeCode: string; // store code
  campaign: string;
  campaignName: string;
  offerTypeId: number; // 1=Default Signup, 2=Acquisition Offers
  planCode: string; // eligible plans
  cta?: string;
  businessOwner?: string;
  vanityUrl?: string;
  onTime?: Date; // publish date/time
  statusId?: number;
  // createdAt: Date; // handled by Sequelize
  createdBy?: number;
  // lastModifiedAt?: Date; // handled by Sequelize
  lastModifiedBy?: number;
  // deletedAt: Date; // handled by Sequelize
  bambooBuildKey?: string;
  draftData?: JSON | any;
  glRollbackVersion?: number;
  totalUniqueCodes?: number;
  dataIntegrityStatus?: boolean;
  dataIntegrityCheckTime?: Date;
  dataIntegrityErrorMessage?: string;
}

export interface OfferModel extends OfferInternalModel {
  OfferType?: OfferTypeModel;
  Plan?: PlanModel;
  Status?: StatusModel;
  Campaign?: CampaignModel;
}

export interface OfferInternalModel
  extends Model<OfferAttributes>,
    OfferAttributes {}

type OfferStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): OfferInternalModel;
};

export const offerFactory = (sequelize: Sequelize): OfferStatic => {
  const attributes = {
    couponId: {
      type: DataTypes.STRING(50),
      field: 'CouponId',
    },
    offerCode: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: 'OfferCode',
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
    offerTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'OfferTypeID',
    },
    planCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'PlanCode',
    },
    cta: {
      type: DataTypes.STRING(255),
      field: 'CTA',
    },
    businessOwner: {
      type: DataTypes.STRING(255),
      field: 'BusinessOwner',
    },
    vanityUrl: {
      type: DataTypes.STRING(255),
      field: 'VanityURL',
    },
    onTime: {
      type: DataTypes.DATE,
      field: 'OnTime',
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
      field: 'bambooBuildKey',
    },
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
    },
    glRollbackVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'GlRollbackVersion',
    },
    totalUniqueCodes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'TotalUniqueCodes',
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
    tableName: 'Offers',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return <OfferStatic>sequelize.define('Offers', attributes, options);
};
