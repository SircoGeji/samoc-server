import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface CampaignAttributes {
  id: string;
  name: string;
  data: JSON;
}

export interface CampaignModel extends CampaignAttributes, Model {}

type CampaignStatic = typeof Model & {
  new (values?: Record<string, unknown>, options?: BuildOptions): CampaignModel;
};

export const campaignFactory = (sequelize: Sequelize): CampaignStatic => {
  const attributes = {
    id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      primaryKey: true,
      autoIncrement: false,
      field: 'Id',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Name',
    },
    data: {
      type: DataTypes.JSON,
      field: 'Data',
    },
  };
  const options = {
    tableName: 'Campaign',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'LastModifiedAt',
    deletedAt: 'DeletedAt',
  };
  return <CampaignStatic>sequelize.define('Campaign', attributes, options);
};
