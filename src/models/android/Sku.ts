import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidSkuAttributes extends AndroidMasterAttributes {
  storeId: number;
  productId: number;
  envId: number;
  promotionId: number;
  hasChanges: boolean;
  name: string;
  parentSkuId: string;
  storeSkuId: string;
  linkId?: string;
  isPublished: boolean;
  status: string;
  isArchived: boolean;
  active: boolean;
  promotedAt: Date;
  needToPromote: boolean;
}

export interface AndroidSkuModel extends AndroidSkuAttributes, Model {}

type AndroidSkuStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): AndroidSkuModel;
};

export const AndroidSkuFactory = (sequelize: Sequelize): AndroidSkuStatic => {
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
    parentSkuId: {
      type: DataTypes.CHAR(128),
      allowNull: false,
      field: 'parentSkuId',
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
    tableName: 'Android_Sku',
    timestamps: false,
  };
  return <AndroidSkuStatic>sequelize.define('AndroidSku', attributes, options);
};
