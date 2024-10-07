import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidCountry, AndroidLanguage } from '..';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidCountryLanguageAttributes extends AndroidMasterAttributes {
    countryId: number;
    languageId: number;
    isDefault: boolean;
}

export interface AndroidCountryLanguageModel extends AndroidCountryLanguageAttributes, Model { }

type AndroidCountryLanguageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidCountryLanguageModel;
};

export const AndroidCountryLanguageFactory = (sequelize: Sequelize): AndroidCountryLanguageStatic => {
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
        countryId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'countryId',
            references: {
                model: AndroidCountry,
                key: 'id'
            }
        },
        languageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'languageId',
            references: {
                model: AndroidLanguage,
                key: 'id'
            }
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            field: 'isDefault',
        }
    };
    const options = {
        tableName: 'Android_CountryLanguage',
        timestamps: false,
    };
    return <AndroidCountryLanguageStatic>sequelize.define('AndroidCountryLanguage', attributes, options);
};
