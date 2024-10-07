import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface EnvironmentConfigAttributes {
  config: string;
  value: string;
}

export interface EnvironmentConfigModel extends Model<EnvironmentConfigAttributes>, EnvironmentConfigAttributes {}

type EnvironmentConfigStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): EnvironmentConfigModel;
};

export const environmentConfigFactory = (sequelize: Sequelize): EnvironmentConfigStatic => {
  const attributes = {
    config: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
      field: 'Config',
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Value',
    },
  };
  const options = {
    tableName: 'EnvironmentConfig',
    timestamps: false,
  };
  return <EnvironmentConfigStatic>sequelize.define('EnvironmentConfigs', attributes, options);
};
