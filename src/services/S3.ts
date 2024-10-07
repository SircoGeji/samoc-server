import asyncHandler from 'express-async-handler';
import { AppError } from '../util/errorHandler';
import { Request, Response } from 'express';
import { retWithSuccess } from '../models/SamocResponse';
import Logger from '../util/logger';
import * as AWS from 'aws-sdk';
import { S3 } from 'aws-sdk';
import { NODE_ENV } from '../util/config';
import { Readable } from 'stream';
import { updateSpinnerText } from '../util/utils';
import { DEFAULT_SPINNER_TEXT } from '../util/constants';
import { AndroidProduct, AndroidStore, RokuProduct, RokuStore } from '../models';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { imageSize } from 'image-size';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { PlatformEnum } from '../types/enum';

const logger = Logger(module);
const S3_API_VERSION = '2006-03-01';
const S3_REGION = 'us-east-1';
const BUCKET_NAME = process.env.ANDROID_BUCKET_NAME;
const CLOUDFRONT_DNS = process.env.ANDROID_CLOUDFRONT_DNS;
const S3_ACCESS_KEY = process.env.ANDROID_S3_ACCESS_KEY;
const S3_ACCESS_SECRET_KEY = process.env.ANDROID_S3_ACCESS_SECRET_KEY;
const S3_SESSION_TOKEN = process.env.ANDROID_S3_SESSION_TOKEN;
const FILE_EXT_REGEXP = /.*\.(jpg|jpeg)/gi;
let s3: S3;

if (NODE_ENV === 'local') {
  s3 = new AWS.S3({
    apiVersion: S3_API_VERSION,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_ACCESS_SECRET_KEY,
    sessionToken: S3_SESSION_TOKEN,
  });
} else {
  s3 = new AWS.S3({ apiVersion: S3_API_VERSION, region: S3_REGION });
}

/**
 * POST /api/android/uploadImage
 * Create a new image for SAMOC app in S3
 * @param {Request}     req
 * @param {Response}    res
 */
export const uploadAndroidImage = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('S3 service Controller - uploadAndroidImage');
  updateSpinnerText(DEFAULT_SPINNER_TEXT);
  const { directory } = req.params;
  if (!directory || (directory !== 'appImages' && directory !== 'gallery')) {
    throw new AppError('Proper bucket directory is required for the request', 400);
  }
  const storeModel: AndroidStoreModel = await AndroidStore.findOne({
    where: { path: req.query.store },
  });
  const productModel: AndroidProductModel = await AndroidProduct.findOne({
    where: { path: req.query.product },
  });
  const files = req.files as any[];
  const fetchedDimensions = req.query.dimensions;
  const fetchedMaxSize = !!req.query.maxSize ? Number(req.query.maxSize) : null;
  const fetchedMaxSizeStr = !!req.query.maxSizeStr ? req.query.maxSizeStr : null;

  if (!!fetchedDimensions && !!fetchedMaxSize && !!fetchedMaxSizeStr) {
    updateSpinnerText('Checking images dimensions...');
    for (let file of files) {
      const fileDimensions = imageSize(file.buffer);
      const dimensions = `${fileDimensions.width}x${fileDimensions.height}`;
      if (fetchedDimensions !== dimensions) {
        throw new AppError(`Invalid image dimensions, only ${fetchedDimensions} is allowed.`, 400);
      }
      if (file.size > fetchedMaxSize) {
        throw new AppError(
          `Invalid image size, only ${fetchedMaxSizeStr} or less is allowed.`,
          400,
        );
      }
    }
  }

  updateSpinnerText('Uploading gallery image...');
  // ensure bucket exists
  const existBucketResult: boolean = await existBucket(BUCKET_NAME as string);
  logger.debug('existBucketResult: ', { existBucketResult });

  // return 404 Error if bucket is not found
  if (!existBucketResult) {
    throw new AppError(`S3 bucket ${BUCKET_NAME} not found.`, 404);
  } else {
    let data: any[] = [];
    const imageNames = JSON.parse(req.query.imageNames as string);
    for (let [i, file] of files.entries()) {
      const fileName = `${imageNames[i]}.${file.mimetype.replace('image/', '')}`;
      const found = fileName.match(FILE_EXT_REGEXP);

      if (!found || found.length === 0 || (file && file.mimetype && file.mimetype.indexOf('image') < 0)) {
        throw new AppError('Unsupported file type, only JPG and JPEG files extensions are supported.', 400);
      }
      // upload image
      const key = generateKey(PlatformEnum.ANDROID, directory, null, storeModel.path, productModel.path, fileName);
      logger.debug('key: ', { key });

      let signedUrl = await getSignedUrl(key);

      if (!signedUrl) {
        // upload
        const response = await uploadToS3(key, file);
        signedUrl = response.Location;
      }

      signedUrl = convertToCFUrl(signedUrl);
      signedUrl = signedUrl.replace(`${BUCKET_NAME}/`, '');
      logger.debug('signedUrl: ', { signedUrl });

      const fileDimensions = imageSize(file.buffer);
      const dimensions = `${fileDimensions.width}x${fileDimensions.height}`;
      data.push({
        url: signedUrl,
        dimensions,
      });
    }

    retWithSuccess(req, res, {
      message: 'Images Uploaded Successfully',
      data,
    });
  }
});

