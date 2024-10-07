import bcrypt from 'bcrypt';
import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface UserAttributes {
  id: number;
  email: string;
  password: string;
  roleId: number;
}

interface UserModel extends Model<UserAttributes>, UserAttributes {}

type UserStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): UserModel;
};

export const userFactory = (sequelize: Sequelize): UserStatic => {
  const attributes = {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'UserID',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Email',
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Password',
    },
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'RoleID',
    },
  };
  const defineOptions = {
    hooks: {
      beforeCreate: async (user: UserModel) => {
        user.password = await bcrypt.hash(user.password, 10);
      },
    },
    tableName: 'Users',
    timestamps: false,
  };
  return <UserStatic>sequelize.define('Users', attributes, defineOptions);
};
