import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface OfferTypeAttributes {
  offerTypeId: number;
  title: string;
}

export interface OfferTypeModel extends OfferTypeAttributes, Model {}

type OfferTypeStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): OfferTypeModel;
};

export const offerTypeFactory = (sequelize: Sequelize): OfferTypeStatic => {
  const attributes = {
    offerTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'OfferTypeID',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title',
    },
  };
  const options = {
    tableName: 'OfferTypes',
    timestamps: false,
  };
  return <OfferTypeStatic>sequelize.define('OfferTypes', attributes, options);
};
