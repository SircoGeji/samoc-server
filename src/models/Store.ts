import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { BrandModel } from './Brand';
import { PlatformModel } from './Platform';
import { RegionModel } from './Region';

export interface StoreAttributes {
  storeCode: string;
  brandCode: string;
  platformCode: string;
  regionCode: string;
  rlySubdomainStg?: string;
  rlyApiKeyStg?: string;
  rlySubdomainProd?: string;
  rlyApiKeyProd?: string;
  cfSpaceId?: string;
  cfEnvId?: string;
  cfApiKey?: string;
  rlyPublicApiKeyStg?: string;
  rlyPublicApiKeyProd?: string;
  ipAddress?: string;
  postalCode?: string;
}

export interface StoreModel extends StoreInternalModel {
  Brand?: BrandModel;
  Platform?: PlatformModel;
  Region?: RegionModel;
}

interface StoreInternalModel extends StoreAttributes, Model {}

type StoreStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): StoreInternalModel;
};

export const storeFactory = (sequelize: Sequelize): StoreStatic => {
  const attributes = {
    storeCode: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: 'StoreCode',
    },
    brandCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'BrandCode',
    },
    platformCode: {
      type: DataTypes.STRING(15),
      allowNull: false,
      field: 'PlatformCode',
    },
    regionCode: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'RegionCode',
    },
    rlySubdomainStg: {
      type: DataTypes.STRING(255),
      field: 'RlySubdomainStg',
    },
    rlyApiKeyStg: {
      type: DataTypes.STRING(255),
      field: 'RlyApiKeyStg',
    },
    rlySubdomainProd: {
      type: DataTypes.STRING(255),
      field: 'RlySubdomainProd',
    },
    rlyApiKeyProd: {
      type: DataTypes.STRING(255),
      field: 'RlyApiKeyProd',
    },
    cfSpaceId: {
      type: DataTypes.STRING(255),
      field: 'CFSpaceId',
    },
    cfEnvId: {
      type: DataTypes.STRING(255),
      field: 'CFEnvId',
    },
    cfApiKey: {
      type: DataTypes.STRING(255),
      field: 'CFApiKey',
    },

    rlyPublicApiKeyStg: {
      type: DataTypes.STRING(255),
      field: 'RlyPublicApiKeyStg',
    },
    rlyPublicApiKeyProd: {
      type: DataTypes.STRING(255),
      field: 'RlyPublicApiKeyProd',
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      field: 'IpAddress',
    },
    postalCode: {
      type: DataTypes.STRING(64),
      field: 'PostalCode',
    },
  };
  const options = {
    tableName: 'Stores',
    timestamps: false,
  };
  return <StoreStatic>sequelize.define('Stores', attributes, options);
};
