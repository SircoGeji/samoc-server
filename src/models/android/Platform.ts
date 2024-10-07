import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidPlatformAttributes extends AndroidMasterAttributes {
    name: string;
    path: string;
}

export interface AndroidPlatformModel extends AndroidPlatformAttributes, Model { }

type AndroidPlatformStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidPlatformModel;
};

export const AndroidPlatformFactory = (sequelize: Sequelize): AndroidPlatformStatic => {
    const attributes = {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'id',
        },
        createdBy: {
            type: DataTypes.CHAR(64),
            allowNull: true,
            field: 'createdBy',
        },
        created: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'created',
        },
        updated: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated',
        },
        name: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'name',
        },
        path: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'path',
        },
    };
    const options = {
        tableName: 'Android_Platform',
        timestamps: false,
    };
    return <AndroidPlatformStatic>sequelize.define('AndroidPlatform', attributes, options);
};
