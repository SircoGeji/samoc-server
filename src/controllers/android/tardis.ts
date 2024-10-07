import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { getProperValue, processOfferError } from '../../util/utils';
import { retWithSuccess } from '../../models/SamocResponse';
import { isTokenValid } from '../android/multiModules';
import { getAuthToken } from '../../services/GateKeeper';
import Logger from '../../util/logger';
import { getTardisRecord } from '../../services/Tardis';

const logger = Logger(module);

/**
 * GET /api/tardis/record
 * Get Tardis record
 * @param {Request}     req
 * @param {Response}    res
 */
export const getRecord = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { env, module, store, product, region } = req.query;
    try {
      let result = null;
      let message = '';
      if (!!env && !!module && !!store && !!product && !!region) {
        message = `No Tardis record found: *module(${module}), *environment (${env}), *store (${store}), *product(${product}), *region(${region})`;
        let tardisToken = '';
        let tardisTokenExpiresAt = '';
        if (!isTokenValid(req.body)) {
          [tardisToken, tardisTokenExpiresAt] = await getAuthToken();
        }
        result = await getTardisRecord(
          {
            env,
            store,
            product,
            module,
            region,
          },
          tardisToken,
        );
        if (!!result) {
            message = 'Tardis record found'
        }
        retWithSuccess(req, res, {
          message,
          status: 200,
          data: result.data,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'Some property is missing',
          status: 500,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Tardis getRecord failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
