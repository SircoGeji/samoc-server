import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuSelectorConfigSkuAttributes extends RokuMasterAttributes {
    selectorConfigId: number;
    skuId: number;
    countryId: number;
    isDefault: boolean;
    defaultInSelector: boolean;
    showInSelector: boolean;
    showInSettings: boolean;
    order: number;
    status: string;
}

export interface RokuSelectorConfigSkuModel extends RokuSelectorConfigSkuAttributes, Model { }

type RokuSelectorConfigSkuStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuSelectorConfigSkuModel;
};

export const RokuSelectorConfigSkuFactory = (sequelize: Sequelize): RokuSelectorConfigSkuStatic => {
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
        selectorConfigId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'selectorConfigId',
        },
        skuId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'skuId',
        },
        countryId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'countryId',
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'isDefault',
        },
        defaultInSelector: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'defaultInSelector',
        },
        showInSelector: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'showInSelector',
        },
        showInSettings: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'showInSettings',
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'order',
        },
        status: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Roku_SelectorConfigSku',
        timestamps: false,
    };
    return <RokuSelectorConfigSkuStatic>sequelize.define('RokuSelectorConfigSku', attributes, options);
};
