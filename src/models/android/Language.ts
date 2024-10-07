import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidLanguageAttributes extends AndroidMasterAttributes {
    name: string;
    code: string;
}

export interface AndroidLanguageModel extends AndroidLanguageAttributes, Model { }

type AndroidLanguageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidLanguageModel;
};

export const AndroidLanguageFactory = (sequelize: Sequelize): AndroidLanguageStatic => {
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
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'name',
        },
        code: {
            type: DataTypes.CHAR(8),
            allowNull: false,
            field: 'code',
        },
    };
    const options = {
        tableName: 'Android_Language',
        timestamps: false,
    };
    return <AndroidLanguageStatic>sequelize.define('AndroidLanguage', attributes, options);
};
