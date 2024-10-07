import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { RokuStore } from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/store
 * Get Roku stores list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku stores Controller - getAllStore');
  updateSpinnerText('Getting all stores...');
  try {
    const storeModels: RokuStoreModel[] = await RokuStore.findAll();

    let message = `No Roku stores found`;
    if (storeModels) {
      message = `Roku stores found`;
      const results: any[] = storeModels.map((store) => {
        return {
          storeId: store.id,
          code: store.path,
          name: store.name,
        };
      });

      retWithSuccess(req, res, {
        message,
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message,
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku getAllStore failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
