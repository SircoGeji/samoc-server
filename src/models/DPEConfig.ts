import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

export interface DPEConfigAttributes {
  id: number;
  regionCode: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  timestampUtc: Date;
  data: JSON;
}

export interface DPEConfigModel extends DPEConfigAttributes, Model {}

type DPEConfigStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): DPEConfigModel;
};

export const dpeConfigFactory = (sequelize: Sequelize): DPEConfigStatic => {
  const attributes = {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'Id',
    },
    regionCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'RegionCode',
    },
    createdBy: {
      type: DataTypes.STRING(24),
      field: 'CreatedBy',
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'CreatedAt',
    },
    updatedBy: {
      type: DataTypes.STRING(24),
      field: 'UpdatedBy',
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'UpdatedAt',
    },
    timestampUtc: {
      type: DataTypes.DATE,
      field: 'TimestampUtc',
    },
    data: {
      type: DataTypes.JSON,
      field: 'Data',
    },
  };
  const options = {
    tableName: 'DPEConfig',
    timestamps: false,
  };
  return <DPEConfigStatic>sequelize.define('DPEConfig', attributes, options);
};
