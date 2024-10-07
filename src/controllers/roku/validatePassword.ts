import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { processOfferError } from '../../util/utils';
import { updateSpinnerText } from '../../util/utils';

import { EnvironmentConfig } from '../../models';
import { EnvironmentConfigModel } from 'src/models/EnvironmentConfigs';

const logger = Logger(module);

/**
 * GET /api/roku/prod/:password/validate
 * Validate Roku publish on PROD password
 * @param {Request}     req
 * @param {Response}    res
 */
export const validatePRODPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Validate password Controller - validatePRODPassword');
  updateSpinnerText('Validating PROD password...');
  try {
    const password: string = req.params.password;
    const configModel: EnvironmentConfigModel = await EnvironmentConfig.findOne({
      where: { config: 'rokuTardisPassword' },
    });
    let message;
    let data;
    if (!!configModel) {
      const correctPassword = configModel.value;
      message = password === correctPassword ? 'Correct password!' : 'Incorrect password!';
      data = password === correctPassword ? null : { error: 'Password is incorrect!' };
    } else {
      message = 'Password Missing from DB.';
      data = { error: 'Password is incorrect!' };
    }

    retWithSuccess(req, res, {
      message: message,
      status: 200,
      data: data,
    });
  } catch (err) {
    logger.error(`Roku validatePRODPassword failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
