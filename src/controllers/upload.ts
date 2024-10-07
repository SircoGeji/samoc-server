import { Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import asyncHandler from 'express-async-handler';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';
import { Readable } from 'stream';
import { AppError } from '../util/errorHandler';
import { imageSize } from 'image-size';
import { NODE_ENV } from '../util/config';
import { updateSpinnerText } from '../util/utils';
import { DEFAULT_SPINNER_TEXT } from '../util/constants';

const logger = Logger(module);

const S3_API_VERSION = '2006-03-01';
const S3_REGION = 'us-west-2';
const BUCKET_NAME = process.env.BUCKET_NAME;
const CLOUDFRONT_DNS = process.env.CLOUDFRONT_DNS;
const IAM_USER_KEY = process.env.IAM_USER_KEY;
const IAM_USER_SECRET = process.env.IAM_USER_SECRET;
const IAM_USER_SESSION_TOKEN = process.env.IAM_USER_SESSION_TOKEN;
const SUPPORTED_DIMENSIONS = ['2560x1440', '1920x1080'];

const FILE_EXT_REGEXP = /.*\.(jpg|jpeg|png)/gi;

let s3: S3;

if (NODE_ENV === 'local') {
  // if (NODE_ENV === 'local' || NODE_ENV === 'dev') {
  s3 = new AWS.S3({
    apiVersion: S3_API_VERSION,
    region: S3_REGION,
    accessKeyId: IAM_USER_KEY,
    secretAccessKey: IAM_USER_SECRET,
    sessionToken: IAM_USER_SESSION_TOKEN,
  });
} else {
  s3 = new AWS.S3({ apiVersion: S3_API_VERSION, region: S3_REGION });
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Upload Controller - listBuckets');
  const data = await listBuckets();

  retWithSuccess(req, res, {
    message: 'Buckets retrieved successfully',
    data,
  });
});

/**
 * POST /api/uploadImage
 * Create a new image in s3
 * @param {Request}     req
 * @param {Response}    res
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Upload Controller - uploadImage');
  const file = req.file;
  const socketId = req.header('Socket-Id');
  updateSpinnerText(DEFAULT_SPINNER_TEXT);

  const fileName = file.originalname;
  const found = fileName.match(FILE_EXT_REGEXP);

  if (
    !found ||
    found.length === 0 ||
    (file && file.mimetype && file.mimetype.indexOf('image') < 0)
  ) {
    throw new AppError(
      'Unsupported file type, only image files are supported.',
      400,
    );
  }
  const fileDimensions = imageSize(file.buffer);
  const dimension = `${fileDimensions.width}x${fileDimensions.height}`;
  if (!SUPPORTED_DIMENSIONS.includes(dimension)) {
    throw new AppError(
      `Invalid image dimension, only ${SUPPORTED_DIMENSIONS} are allowed.`,
      400,
    );
  }

  updateSpinnerText('Uploading background image...');
  // ensure bucket exists
  const existBucketResult: boolean = await existBucket(BUCKET_NAME);
  logger.debug('existBucketResult: ', { existBucketResult });

  // create if not
  let createBucketResult: boolean;
  if (!existBucketResult) {
    createBucketResult = await createBucket(BUCKET_NAME);
    logger.debug('createBucketResult: ', { createBucketResult });
  }

  // continue
  if (existBucketResult || createBucketResult) {
    // upload image
    const key = generateKey(file);
    logger.debug('key: ', { key });

    let signedUrl = await getSignedUrl(key);
    let message = 'Image already exists on S3';

    if (!signedUrl) {
      // upload
      const response = await uploadToS3(key, file);
      signedUrl = response.Location;
      message = 'Image Uploaded Successfully';
    }

    if (NODE_ENV != 'local') {
      signedUrl = convertToCFUrl(signedUrl);
    }
    logger.debug('signedUrl: ', { signedUrl });

    retWithSuccess(req, res, {
      message,
      data: {
        url: signedUrl,
      },
    });
  }
});

const generateKey = (file: any) => {
  return `SAMOC/Offers/Images/${file.originalname}`;
};

const convertToCFUrl = (signedUrl: any) => {
  return signedUrl.replace(
    /(http[s]?:\/\/)([^/?#]*)?(.*)/i,
    `$1${CLOUDFRONT_DNS}$3`,
  );
};

const uploadToS3 = (key: string, file: any): Promise<any> => {
  logger.debug('uploadToS3 started...');
  const readStream = Readable.from(file.buffer);

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: readStream,
    ContentType: file.mimetype,
  } as any;

  if (NODE_ENV === 'local') {
    params.ACL = 'public-read';
  }

  return new Promise((resolve, reject) => {
    s3.upload(params, function (err: any, data: any) {
      readStream.destroy();
      if (err) {
        logger.error(`Image failed to upload to S3, ${err.message}`, err);
        reject(
          new AppError(
            `Image failed to upload to S3, ${err.code}`,
            err.statusCode,
          ),
        );
      }
      return resolve(data);
    });
  });
};

const getSignedUrl = async (key: string): Promise<any> => {
  logger.debug('getSignedUrl started...');
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const headCode = await s3.headObject(params).promise();
    const signedUrl = await s3.getSignedUrl('getObject', params);
    return signedUrl.substr(0, signedUrl.lastIndexOf('?'));
  } catch (headErr) {
    if (headErr.code === 'NotFound') {
      return '';
    }
  }
};

const listBuckets = (): Promise<any> => {
  logger.debug('listBuckets started...');
  // Call S3 to list the buckets
  return new Promise((resolve, reject) => {
    s3.listBuckets(function (err, data) {
      if (err) {
        logger.error('s3.listBuckets Error', err);
        reject(
          new AppError(
            `Error occurred in s3.listBuckets: ${err.code}`,
            err.statusCode,
          ),
        );
      } else {
        logger.debug(`s3.listBuckets Success`, { data });
      }
      return resolve(data);
    });
  });
};

const createBucket = (name: string): Promise<boolean> => {
  logger.debug('createBucket started...');
  const params = {
    Bucket: name,
    ACL: 'public-read',
  };
  return new Promise((resolve, reject) => {
    s3.createBucket(params, function (err, data) {
      if (err) {
        logger.error('s3.createBucket Error', err);
        reject(
          new AppError(
            `Error occurred in s3.createBucket: ${err.code}`,
            err.statusCode,
          ),
        );
      } else {
        logger.debug('s3.createBucket Success', { data });
      }
      return resolve(true);
    });
  });
};

const existBucket = async (name: string): Promise<boolean> => {
  logger.debug('existBucket started...');
  const params = {
    Bucket: name,
  };

  return new Promise((resolve, reject) => {
    s3.headBucket(params, function (err, data) {
      if (err) {
        logger.error('s3.headBucket Error', err);
        reject(
          new AppError(
            `Error occurred in s3.headBucket: ${err.code}`,
            err.statusCode,
          ),
        );
      } else {
        logger.debug('s3.headBucket Success', { data });
      }
      return resolve(true);
    });
  });
};
