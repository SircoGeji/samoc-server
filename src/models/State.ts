import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

export interface StateAttributes {
    id: number;
    regionCode: string;
    stateId: string;
    stateName: string;
    stateAbbr: string;
    stateCode: string;
}

export interface StateModel extends StateAttributes, Model { }

type StateStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): StateModel;
};

export const StateFactory = (sequelize: Sequelize): StateStatic => {
    const attributes = {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            field: 'id',
        },
        regionCode: {
            type: DataTypes.CHAR(2),
            allowNull: false,
            field: 'regionCode',
        },
        stateId: {
            type: DataTypes.CHAR(2),
            allowNull: true,
            field: 'stateId',
        },
        stateName: {
            type: DataTypes.CHAR(64),
            allowNull: false,
            field: 'stateName',
        },
        stateAbbr: {
            type: DataTypes.CHAR(8),
            allowNull: true,
            field: 'stateAbbr',
        },
        stateCode: {
            type: DataTypes.CHAR(2),
            allowNull: false,
            field: 'stateCode',
        }
    };
    const options = {
        tableName: 'State',
        timestamps: false,
    };
    return <StateStatic>sequelize.define('State', attributes, options);
};
