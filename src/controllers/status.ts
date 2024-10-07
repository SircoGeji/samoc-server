import { Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { Status } from '../models';
import asyncHandler from 'express-async-handler';

const logger = Logger(module);

/**
 * GET /api/status
 * Get all status
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStatus = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Status Controller - getAllStatus');
    const results = await Status.findAll();
    let message: string;
    if (results && results.length > 0) {
      message = 'Status found';
    } else {
      message = 'No status found';
    }
    retWithSuccess(req, res, {
      message: message,
      data: results,
    });
  },
);
