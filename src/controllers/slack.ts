import pRetry from 'p-retry';
import { pRetryOptions } from '../util/utils';
import asyncHandler from 'express-async-handler';
import Logger from '../util/logger';
import { Env } from 'src/types/enum';
import { SlackError } from 'src/util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../models/SamocResponse';
import * as Slack from '../services/Slack';
import { SlackConfigModel } from 'src/models/SlackConfig';
import { updateSpinnerText } from '../util/utils';
import { AppError } from '../util/errorHandler';
import { processSlackError } from '../util/utils';
import { SlackConfig } from '../../src/models';

const logger = Logger(module);

/**
 * Get config for given slack bot
 * GET /api/slack/config
 */
export const getSlackConfiguration = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Slack Notification Controller - getSlackConfiguration');
    updateSpinnerText('Getting slack notification configuration...');
    try {
      const slackCondifgEntries: any[] = await Slack.getSlackBotConfig();

      if (!slackCondifgEntries.length) {
        retWithSuccess(req, res, {
          message: `Slack config models not found`,
          status: 200,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: `Slack config models found`,
          status: 200,
          data: slackCondifgEntries,
        });
      }
    } catch (err) {
      logger.error(`Slack getSlackConfig failed, ${err.message}`, err);
      return next(processSlackError(err));
    }
  },
);

/**
 * Save config for given slack bot
 * POST /api/slack/config/save
 */
export const saveSlackConfiguration = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Slack Notification Controller - saveSlackConfiguration');
    updateSpinnerText('Saving slack configuration...');
    try {
      const name: string = String(req.body.name);
      const payload = {
        name,
        apiKey: req.body.apiKey,
        enabled: req.body.enabled,
        data: req.body.data,
      };
      const saveResponse = await SlackConfig.create(payload);

      retWithSuccess(req, res, {
        message: `Slack bot '${name}' saved in DB successfully`,
        status: 201,
        data: null,
      });
    } catch (err) {
      logger.error(`Slack saveSlackConfiguration failed, ${err.message}`, err);
      return next(processSlackError(err));
    }
  },
);

/**
 * Update config for given slack bot
 * PUT /api/slack/config/update
 */
export const updateSlackConfiguration = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Slack Notification Controller - updateSlackConfiguration');
    updateSpinnerText('Updating slack ocnfiguration...');
    try {
      if (!req.body && !req.body.length) {
        throw new AppError('Slack config body is invalid', 400);
      }
      for (let slackBotBody of req.body as any[]) {
        const slackModel: SlackConfigModel = await Slack.getSlackBotConfigById(
          Number(slackBotBody.id),
        );

        if (slackModel) {
          slackModel.set('enabled', slackBotBody.enabled);
          slackModel.set('data', slackBotBody.data);
          await slackModel.save();

          retWithSuccess(req, res, {
            message: `Slack bot '${slackModel.name}' updated in DB successfully`,
            status: 201,
            data: null,
          });
        } else {
          retWithSuccess(req, res, {
            message: 'Slack bot config model not found',
            status: 200,
            data: null,
          });
        }
      }
    } catch (err) {
      logger.error(
        `Slack updateSlackConfiguration failed, ${err.message}`,
        err,
      );
      return next(processSlackError(err));
    }
  },
);
