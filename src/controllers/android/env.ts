import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { processOfferError } from '../../util/utils';
import { updateSpinnerText } from '../../util/utils';
import { AndroidEnvironmentsModel } from 'src/models/android/AndroidEnvironments';
import { AndroidEnvironments } from '../../models';
import { Op } from 'sequelize';
import { AndroidEnv } from '../../types/enum';

const logger = Logger(module);

/**
 * GET /api/android/env
 * Get Android environments list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAndroidEnv = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Environment Controller - getAndroidEnv');
    updateSpinnerText('Getting Android environments list...');
    try {
      const envModels: AndroidEnvironmentsModel[] = await AndroidEnvironments.findAll(
        {
          where: {
            code: {
              [Op.and]: [
                { [Op.not]: AndroidEnv.STG_PROD },
                { [Op.not]: AndroidEnv.STG_QA },
              ],
            },
          },
        },
      );
      if (envModels.length) {
        retWithSuccess(req, res, {
          message: 'Android environments list found',
          status: 200,
          data: envModels,
        });
      } else {
        throw new AppError('Android environments list not found', 404);
      }
    } catch (err) {
      logger.error(`Android getAndroidEnv failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
