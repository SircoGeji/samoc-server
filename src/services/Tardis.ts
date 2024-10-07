import { AppError } from '../util/errorHandler';
import axios from 'axios';
import {
  AndroidEnvironments,
  AndroidPlatform,
  AndroidProduct,
  AndroidStore,
} from '../models';
import Logger from '../util/logger';

const logger = Logger(module);

const getHost = (): string => {
  return `${process.env.TARDIS_BASE_URL}/api/resource/v${process.env.TARDIS_API_VERSION}`;
};

const getUrlPart = (parameter: string): string => {
  return !!parameter ? '/' + parameter : '';
};

export const requestUrl = (
  env: string,
  storeCode: string,
  productCode: string,
  moduleType: string,
  platformPath: string,
  regionLanguageCode: string,
): string => {
  const publishEnv = getUrlPart(env);
  const store = getUrlPart(storeCode);
  const product = getUrlPart(productCode);
  const module = getUrlPart(moduleType);
  const platform = getUrlPart(platformPath);
  const regionLanguage = getUrlPart(regionLanguageCode).toLowerCase();
  return (
    getHost() +
    publishEnv +
    store +
    product +
    module +
    platform +
    regionLanguage
  );
};

export const checkTardisConnection = async (token: string) => {
  logger.debug(`Starting Tardis service connection check...`);
  try {
    const devEnvModel = await AndroidEnvironments.findOne({
      where: { code: 'dev' },
    });
    const defaultStore = await AndroidStore.findOne();
    const defaultProduct = await AndroidProduct.findOne();
    const defaultPlatform = await AndroidPlatform.findOne();
    await axios.get(
      requestUrl(
        devEnvModel.code,
        defaultStore.path,
        defaultProduct.path,
        'app-copy',
        defaultPlatform.path,
        'US',
      ),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    logger.debug(`Tardis service connection established`);
  } catch (err) {
    if (err.response.status !== 404) {
      throw new AppError(`Tardis Connection failed: ${err.message}`, 400);
    }
  }
};

export const getTardisRecord = async (body: any, token: string) => {
  logger.debug(`Getting Tardis record data...`);
  try {
    const result = await axios.get(
      requestUrl(
        body.env,
        body.store,
        body.product,
        body.module,
        null,
        body.region,
      ),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return result;
  } catch (err) {
    if (err.response.status !== 404) {
      throw new AppError(`Get Tardis record data failed: ${err.message}`, 400);
    }
  }
};
