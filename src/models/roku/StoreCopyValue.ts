import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuStoreCopyValueAttributes extends RokuMasterAttributes {
    storeCopyId: number;
    languageId: number;
    storeCopyFieldId: number;
    value: string;
    status: string;
}

export interface RokuStoreCopyValueModel extends RokuStoreCopyValueAttributes, Model { }

type RokuStoreCopyValueStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuStoreCopyValueModel;
};

export const RokuStoreCopyValueFactory = (sequelize: Sequelize): RokuStoreCopyValueStatic => {
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
        storeCopyId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'storeCopyId',
        },
        languageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'languageId',
        },
        storeCopyFieldId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'storeCopyFieldId',
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'value',
        },
        status: {
            type: DataTypes.CHAR(32),
            allowNull: false,
            field: 'status',
        },
    };
    const options = {
        tableName: 'Roku_StoreCopyValue',
        timestamps: false,
    };
    return <RokuStoreCopyValueStatic>sequelize.define('RokuStoreCopyValue', attributes, options);
};
