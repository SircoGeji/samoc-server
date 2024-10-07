import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface StatusAttributes {
  statusId: number;
  title: string;
  description: string;
  sortPriority: number;
}

export interface StatusModel extends StatusAttributes, Model {}

type StatusStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): StatusModel;
};

export const statusFactory = (sequelize: Sequelize): StatusStatic => {
  const attributes = {
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'StatusID',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title',
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Description',
    },
    sortPriority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'SortPriority',
    },
  };
  const options = {
    tableName: 'Status',
    timestamps: false,
  };
  return <StatusStatic>sequelize.define('Status', attributes, options);
};
