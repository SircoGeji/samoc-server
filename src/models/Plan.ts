import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { StatusModel } from './Status';
import { StoreModel } from './Store';

export interface PlanAttributes {
  planId?: string; // plan production id
  planCode: string; // plan code
  storeCode?: string;
  statusId?: number;
  // createdAt: Date; // handled by Sequelize
  createdBy?: number;
  // lastModifiedAt: Date; // handled by Sequelize
  lastModifiedBy?: number;
}

export interface PlanModel extends PlanInternalModel {
  Store?: StoreModel;
  Status?: StatusModel;
}

interface PlanInternalModel extends Model<PlanAttributes>, PlanAttributes {}

type PlanStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): PlanInternalModel;
};

export const planFactory = (sequelize: Sequelize): PlanStatic => {
  const attributes = {
    planId: {
      type: DataTypes.STRING(50),
      field: 'PlanId',
    },
    planCode: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      field: 'PlanCode',
    },
    storeCode: {
      type: DataTypes.STRING(50),
      field: 'StoreCode',
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
  };
  const options = {
    tableName: 'Plans',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return <PlanStatic>sequelize.define('Plans', attributes, options);
};
