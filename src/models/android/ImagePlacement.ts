import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';
import { AndroidMasterAttributes } from './ExternalInterfaces';

export interface AndroidImagePlacementAttributes extends AndroidMasterAttributes {
    storeId: number;
    name: string;
    reqMaxSize: string;
    reqType: string;
    reqDimen: string;
    required: boolean;
    order: number;
}

export interface AndroidImagePlacementModel extends AndroidImagePlacementAttributes, Model { }

type AndroidImagePlacementStatic = typeof Model & {
    new(values?: Record<string, unknown>, options?: BuildOptions): AndroidImagePlacementModel;
};

export const AndroidImagePlacementFactory = (sequelize: Sequelize): AndroidImagePlacementStatic => {
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
        reqMaxSize: {
            type: DataTypes.CHAR(16),
            allowNull: false,
            field: 'reqMaxSize',
        },
        reqType: {
            type: DataTypes.CHAR(8),
            allowNull: false,
            field: 'reqType',
        },
        reqDimen: {
            type: DataTypes.CHAR(16),
            allowNull: false,
            field: 'reqDimen',
        },
        required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'required',
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'order',
        },
    };
    const options = {
        tableName: 'Android_ImagePlacement',
        timestamps: false,
    };
    return <AndroidImagePlacementStatic>sequelize.define('AndroidImagePlacement', attributes, options);
};
