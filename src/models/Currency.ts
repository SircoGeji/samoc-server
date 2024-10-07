import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface CurrencyAttributes {
  code: string;
  name: string;
  ratio: number;
  prefix: string;
}

export interface CurrencyModel extends CurrencyAttributes, Model {}

type CurrencyStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): CurrencyModel;
};

export const currencyFactory = (sequelize: Sequelize): CurrencyStatic => {
  const attributes = {
    code: {
      type: DataTypes.STRING(3),
      allowNull: false,
      primaryKey: true,
      autoIncrement: false,
      field: 'Code',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Name',
    },
    ratio: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Ratio',
    },
    prefix: {
      type: DataTypes.STRING(16),
      allowNull: false,
      primaryKey: false,
      autoIncrement: false,
      field: 'Prefix',
    },
  };
  const options = {
    tableName: 'Currencies',
    timestamps: false,
  };
  return <CurrencyStatic>sequelize.define('Currencies', attributes, options);
};