/**
 * POST /api/roku/uploadImage
 * Create a new image for SAMOC app in S3
 * @param {Request}     req
 * @param {Response}    res
 */
export const uploadRokuImage = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('S3 service Controller - uploadRokuImage');
  updateSpinnerText(DEFAULT_SPINNER_TEXT);
  const { directory } = req.params;
  if (!directory || (directory !== 'appImages' && directory !== 'gallery')) {
    throw new AppError('Proper bucket directory is required for the request', 400);
  }
  const storeModel: RokuStoreModel = await RokuStore.findOne({
    where: { path: req.query.store },
  });
  const productModel: RokuProductModel = await RokuProduct.findOne({
    where: { path: req.query.product },
  });
  const files = req.files as any[];
  const fetchedDimensions = req.query.dimensions;
  const fetchedMaxSize = !!req.query.maxSize ? Number(req.query.maxSize) : null;
  const fetchedMaxSizeStr = !!req.query.maxSizeStr ? req.query.maxSizeStr : null;

  if (!!fetchedDimensions && !!fetchedMaxSize && !!fetchedMaxSizeStr) {
    updateSpinnerText('Checking images dimensions...');
    for (let file of files) {
      const fileDimensions = imageSize(file.buffer);
      const dimensions = `${fileDimensions.width}x${fileDimensions.height}`;
      if (fetchedDimensions !== dimensions) {
        throw new AppError(`Invalid image dimensions, only ${fetchedDimensions} is allowed.`, 400);
      }
      if (file.size > fetchedMaxSize) {
        throw new AppError(
          `Invalid image size, only ${fetchedMaxSizeStr} or less is allowed.`,
          400,
        );
      }
    }
  }

  updateSpinnerText('Uploading gallery image...');
  // ensure bucket exists
  const existBucketResult: boolean = await existBucket(BUCKET_NAME as string);
  logger.debug('existBucketResult: ', { existBucketResult });

  // return 404 Error if bucket is not found
  if (!existBucketResult) {
    throw new AppError(`S3 bucket ${BUCKET_NAME} not found.`, 404);
  } else {
    let data: any[] = [];
    const imageNames = JSON.parse(req.query.imageNames as string);
    for (let [i, file] of files.entries()) {
      const fileName = `${imageNames[i]}.${file.mimetype.replace('image/', '')}`;
      const found = fileName.match(FILE_EXT_REGEXP);

      if (!found || found.length === 0 || (file && file.mimetype && file.mimetype.indexOf('image') < 0)) {
        throw new AppError('Unsupported file type, only JPG and JPEG files extensions are supported.', 400);
      }
      // upload image
      const key = generateKey(PlatformEnum.ROKU, directory, null, storeModel.path, productModel.path, fileName);
      logger.debug('key: ', { key });

      let signedUrl = await getSignedUrl(key);

      if (!signedUrl) {
        // upload
        const response = await uploadToS3(key, file);
        signedUrl = response.Location;
      }

      signedUrl = convertToCFUrl(signedUrl);
      signedUrl = signedUrl.replace(`${BUCKET_NAME}/`, '');
      logger.debug('signedUrl: ', { signedUrl });

      const fileDimensions = imageSize(file.buffer);
      const dimensions = `${fileDimensions.width}x${fileDimensions.height}`;
      data.push({
        url: signedUrl,
        dimensions,
      });
    }

    retWithSuccess(req, res, {
      message: 'Images Uploaded Successfully',
      data,
    });
  }
});

