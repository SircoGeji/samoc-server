import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuStoreAttributes extends RokuMasterAttributes {
    name: string;
    path: string;
}

export interface RokuStoreModel extends RokuStoreAttributes, Model { }

type RokuStoreStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuStoreModel;
};

export const RokuStoreFactory = (sequelize: Sequelize): RokuStoreStatic => {
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
        tableName: 'Roku_Store',
        timestamps: false,
    };
    return <RokuStoreStatic>sequelize.define('RokuStore', attributes, options);
};
