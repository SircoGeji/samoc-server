import axios from 'axios';
import Logger from '../util/logger';
import { appInfo, NODE_ENV } from '../util/config';
import { retWithSuccess } from '../models/SamocResponse';
import asyncHandler from 'express-async-handler';
import { updateSpinnerText, getProperValue } from '../util/utils';
import { NextFunction, Request, Response } from 'express';
import { processOfferError } from '../util/utils';
import { Env, StatusEnum } from '../types/enum';
import { AppError } from '../util/errorHandler';

const logger = Logger(module);
const logPrefix = (env?: Env | String) => {
  if (env) {
    return `[${env.toUpperCase()}] Dezmund:`;
  } else {
    return `Dezmund:`;
  }
};

export const getDezmundData = async (url: string) => {
  // const url = 'https://playdata.flex.com/metadata-service/play/partner/web/v8/content?includes=title,contentId,original&src=samoc'
  //   const url =
  //     'https://playdata.flex.com/metadata-service/play/partner/web/v8/content';
  logger.debug(`${logPrefix(process.env.NODE_ENV)} Triggering Bamboo Build`);
  try {
    const res = await axios.get(url, {
      params: {
        includes: 'title,contentId,original',
        src: 'samoc',
      },
    });
    return res;
  } catch (err) {
    throw new AppError(`Dezmund GET request failed: ${err.message}`, 400);
  }
};
