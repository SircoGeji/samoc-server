import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

export interface OfferHistoryAttributes {
    id: number;
    storeCode: string;
    offerCode: string;
    statusId: number;
    createdBy: string;
    createdAt: Date;
    updatedBy: string;
    updatedAt: Date;
    draftData: JSON;
}

export interface OfferHistoryModel extends OfferHistoryAttributes, Model { }

type OfferHistoryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): OfferHistoryModel;
};

export const offerHistoryFactory = (sequelize: Sequelize): OfferHistoryStatic => {
  const attributes = {
    id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
        field: 'Id',
    },
    storeCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'StoreCode',
    },
    offerCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'OfferCode',
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'StatusID',
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
    draftData: {
      type: DataTypes.JSON,
      field: 'DraftData',
    },
  };
  const options = {
    tableName: 'OffersHistory',
    timestamps: false,
  };
  return <OfferHistoryStatic>sequelize.define('OffersHistory', attributes, options);
};
