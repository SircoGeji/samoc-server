import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidSkuValueAttributes extends AndroidMasterAttributes {
    skuId: number;
    countryLanguageId: number;
    skuFieldId: number;
    value: string;
    status?: string;
}

export interface AndroidSkuValueModel extends AndroidSkuValueAttributes, Model { }

type AndroidSkuValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidSkuValueModel;
};

export const AndroidSkuValueFactory = (sequelize: Sequelize): AndroidSkuValueStatic => {
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
        skuId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'skuId',
        },
        countryLanguageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'countryLanguageId',
        },
        skuFieldId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'skuFieldId',
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
        tableName: 'Android_SkuValue',
        timestamps: false,
    };
    return <AndroidSkuValueStatic>sequelize.define('AndroidSkuValue', attributes, options);
};
