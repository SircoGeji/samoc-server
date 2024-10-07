import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface SlackConfigAttributes {
    id: number,
    type: string,
    name: string,
    apiKey: string,
    enabled: boolean,
    data: JSON,
}

export interface SlackConfigModel extends SlackConfigAttributes, Model {}

type SlackConfigAttributesStatic = typeof Model & {
    new (values?: Record<string, unknown>, options?: BuildOptions): SlackConfigModel;
  };

export const slackConfigFactory = (sequelize: Sequelize): SlackConfigAttributesStatic => {
    const attributes = {
          id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'Id',
          },
          type: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'Type',
          },
          name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'Name',
          },
          apiKey: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'ApiKey',
          },
          enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'Enabled',
          },
          data: {
            type: DataTypes.JSON,
            field: 'Data',
          },
    };
    const options = {
        tableName: 'SlackConfig',
        timestamps: false,
    };
    return <SlackConfigAttributesStatic>sequelize.define('SlackConfig', attributes, options);
};