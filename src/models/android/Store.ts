import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidStoreAttributes extends AndroidMasterAttributes {
    name: string;
    path: string;
}

export interface AndroidStoreModel extends AndroidStoreAttributes, Model { }

type AndroidStoreStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidStoreModel;
};

export const AndroidStoreFactory = (sequelize: Sequelize): AndroidStoreStatic => {
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
    };
    const options = {
        tableName: 'Android_Store',
        timestamps: false,
    };
    return <AndroidStoreStatic>sequelize.define('AndroidStore', attributes, options);
};
