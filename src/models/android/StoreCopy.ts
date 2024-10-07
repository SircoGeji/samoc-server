import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidStoreCopyAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    name: string;
    isDefault: boolean;
    deployedTo: string;
    endedOn: string;
    status: string;
}

export interface AndroidStoreCopyModel extends AndroidStoreCopyAttributes, Model { }

type AndroidStoreCopyStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidStoreCopyModel;
};

export const AndroidStoreCopyFactory = (sequelize: Sequelize): AndroidStoreCopyStatic => {
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
        tableName: 'Android_StoreCopy',
        timestamps: false,
    };
    return <AndroidStoreCopyStatic>sequelize.define('AndroidStoreCopy', attributes, options);
};
