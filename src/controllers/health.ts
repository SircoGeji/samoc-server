import { Request, Response } from 'express';
import Logger from '../util/logger';
import { appInfo, NODE_ENV } from '../util/config';
import { retWithSuccess } from '../models/SamocResponse';

const logger = Logger(module);

/**
 * GET /health or /ping
 */
export const getStatus = (req: Request, res: Response): void => {
  logger.debug('Server is pinged');
  retWithSuccess(req, res, {
    message: 'SAMOC API Service Available',
    data: {
      envname: NODE_ENV,
      version: appInfo.version || 'n/a',
    },
  });
};
