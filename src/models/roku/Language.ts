import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuLanguageAttributes extends RokuMasterAttributes {
    name: string;
    code: string;
}

export interface RokuLanguageModel extends RokuLanguageAttributes, Model { }

type RokuLanguageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuLanguageModel;
};

export const RokuLanguageFactory = (sequelize: Sequelize): RokuLanguageStatic => {
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
        tableName: 'Roku_Language',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: 'LastModifiedAt',
        deletedAt: 'DeletedAt',
    };
    return <RokuLanguageStatic>sequelize.define('RokuLanguage', attributes, options);
};