const existBucket = async (name: string): Promise<boolean> => {
  logger.debug('S3 service Controller - existBucket');
  updateSpinnerText('Checking existence of S3 bucket...');
  const params = { Bucket: name };

  return new Promise((resolve, reject) => {
    s3.headBucket(params, (err, data) => {
      if (err) {
        logger.error('s3.headBucket Error', err);
        reject(new AppError(`Error occurred in s3.headBucket: ${err.code}`, err.statusCode));
      } else {
        logger.debug('s3.headBucket Success', { data });
      }
      return resolve(true);
    });
  });
};

export const generateKey = (platform: string, directory: string, env: string, store: string, product: string, fileName: string) => {
  switch (directory) {
    case 'gallery':
      return `Buyflow/${platform}/SAMOC/${directory}/SAMOC-${NODE_ENV}-instance/${store}/${product}/${fileName}`;
    case 'appImages':
      return `Buyflow/${platform}/SAMOC/${directory}/SAMOC-${NODE_ENV}-instance/${env}/${product}/${fileName}`;
  }
};

const getSignedUrl = async (key: string): Promise<any> => {
  logger.debug('S3 service Controller - getSignedUrl');
  updateSpinnerText('Getting signed URL of image...');

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const headCode = await s3.headObject(params as any).promise();
    const signedUrl = await s3.getSignedUrl('getObject', params);
    return signedUrl.substr(0, signedUrl.lastIndexOf('?'));
  } catch (headErr) {
    if (headErr.code === 'NotFound') {
      return '';
    }
  }
};

const uploadToS3 = (key: string, file: any): Promise<any> => {
  logger.debug('S3 service Controller - uploadToS3');
  updateSpinnerText('Uploading image to S3 bucket...');
  const readStream = Readable.from(file.buffer);

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: readStream,
    ContentType: file.mimetype,
    ACL: 'bucket-owner-full-control',
  } as any;

  return new Promise((resolve, reject) => {
    s3.upload(params, (err: any, data: any) => {
      readStream.destroy();
      if (err) {
        logger.error(`Image failed to upload to S3, ${err.message}`, err);
        reject(new AppError(`Image failed to upload to S3, ${err.code}`, err.statusCode));
      }
      return resolve(data);
    });
  });
};

export const copyObjectToS3 = (
  platform: string,
  env: string,
  product: string,
  name: string,
  sourceKey: string,
  index: number,
): Promise<any> => {
  logger.debug(`S3 service Controller - copyObjectToS3 | ${name} | ${index}`);

  const key = generateKey(platform, 'appImages', env, null, product, name);
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    CopySource: `/${BUCKET_NAME}/${sourceKey}`,
    ACL: 'bucket-owner-full-control',
  } as any;

  return new Promise((resolve, reject) => {
    s3.copyObject(params, (err: any, data: any) => {
      if (err) {
        logger.error(`Image failed to copy to appImages directory, ${err.message}`, err);
        reject(new AppError(`Image failed to copy to appImages directory, ${err.code}`, err.statusCode));
      }
      return resolve(data);
    });
  });
};

export const deleteObject = (
  platform: string,
  directory: string,
  env: string,
  store: string,
  product: string,
  name: string,
): Promise<any> => {
  logger.debug('deleteObject started...');
  updateSpinnerText('S3 service Controller - deleteObject');

  const key = generateKey(platform, directory, env, store, product, name);
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  } as any;

  return new Promise((resolve, reject) => {
    s3.deleteObject(params, (err: any, data: any) => {
      if (err) {
        logger.error(`Image delete failed, ${err.message}`, err);
        reject(new AppError(`Image delete failed, ${err.code}`, err.statusCode));
      }
      return resolve(data);
    });
  });
};

const convertToCFUrl = (signedUrl: any) => {
  return signedUrl.replace(/(http[s]?:\/\/)([^/?#]*)?(.*)/i, `$1${CLOUDFRONT_DNS}$3`);
};
