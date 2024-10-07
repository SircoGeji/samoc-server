import * as AWS from '@aws-sdk/client-secrets-manager';
import { AppError } from '../util/errorHandler';
import Logger from '../util/logger';

const S3_REGION = 'us-west-2';
const NODE_ENV = process.env.NODE_ENV as string;
const ENV = NODE_ENV === 'local' ? 'dev' : NODE_ENV;
const SECRET_NAME: string = `${ENV}/samoc-server/cancel-flow`;

const logger = Logger(module);
const S3_API_VERSION = '2006-03-01';
const AWS_ACCESS_KEY_ID = '';
const AWS_SECRET_ACCESS_KEY = '';
const AWS_SESSION_TOKEN ='';
let config: any;

if (NODE_ENV === 'local') {
  config = {
    apiVersion: S3_API_VERSION,
    region: S3_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN,
    },
  };
} else {
  config = { apiVersion: S3_API_VERSION, region: S3_REGION };
}

export const getSecret = async () => {
  logger.debug('SecretManager.getSecret started...');
  try {
    const client = new AWS.SecretsManagerClient(config);
    const command = new AWS.GetSecretValueCommand({ SecretId: SECRET_NAME });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error(`Secret string is empty. SecretId="${SECRET_NAME}".`);
    }
    logger.debug(
      'SecretManager.getSecret Success',
      JSON.parse(response.SecretString),
    );
    return JSON.parse(response.SecretString);
  } catch (err) {
    logger.error('SecretManager.getSecret Error', err);
    throw new AppError(
      `Error occurred in SecretManager.getSecret: ${err.code}`,
      err.statusCode,
      [err.name, err.message],
    );
  }
};
