import { AppError } from '../util/errorHandler';
import Logger from '../util/logger';
import axios from 'axios';
import { NODE_ENV } from '../util/config';
import pRetry from 'p-retry';
import { pRetryAll } from '../util/utils';

const logger = Logger(module);

export const clearImageCache = async (platform: string, env: string, product: string, name: string, index: number) => {
  logger.debug(`Imgix service Controller - clearImageCache | ${name} | ${index}`);
  const clearCacheOp = async (): Promise<any> => {
    let response;
    try {
      response = await axios.post(
        'https://api.imgix.com/api/v1/purge',
        {
          data: {
            attributes: {
              url: `https://imgflex.imgix.net/Buyflow/${platform}/samoc/appImages/samoc-${NODE_ENV}-instance/${env}/${product}/${name}`,
            },
            type: 'purges',
          },
        },
        {
          headers: {
            Accept: '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            Connection: 'keep-alive',
            Authorization: 'Bearer ak_75a009989a01e1c0974b2ff17d7661bd80b172439dd79177d261cb4f58b96aa8',
            'Content-Type': 'application/vnd.api+json',
          },
        },
      );
      if (response.status >= 400) {
        throw new AppError(response.statusText, response.status);
      }
    } catch (err) {
      throw new AppError('Clear image cache in Imgix service failed', err.code);
    }
    return response;
  };
  await pRetry(clearCacheOp, { ...pRetryAll, minTimeout: 5000 });
};
