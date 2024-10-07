import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidAppCopyAttributes extends AndroidMasterAttributes {
    storeId: number;
    productId: number;
    envId: number;
    promotionId: number;
    hasChanges: boolean;
    name: string;
    isDefault: boolean;
    isPublished: boolean;
    isActive: boolean;
    status: string;
    promotedAt: Date;
    needToPromote: boolean;
}

export interface AndroidAppCopyModel extends AndroidAppCopyAttributes, Model { }

type AndroidAppCopyStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidAppCopyModel;
};

export const AndroidAppCopyFactory = (sequelize: Sequelize): AndroidAppCopyStatic => {
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
        promotedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'promotedAt',
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
        envId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'envId',
        },
        promotionId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'promotionId',
        },
        stagedId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'stagedId',
          },
        hasChanges: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'hasChanges',
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
        isPublished: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'isPublished',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'isActive',
        },
        status: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'status',
        },
        needToPromote: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'needToPromote',
        },
    };
    const options = {
        tableName: 'Android_AppCopy',
        timestamps: false,
    };
    return <AndroidAppCopyStatic>sequelize.define('AndroidAppCopy', attributes, options);
};
