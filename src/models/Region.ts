import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { LanguageModel } from './Language';
import { CurrencyModel } from './Currency';

interface RegionAttributes {
  regionCode: string;
  title: string;
  description: string;
  currency: string;
}

export interface RegionModel extends RegionAttributes, Model {
  Language?: LanguageModel;
  Currency?: CurrencyModel;
}

type RegionStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): RegionModel;
};

export const regionFactory = (sequelize: Sequelize): RegionStatic => {
  const attributes = {
    regionCode: {
      type: DataTypes.STRING(3),
      allowNull: false,
      primaryKey: true,
      autoIncrement: false,
      field: 'RegionCode',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Description',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Currency',
    },
  };
  const options = {
    tableName: 'Regions',
    timestamps: false,
  };
  return <RegionStatic>sequelize.define('Regions', attributes, options);
};
