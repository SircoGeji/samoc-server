import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidAppCopyValueAttributes extends AndroidMasterAttributes {
    appCopyId: number;
    platformId: number;
    countryLanguageId: number;
    appCopyFieldId: number;
    value: string;
    status?: string;
}

export interface AndroidAppCopyValueModel extends AndroidAppCopyValueAttributes, Model { }

type AndroidAppCopyValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidAppCopyValueModel;
};

export const AndroidAppCopyValueFactory = (sequelize: Sequelize): AndroidAppCopyValueStatic => {
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
        appCopyId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'appCopyId',
        },
        platformId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'platformId',
        },
        countryLanguageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'countryLanguageId',
        },
        appCopyFieldId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'appCopyFieldId',
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'value',
        },
        status: {
            type: DataTypes.CHAR(32),
            allowNull: true,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Android_AppCopyValue',
        timestamps: false,
    };
    return <AndroidAppCopyValueStatic>sequelize.define('AndroidAppCopyValue', attributes, options);
};
