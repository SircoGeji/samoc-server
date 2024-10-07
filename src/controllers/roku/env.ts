import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { processOfferError } from '../../util/utils';
import { updateSpinnerText } from '../../util/utils';
import { RokuEnvironmentsModel } from '../../models/roku/RokuEnvironments';
import { RokuEnvironments } from '../../models';
import { Op } from 'sequelize';

const logger = Logger(module);

/**
 * GET /api/roku/env
 * Get Roku environments list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getRokuEnv = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Environment Controller - getRokuEnv');
    updateSpinnerText('Getting Roku environments list...');
    try {
      const envModels: RokuEnvironmentsModel[] = await RokuEnvironments.findAll(
        {
          where: {
            code: {
              [Op.not]: 'stg',
            },
          },
        },
      );
      if (envModels.length) {
        retWithSuccess(req, res, {
          message: 'Roku environments list found',
          status: 200,
          data: envModels,
        });
      } else {
        throw new AppError('Roku environments list not found', 404);
      }
    } catch (err) {
      logger.error(`Roku getRokuEnv failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
