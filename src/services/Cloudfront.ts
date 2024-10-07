import { AppError } from '../util/errorHandler';
import Logger from '../util/logger';
import * as AWS from 'aws-sdk';
import { stsAssumeRole } from './STS';
import { NODE_ENV } from '../util/config';

const logger = Logger(module);

const S3_REGION = 'us-east-1';
const ANDROID_S3_DISTRIBUTION_ID = process.env.ANDROID_S3_DISTRIBUTION_ID;

export const generatePath = (platform: string, env: string, product: string) => {
  return `/Buyflow/${platform}/samoc/appImages/samoc-${NODE_ENV}-instance/${env}/${product}/*`;
};

export const invalidateImageCache = async (path: string): Promise<boolean> => {
  logger.debug('invalidateImageCache started...');

  const stsCredentialsResult = await stsAssumeRole();
  const cloudfront = new AWS.CloudFront({
    region: S3_REGION,
    accessKeyId: stsCredentialsResult.Credentials.AccessKeyId,
    secretAccessKey: stsCredentialsResult.Credentials.SecretAccessKey,
    sessionToken: stsCredentialsResult.Credentials.SessionToken,
    maxRetries: 0,
  });
  const timestamp = Date.now();
  const params = {
    DistributionId: ANDROID_S3_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `${timestamp}`,
      Paths: {
        Quantity: 1,
        Items: [path],
      },
    },
  };

  return new Promise((resolve, reject) => {
    cloudfront.createInvalidation(params, (err, data) => {
      if (err) {
        logger.error('cloudfront.createInvalidation Error', data);
        reject(new AppError(`Error occurred in cloudfront.createInvalidation: ${err.code}`, err.statusCode));
      } else {
        logger.debug('cloudfront.createInvalidation Success', { data });
      }
      return resolve(true);
    });
  });
};
