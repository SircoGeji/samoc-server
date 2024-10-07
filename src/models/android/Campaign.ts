import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidCampaignAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    startDate: string;
    endDate: string;
    appCopyId: number;
    selectorConfigId?: number;
    imageCollectionIndexes?: string;
    winbackSkuId?: number;
    storeCopyId?: number;
    isDefault: boolean;
    deployedTo: string;
    endedOn: string;
    status: string;
}

export interface AndroidCampaignModel extends AndroidCampaignAttributes, Model { }

type AndroidCampaignStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidCampaignModel;
};

export const AndroidCampaignFactory = (sequelize: Sequelize): AndroidCampaignStatic => {
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
        storeId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'storeId',
        },
        productId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'productId',
        },
        name: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'name',
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'startDate',
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'endDate',
        },
        appCopyId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'appCopyId',
        },
        selectorConfigId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'selectorConfigId',
        },
        imageCollectionIndexes: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'imageCollectionIndexes',
        },
        winbackSkuId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'winbackSkuId',
        },
        storeCopyId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'storeCopyId',
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'isDefault',
        },
        deployedTo: {
            type: DataTypes.CHAR(32),
            allowNull: true,
            field: 'deployedTo',
        },
        endedOn: {
            type: DataTypes.CHAR(32),
            allowNull: true,
            field: 'endedOn',
        },
        status: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Android_Campaign',
        timestamps: false,
    };
    return <AndroidCampaignStatic>sequelize.define('AndroidCampaign', attributes, options);
};
