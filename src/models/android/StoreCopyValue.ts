import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidStoreCopyValueAttributes extends AndroidMasterAttributes {
    storeCopyId: number;
    languageId: number;
    storeCopyFieldId: number;
    value: string;
    status: string;
}

export interface AndroidStoreCopyValueModel extends AndroidStoreCopyValueAttributes, Model { }

type AndroidStoreCopyValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidStoreCopyValueModel;
};

export const AndroidStoreCopyValueFactory = (sequelize: Sequelize): AndroidStoreCopyValueStatic => {
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
        storeCopyId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'storeCopyId',
        },
        languageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'languageId',
        },
        storeCopyFieldId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'storeCopyFieldId',
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'value',
        },
        status: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Android_StoreCopyValue',
        timestamps: false,
    };
    return <AndroidStoreCopyValueStatic>sequelize.define('AndroidStoreCopyValue', attributes, options);
};
