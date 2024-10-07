import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { AndroidProduct } from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidProductModel } from 'src/models/android/Product';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/product
 * Get Android products list
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android products Controller - getAllProducts');
  updateSpinnerText('Getting all products...');
  try {
    const productModels: AndroidProductModel[] = await AndroidProduct.findAll();

    let message = `No Android products found`;
    if (productModels) {
      message = `Android products found`;
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
    logger.error(`Android getAllProducts failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
