import { Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { OfferType } from '../models';
import asyncHandler from 'express-async-handler';

const logger = Logger(module);

/**
 * GET /api/offertypes
 * Get all offer types
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllOfferTypes = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Offer Types Controller - getAllOfferTypes');
    const results = await OfferType.findAll();
    let message: string;
    if (results && results.length > 0) {
      message = 'Offer types found';
    } else {
      message = 'No offer type found';
    }
    retWithSuccess(req, res, {
      message: message,
      data: results,
    });
  },
);
