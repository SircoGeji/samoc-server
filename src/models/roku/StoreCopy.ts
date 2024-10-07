import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuStoreCopyAttributes extends RokuMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    isDefault: boolean;
    deployedTo: string;
    endedOn: string;
    status: string;
}

export interface RokuStoreCopyModel extends RokuStoreCopyAttributes, Model { }

type RokuStoreCopyStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuStoreCopyModel;
};

export const RokuStoreCopyFactory = (sequelize: Sequelize): RokuStoreCopyStatic => {
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
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Roku_StoreCopy',
        timestamps: false,
    };
    return <RokuStoreCopyStatic>sequelize.define('RokuStoreCopy', attributes, options);
};
