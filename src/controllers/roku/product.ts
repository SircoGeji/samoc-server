import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { RokuProduct } from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuProductModel } from 'src/models/roku/Product';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/product
 * Get Roku products list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku products Controller - getAllProducts');
  updateSpinnerText('Getting all products...');
  try {
    const productModels: RokuProductModel[] = await RokuProduct.findAll();

    let message = `No Roku products found`;
    if (productModels) {
      message = `Roku products found`;
      const results: any[] = productModels.map((product) => {
        return {
          productId: product.id,
          code: product.path,
          name: product.name,
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
    logger.error(`Roku getAllProducts failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
