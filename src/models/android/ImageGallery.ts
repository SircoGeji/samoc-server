import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidImageGalleryAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    size: number;
    type: string;
    dimensions: string;
    path: number;
}

export interface AndroidImageGalleryModel extends AndroidImageGalleryAttributes, Model { }

type AndroidImageGalleryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidImageGalleryModel;
};

export const AndroidImageGalleryFactory = (sequelize: Sequelize): AndroidImageGalleryStatic => {
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
        tableName: 'Android_ImageGallery',
        timestamps: false,
    };
    return <AndroidImageGalleryStatic>sequelize.define('AndroidImageGallery', attributes, options);
};
