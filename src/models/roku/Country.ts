import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuCountryAttributes extends RokuMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    code: string;
    path: string;
}

export interface RokuCountryModel extends RokuCountryAttributes, Model { }

type RokuCountryStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuCountryModel;
};

export const RokuCountryFactory = (sequelize: Sequelize): RokuCountryStatic => {
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
        tableName: 'Roku_Country',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: 'LastModifiedAt',
        deletedAt: 'DeletedAt',
    };
    return <RokuCountryStatic>sequelize.define('RokuCountry', attributes, options);
};
