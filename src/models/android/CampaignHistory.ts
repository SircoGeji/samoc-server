import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidCampaignHistoryAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    startDate: string;
    endDate: string;
    appCopyId: number;
    selectorConfigId: number;
    imageCollectionIndexes: string;
    winbackSkuId: number;
    storeCopyId: number;
}

export interface AndroidCampaignHistoryModel extends AndroidCampaignHistoryAttributes, Model { }

type AndroidCampaignHistoryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidCampaignHistoryModel;
};

export const AndroidCampaignHistoryFactory = (sequelize: Sequelize): AndroidCampaignHistoryStatic => {
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
    };
    const options = {
        tableName: 'Android_CampaignHistory',
        timestamps: false,
    };
    return <AndroidCampaignHistoryStatic>sequelize.define('AndroidCampaignHistory', attributes, options);
};
