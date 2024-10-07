import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuAppCopyValueAttributes extends RokuMasterAttributes {
    appCopyId: number;
    platformId: number;
    countryLanguageId: number;
    appCopyFieldId: number;
    value: string;
    status?: string;
}

export interface RokuAppCopyValueModel extends RokuAppCopyValueAttributes, Model { }

type RokuAppCopyValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuAppCopyValueModel;
};

export const RokuAppCopyValueFactory = (sequelize: Sequelize): RokuAppCopyValueStatic => {
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
        tableName: 'Roku_AppCopyValue',
        timestamps: false,
    };
    return <RokuAppCopyValueStatic>sequelize.define('RokuAppCopyValue', attributes, options);
};
