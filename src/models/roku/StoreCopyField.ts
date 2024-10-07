import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuStoreCopyFieldAttributes extends RokuMasterAttributes {
    storeId: number;
    name: string;
    type: string;
    required: boolean;
    charLimit: number;
    order: number;
}

export interface RokuStoreCopyFieldModel extends RokuStoreCopyFieldAttributes, Model { }

type RokuStoreCopyFieldStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuStoreCopyFieldModel;
};

export const RokuStoreCopyFieldFactory = (sequelize: Sequelize): RokuStoreCopyFieldStatic => {
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
        type: {
            type: DataTypes.CHAR(16),
            allowNull: false,
            field: 'type',
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
        tableName: 'Roku_StoreCopyField',
        timestamps: false,
    };
    return <RokuStoreCopyFieldStatic>sequelize.define('RokuStoreCopyField', attributes, options);
};
