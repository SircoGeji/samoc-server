import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuImageGalleryAttributes extends RokuMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    size: number;
    type: string;
    dimensions: string;
    path: number;
}

export interface RokuImageGalleryModel extends RokuImageGalleryAttributes, Model { }

type RokuImageGalleryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuImageGalleryModel;
};

export const RokuImageGalleryFactory = (sequelize: Sequelize): RokuImageGalleryStatic => {
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
        size: {
            type: DataTypes.FLOAT,
            allowNull: false,
            field: 'size',
        },
        type: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'type',
        },
        dimensions: {
            type: DataTypes.CHAR(16),
            allowNull: false,
            field: 'dimensions',
        },
        path: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'path',
        },
    };
    const options = {
        tableName: 'Roku_ImageGallery',
        timestamps: false,
    };
    return <RokuImageGalleryStatic>sequelize.define('RokuImageGallery', attributes, options);
};
