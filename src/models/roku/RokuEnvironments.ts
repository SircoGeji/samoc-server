import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { RokuMasterAttributes } from './ExternalInterfaces';

export interface RokuEnvironmentsAttributes extends RokuMasterAttributes {
    code: string;
    name: string;
}

export interface RokuEnvironmentsModel extends RokuEnvironmentsAttributes, Model { }

type RokuEnvironmentsStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): RokuEnvironmentsModel;
};

export const RokuEnvironmentsFactory = (sequelize: Sequelize): RokuEnvironmentsStatic => {
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
        code: {
            type: DataTypes.CHAR(4),
            allowNull: false,
            field: 'code',
        },
        name: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'name',
        },
    };
    const options = {
        tableName: 'Roku_Environments',
        timestamps: false,
    };
    return <RokuEnvironmentsStatic>sequelize.define('RokuEnvironments', attributes, options);
};
