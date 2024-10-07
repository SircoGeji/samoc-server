import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuImageCollectionImageAttributes extends RokuMasterAttributes {
    imageCollectionId: number;
    imagePlacementId: number;
    imageId: number;
}

export interface RokuImageCollectionImageModel extends RokuImageCollectionImageAttributes, Model { }

type RokuImageCollectionImageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuImageCollectionImageModel;
};

export const RokuImageCollectionImageFactory = (sequelize: Sequelize): RokuImageCollectionImageStatic => {
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
        tableName: 'Roku_ImageCollectionImage',
        timestamps: false,
    };
    return <RokuImageCollectionImageStatic>sequelize.define('RokuImageCollectionImage', attributes, options);
};
