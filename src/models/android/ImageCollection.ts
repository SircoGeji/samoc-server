import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidImageCollectionAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    isDefault: boolean;
    countries: string;
    deployedTo: string;
    endedOn: string;
    status: string;
}

export interface AndroidImageCollectionModel extends AndroidImageCollectionAttributes, Model { }

type AndroidImageCollectionStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidImageCollectionModel;
};

export const AndroidImageCollectionFactory = (sequelize: Sequelize): AndroidImageCollectionStatic => {
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
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'isDefault',
        },
        countries: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'countries',
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
        tableName: 'Android_ImageCollection',
        timestamps: false,
    };
    return <AndroidImageCollectionStatic>sequelize.define('AndroidImageCollection', attributes, options);
};
