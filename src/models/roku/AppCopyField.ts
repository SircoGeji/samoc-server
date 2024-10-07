import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuAppCopyFieldAttributes extends RokuMasterAttributes {
    storeId: number;
    platformId: number;
    name: string;
    type: string;
    translatable: boolean;
    previewImageGroup: string;
    required: boolean;
    charLimit: number;
    order: number;
}

export interface RokuAppCopyFieldModel extends RokuAppCopyFieldAttributes, Model { }

type RokuAppCopyFieldStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuAppCopyFieldModel;
};

export const RokuAppCopyFieldFactory = (sequelize: Sequelize): RokuAppCopyFieldStatic => {
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
        platformId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'platformId',
        },
        name: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'name',
        },
        type: {
            type: DataTypes.CHAR(16),
            allowNull: false,
            field: 'type',
        },
        translatable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'translatable',
        },
        previewImageGroup: {
            type: DataTypes.CHAR(32),
            allowNull: true,
            field: 'previewImageGroup',
        },
        required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'required',
        },
        charLimit: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'charLimit',
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'order',
        },
    };
    const options = {
        tableName: 'Roku_AppCopyField',
        timestamps: false,
    };
    return <RokuAppCopyFieldStatic>sequelize.define('RokuAppCopyField', attributes, options);
};
