import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface RoleAttributes {
  roleId: number;
  title: string;
  description: string;
}

export interface RoleModel extends RoleAttributes, Model {}

type RoleStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): RoleModel;
};

export const roleFactory = (sequelize: Sequelize): RoleStatic => {
  const attributes = {
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'RoleID',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'Description',
    },
  };
  const options = {
    tableName: 'Roles',
    timestamps: false,
  };
  return <RoleStatic>sequelize.define('Roles', attributes, options);
};
