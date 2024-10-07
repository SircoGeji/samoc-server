import { AppError } from '../util/errorHandler';
import Logger from '../util/logger';
import * as AWS from 'aws-sdk';
import { NODE_ENV } from '../util/config';
import { updateSpinnerText } from '../util/utils';

const logger = Logger(module);
const S3_REGION = 'us-east-1';
const timestamp = Date.now();

// Set the region
AWS.config.update({ region: 'REGION' });

const roleToAssume = {
  RoleArn: process.env.STS_ARN_ROLE,
  RoleSessionName: `${timestamp}`,
  DurationSeconds: 900,
};

// Create the STS service object
let sts: AWS.STS;
if (NODE_ENV === 'local') {
  sts = new AWS.STS({
    apiVersion: '2011-06-15',
    region: S3_REGION,
    accessKeyId: process.env.IAM_USER_KEY,
    secretAccessKey: process.env.IAM_USER_SECRET,
    sessionToken: process.env.IAM_USER_SESSION_TOKEN,
  });
} else {
  sts = new AWS.STS({ apiVersion: '2011-06-15', region: S3_REGION });
}

//Assume Role
export const stsAssumeRole = async (): Promise<any> => {
  logger.debug('stsAssumeRole started...');
  updateSpinnerText('Assuming role for AWS00 account actions...');
  return new Promise((resolve, reject) => {
    sts.assumeRole(roleToAssume, (err, data) => {
      if (err) {
        logger.error('cloudfront.createInvalidation Error', err);
        reject(new AppError(`Error occurred in cloudfront.createInvalidation: ${err.code}`, err.statusCode));
      } else {
        logger.debug('cloudfront.createInvalidation Success', { data });
      }
      return resolve(data);
    });
  });
};
