import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuCountry, RokuLanguage } from '..';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuCountryLanguageAttributes extends RokuMasterAttributes {
    countryId: number;
    languageId: number;
    isDefault: boolean;
}

export interface RokuCountryLanguageModel extends RokuCountryLanguageAttributes, Model { }

type RokuCountryLanguageStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuCountryLanguageModel;
};

export const RokuCountryLanguageFactory = (sequelize: Sequelize): RokuCountryLanguageStatic => {
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
        countryId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'countryId',
            references: {
                model: RokuCountry,
                key: 'id'
            }
        },
        languageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'languageId',
            references: {
                model: RokuLanguage,
                key: 'id'
            }
        },
        isDefault: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            field: 'isDefault',
        },
    };
    const options = {
        tableName: 'Roku_CountryLanguage',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: 'LastModifiedAt',
        deletedAt: 'DeletedAt',
    };
    return <RokuCountryLanguageStatic>sequelize.define('RokuCountryLanguage', attributes, options);
};
