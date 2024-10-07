import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidCountryAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    code: string;
    path: string;
}

export interface AndroidCountryModel extends AndroidCountryAttributes, Model { }

type AndroidCountryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidCountryModel;
};

export const AndroidCountryFactory = (sequelize: Sequelize): AndroidCountryStatic => {
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
        code: {
            type: DataTypes.CHAR(2),
            allowNull: false,
            field: 'code',
        },
        path: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'path',
        },
    };
    const options = {
        tableName: 'Android_Country',
        timestamps: false,
    };
    return <AndroidCountryStatic>sequelize.define('AndroidCountry', attributes, options);
};
