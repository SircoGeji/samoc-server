import { BuildOptions, DataTypes, Model, Sequelize } from 'sequelize';

interface WorkflowQueueAttributes {
  offerCode: string;
  action: string;
}

export interface WorkflowQueueModel extends WorkflowQueueAttributes, Model {}

type WorkflowQueueStatic = typeof Model & {
  new (
    values?: Record<string, unknown>,
    options?: BuildOptions,
  ): WorkflowQueueModel;
};

export const workflowQueueFactory = (
  sequelize: Sequelize,
): WorkflowQueueStatic => {
  const attributes = {
    offerCode: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      unique: true,
      field: 'OfferCode',
    },
    action: {
      type: DataTypes.STRING(64),
      field: 'Action',
    },
  };
  const options = {
    tableName: 'WorkflowQueue',
    timestamps: true,
  };
  return <WorkflowQueueStatic>(
    sequelize.define('WorkflowQueue', attributes, options)
  );
};
