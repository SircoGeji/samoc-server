import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface LanguageAttributes {
  regionCode: string;
  languageCode: string;
  isFallback: boolean;
  name: string;
  contentfulCode: string;
}

export interface LanguageModel extends LanguageAttributes, Model {}

type LanguageStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): LanguageModel;
};

export const languageFactory = (sequelize: Sequelize): LanguageStatic => {
  const attributes = {
    regionCode: {
      type: DataTypes.STRING(3),
      allowNull: false,
      primaryKey: true,
      autoIncrement: false,
      field: 'RegionCode',
    },
    languageCode: {
      type: DataTypes.STRING(16),
      allowNull: false,
      primaryKey: true,
      autoIncrement: false,
      field: 'LanguageCode',
    },
    isFallback: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'IsFallback',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Name',
    },
    contentfulCode: {
      type: DataTypes.STRING(16),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'ContentfulCode',
    },
  };
  const options = {
    tableName: 'Languages',
    timestamps: false,
  };
  return <LanguageStatic>sequelize.define('Languages', attributes, options);
};
