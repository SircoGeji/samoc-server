import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

export enum StoreTranslatedStatus {
  NEW = 0,
  STG = 1,
  PROD = 2,
}

export interface StoreTranslationsAttributes {
  statusId: StoreTranslatedStatus;
  stgRollbackVersion?: number;
  prodRollbackVersion?: number;
  createdBy?: string;
}

export interface StoreTranslationsModel
  extends Model<StoreTranslationsAttributes>,
    StoreTranslationsAttributes {}

type StoreTranslationsStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): StoreTranslationsModel;
};

export const storeTranslationsFactory = (
  sequelize: Sequelize,
): StoreTranslationsStatic => {
  const attributes = {
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'StatusId',
    },
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
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
    tableName: 'StoreTranslations',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
    paranoid: true,
  };
  return <StoreTranslationsStatic>(
    sequelize.define('StoreTranslations', attributes, options)
  );
};
