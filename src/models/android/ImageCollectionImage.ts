import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidImageCollectionImageAttributes extends AndroidMasterAttributes {
    imageCollectionId: number;
    imagePlacementId: number;
    imageId: number;
}

export interface AndroidImageCollectionImageModel extends AndroidImageCollectionImageAttributes, Model { }

type AndroidImageCollectionImageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidImageCollectionImageModel;
};

export const AndroidImageCollectionImageFactory = (sequelize: Sequelize): AndroidImageCollectionImageStatic => {
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
        imageCollectionId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'imageCollectionId',
        },
        imagePlacementId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'imagePlacementId',
        },
        imageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'imageId',
        }
    };
    const options = {
        tableName: 'Android_ImageCollectionImage',
        timestamps: false,
    };
    return <AndroidImageCollectionImageStatic>sequelize.define('AndroidImageCollectionImage', attributes, options);
};
