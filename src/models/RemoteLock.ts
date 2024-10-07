import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface RemoteLockAttributes {
  system: string;
  env: string;
}

export interface RemoteLockModel extends RemoteLockAttributes, Model {}

type RemoteLockStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): RemoteLockModel;
};

export const remoteLockFactory = (sequelize: Sequelize): RemoteLockStatic => {
  const attributes = {
    system: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      unique: true,
      field: 'System',
    },
    env: {
      type: DataTypes.STRING(10),
      unique: true,
      field: 'Env',
    },
  };
  const options = {
    tableName: 'RemoteLock',
    timestamps: true,
  };
  return <RemoteLockStatic>sequelize.define('RemoteLock', attributes, options);
};
