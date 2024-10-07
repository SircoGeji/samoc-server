import Logger from '../util/logger';
import { appInfo, NODE_ENV } from '../util/config';
import { retWithSuccess } from '../models/SamocResponse';
import asyncHandler from 'express-async-handler';
import { updateSpinnerText, getProperValue } from '../util/utils';
import { NextFunction, Request, Response } from 'express';
import { processOfferError } from '../util/utils';
import { getDezmundData } from '../services/Dezmund';

const logger = Logger(module);

/**
 * GET /api/dezmund/content
 * Get Dezmund content
 * @param {Request}     req
 * @param {Response}    res
 */
export const getOriginalsContent = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Dezmund Controller - getContent');
    updateSpinnerText('Getting all app copy modules...');
    try {
      let result = null;
      let message = `Dezmund content not found`;
      const url = 'https://playdata.flex.com/metadata-service/play/partner/web/v8/content';
      const contentResp = await getDezmundData(url);
      if (!!contentResp && contentResp.status === 200) {
        message = `Dezmund content found`;
        // result = contentResp.data;

        // filter FLEX originals only
        const allProductsAmount = (contentResp.data.playContentArray.playContents as any[]).length;
        const content = contentResp.data.playContentArray.playContents.filter((product: any) => !!product.original);
        const originalsAmount = (content as any[]).length;
        result = {content, allProductsAmount, originalsAmount};
      }

      retWithSuccess(req, res, {
        message: message,
        status: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`Dezmund getContent failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
