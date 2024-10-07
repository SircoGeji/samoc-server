import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

export enum UserEligibilityStatus {
  NEW = 0,
  STG = 1,
  PROD = 2,
  DFT,
}

export interface UserEligibilityAttributes {
  storeCode: string;
  regions?: string;
  statusId: UserEligibilityStatus;
  draftData?: JSON;
  prodData?: JSON;
  stgData?: JSON;
  stgRollbackVersion?: number;
  prodRollbackVersion?: number;
  createdBy?: string;
}

export interface UserEligibilityModel
  extends Model<UserEligibilityAttributes>,
    UserEligibilityAttributes {}

type UserEligibilityStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): UserEligibilityModel;
};

export const userEligibilityFactory = (
  sequelize: Sequelize,
): UserEligibilityStatic => {
  const attributes = {
    storeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'StoreCode',
    },
    regions: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'Regions',
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'StatusId',
    },
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
    },
    prodData: {
      type: DataTypes.JSON,
      field: 'ProdData',
    },
    stgData: {
      type: DataTypes.JSON,
      field: 'StgData',
    },
    stgRollbackVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'StgRollbackVersion',
    },
    prodRollbackVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: 'ProdRollbackVersion',
    },
    createdBy: {
      type: DataTypes.STRING(255),
      field: 'CreatedBy',
    },
  };
  const options = {
    tableName: 'UserEligibility',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return <UserEligibilityStatic>(
    sequelize.define('UserEligibility', attributes, options)
  );
};
