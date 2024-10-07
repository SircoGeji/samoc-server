import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { AndroidStore } from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/store
 * Get Android stores list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android stores Controller - getAllStore');
  updateSpinnerText('Getting all stores...');
  try {
    const storeModels: AndroidStoreModel[] = await AndroidStore.findAll();

    let message = `No Android stores found`;
    if (storeModels) {
      message = `Android stores found`;
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
    logger.error(`Android getAllStore failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
