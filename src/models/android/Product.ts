import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidProductAttributes extends AndroidMasterAttributes {
    name: string;
    path: string;
    imgixBuyflowPortraitUrl?: string;
    imgixBuyflowLandscapeUrl?: string;
    imgixRenewMobilePortraitUrl?: string;
    imgixRenewMobileLandscapeUrl?: string;
    imgixRenewTVLandscapeUrl?: string;
}

export interface AndroidProductModel extends AndroidProductAttributes, Model { }

type AndroidProductStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidProductModel;
};

export const AndroidProductFactory = (sequelize: Sequelize): AndroidProductStatic => {
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
        imgixBuyflowPortraitUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixBuyflowPortraitUrl',
        },
        imgixBuyflowLandscapeUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixBuyflowLandscapeUrl',
        },
        imgixRenewMobilePortraitUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixRenewMobilePortraitUrl',
        },
        imgixRenewMobileLandscapeUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixRenewMobileLandscapeUrl',
        },
        imgixRenewTVLandscapeUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixRenewTVLandscapeUrl',
        },
    };
    const options = {
        tableName: 'Android_Product',
        timestamps: false,
    };
    return <AndroidProductStatic>sequelize.define('AndroidProduct', attributes, options);
};
