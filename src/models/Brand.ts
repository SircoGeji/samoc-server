import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface BrandAttributes {
  brandCode: string;
  title: string;
}

export interface BrandModel extends BrandAttributes, Model {}

type BrandStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): BrandModel;
};

export const brandFactory = (sequelize: Sequelize): BrandStatic => {
  const attributes = {
    brandCode: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      field: 'BrandCode',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title',
    },
  };
  const options = {
    tableName: 'Brands',
    timestamps: false,
  };
  return <BrandStatic>sequelize.define('Brands', attributes, options);
};
