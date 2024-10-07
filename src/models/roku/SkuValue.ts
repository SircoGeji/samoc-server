import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuSkuValueAttributes extends RokuMasterAttributes {
    skuId: number;
    countryLanguageId: number;
    skuFieldId: number;
    value: string;
    status?: string;
}

export interface RokuSkuValueModel extends RokuSkuValueAttributes, Model { }

type RokuSkuValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuSkuValueModel;
};

export const RokuSkuValueFactory = (sequelize: Sequelize): RokuSkuValueStatic => {
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
        tableName: 'Roku_SkuValue',
        timestamps: false,
    };
    return <RokuSkuValueStatic>sequelize.define('RokuSkuValue', attributes, options);
};
