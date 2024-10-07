import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuProductAttributes extends RokuMasterAttributes {
    name: string;
    path: string;
    imgixBuyflowLandscapeUrl?: string;
    imgixRenewTVLandscapeUrl?: string;
}

export interface RokuProductModel extends RokuProductAttributes, Model { }

type RokuProductStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuProductModel;
};

export const RokuProductFactory = (sequelize: Sequelize): RokuProductStatic => {
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
        imgixBuyflowLandscapeUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixBuyflowLandscapeUrl',
        },
        imgixRenewTVLandscapeUrl: {
            type: DataTypes.CHAR(255),
            allowNull: true,
            field: 'imgixRenewTVLandscapeUrl',
        },
    };
    const options = {
        tableName: 'Roku_Product',
        timestamps: false,
    };
    return <RokuProductStatic>sequelize.define('RokuProduct', attributes, options);
};
