import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface PlatformAttributes {
  platformCode: number;
  title: string;
}

export interface PlatformModel extends PlatformAttributes, Model {}

type PlatformStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): PlatformModel;
};

export const platformFactory = (sequelize: Sequelize): PlatformStatic => {
  const attributes = {
    platformCode: {
      type: DataTypes.STRING(15),
      primaryKey: true,
      allowNull: false,
      field: 'PlatformCode',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title',
    },
  };
  const options = {
    tableName: 'Platforms',
    timestamps: false,
  };
  return <PlatformStatic>sequelize.define('Platforms', attributes, options);
};
