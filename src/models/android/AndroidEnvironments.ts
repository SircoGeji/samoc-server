import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidEnvironmentsAttributes extends AndroidMasterAttributes {
  code: string;
  name: string;
}

export interface AndroidEnvironmentsModel
  extends AndroidEnvironmentsAttributes,
    Model {}

type AndroidEnvironmentsStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): AndroidEnvironmentsModel;
};

export const AndroidEnvironmentsFactory = (
  sequelize: Sequelize,
): AndroidEnvironmentsStatic => {
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
    code: {
      type: DataTypes.CHAR(8),
      allowNull: false,
      field: 'code',
    },
    name: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      field: 'name',
    },
  };
  const options = {
    tableName: 'Android_Environments',
    timestamps: false,
  };
  return <AndroidEnvironmentsStatic>(
    sequelize.define('AndroidEnvironments', attributes, options)
  );
};
