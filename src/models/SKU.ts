import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface SKUAttributes {
  id: number;
  name: string;
  data: JSON;
}

export interface SKUModel extends SKUAttributes, Model {}

type SKUStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): SKUModel;
};

export const SKUFactory = (sequelize: Sequelize): SKUStatic => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'Id',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Name',
    },
    data: {
      type: DataTypes.JSON,
      field: 'Data',
    },
  };
  const options = {
    tableName: 'SKU',
    timestamps: false,
  };
  return <SKUStatic>sequelize.define('SKU', attributes, options);
};
