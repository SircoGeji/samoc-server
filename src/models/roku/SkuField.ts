import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuSkuFieldAttributes extends RokuMasterAttributes {
    storeId: number;
    name: string;
    internalName: string;
    type: string;
    translatable: boolean;
    required: boolean;
    charLimit: number;
    order: number;
}

export interface RokuSkuFieldModel extends RokuSkuFieldAttributes, Model { }

type RokuSkuFieldStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuSkuFieldModel;
};

export const RokuSkuFieldFactory = (sequelize: Sequelize): RokuSkuFieldStatic => {
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
        name: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'name',
        },
        internalName: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'internalName',
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
        tableName: 'Roku_SkuField',
        timestamps: false,
    };
    return <RokuSkuFieldStatic>sequelize.define('RokuSkuField', attributes, options);
};
