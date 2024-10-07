import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuSkuAttributes extends RokuMasterAttributes {
  storeId: number;
  productId: number;
  envId: number;
  promotionId: number;
  hasChanges: boolean;
  name: string;
  storeSkuId: string;
  linkId?: string;
  isPublished: boolean;
  status: string;
  isArchived: boolean;
  active: boolean;
  promotedAt: Date;
  needToPromote: boolean;
}

export interface RokuSkuModel extends RokuSkuAttributes, Model {}

type RokuSkuStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): RokuSkuModel;
};

export const RokuSkuFactory = (sequelize: Sequelize): RokuSkuStatic => {
  const attributes = {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'id',
    },
    createdBy: {
      type: DataTypes.CHAR(64),
      allowNull: true,
      field: 'createdBy',
    },
    created: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'created',
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'updated',
    },
    promotedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'promotedAt',
    },
    storeId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'storeId',
    },
    productId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'productId',
    },
    envId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'envId',
    },
    promotionId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'promotionId',
    },
    stagedId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'stagedId',
    },
    hasChanges: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'hasChanges',
    },
    name: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      field: 'name',
    },
    storeSkuId: {
      type: DataTypes.CHAR(128),
      allowNull: false,
      field: 'storeSkuId',
    },
    linkId: {
      type: DataTypes.CHAR(64),
      allowNull: true,
      field: 'linkId',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'isPublished',
    },
    status: {
      type: DataTypes.CHAR(32),
      allowNull: false,
      field: 'status',
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'isArchived',
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'active',
    },
    needToPromote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'needToPromote',
    },
  };
  const options = {
    tableName: 'Roku_Sku',
    timestamps: false,
  };
  return <RokuSkuStatic>sequelize.define('RokuSku', attributes, options);
};
