import { NextFunction, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { retWithSuccess } from '../models/SamocResponse';
import Logger from '../util/logger';
import { webhookConsumer, WebhookPayload } from '../services/Bamboo';

const logger = Logger(module);

export const webhook = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const data: WebhookPayload = await webhookConsumer(req);

    retWithSuccess(req, res, {
      message: `Bamboo webhook consumed - ${data.build.key}`,
      data,
    });
  },
);
