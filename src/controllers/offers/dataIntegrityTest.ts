import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Env } from '../../types/enum';
import { OfferDitResultRequest } from '../../types/payload';
import { AppError } from '../../util/errorHandler';
import Logger from '../../util/logger';
import {
  getOfferModel,
  getRetentionOfferModel,
  getTargetEnvFromStatusId,
  processOfferError,
  updateSpinnerText,
} from '../../util/utils';
import * as httpContext from 'express-http-context';
import { retWithSuccess } from '../../models/SamocResponse';
import { offerDIT } from './validateOffer';
import { StoreModel } from '../../models/Store';
import {
  getRetentionOfferCountrySlow,
  validateGlFilter,
} from '../../services/GhostLocker';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Offer DIT Controller:`;
  } else {
    return `Offer DIT Controller:`;
  }
};

export const validateOfferDIT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - checkOffer');
    const { offerId } = req.params;
    const { store } = req.query;
    const storeCode = store ? (store as string) : null;
    updateSpinnerText('Updating offer DIT results...');
    httpContext.set('offerCode', offerId);
    let env: Env;
    try {
      const offerModel = await getOfferModel(storeCode, offerId);
      const retentionOfferModel = await getRetentionOfferModel(storeCode, offerId);
      let store: StoreModel;
      if (offerModel) {
        store = offerModel.Plan.Store;
        env = getTargetEnvFromStatusId(offerModel.statusId);
      } else if (retentionOfferModel) {
        store = retentionOfferModel.Store;
        env = getTargetEnvFromStatusId(retentionOfferModel.statusId);
      } else {
        return next(new AppError(`Offer (${offerId}) not found`, 404));
      }
      const uniqueOfferCode = { code: '' };
      await offerDIT(
        offerId,
        offerModel,
        retentionOfferModel,
        store,
        env,
        uniqueOfferCode,
        false,
        true,
      );

      const country = await getRetentionOfferCountrySlow(store.regionCode, env);
      const glValidationWarning = validateGlFilter(
        env,
        country,
        retentionOfferModel,
      );

      retWithSuccess(req, res, {
        message: `Offer (${offerId}) DIT success`,
        data: { warning: glValidationWarning },
      });
    } catch (err) {
      logger.error(
        `${logPrefix(env)} ${offerId} validation failed: ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);
/**
 * PUT /api/offers/dit/:offerId
 * Update data integrity test result for the offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateOfferDit = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - updateOfferDit');
    updateSpinnerText('Updating offer DIT results...');
    const { offerId } = req.params;
    const { store } = req.query;
    const storeCode = store ? (store as string) : null;
    httpContext.set('offerCode', offerId);
    let targetEnv: Env;
    const dtiRequest = req.body as OfferDitResultRequest;
    try {
      const foundOffer = await getOfferModel(storeCode, offerId);
      if (foundOffer) {
        foundOffer.dataIntegrityStatus = dtiRequest.dataIntegrityStatus;
        foundOffer.dataIntegrityCheckTime = new Date();
        foundOffer.dataIntegrityErrorMessage =
          dtiRequest.dataIntegrityErrorMessage;
        await foundOffer.save({ silent: true });
        retWithSuccess(req, res, {
          message: `Offer (${offerId}) DIT results updated successfully`,
          data: null,
        });
      } else {
        const foundRetentionOffer = await getRetentionOfferModel(storeCode, offerId);
        if (foundRetentionOffer) {
          foundRetentionOffer.dataIntegrityStatus =
            dtiRequest.dataIntegrityStatus;
          foundRetentionOffer.dataIntegrityCheckTime = new Date();
          foundRetentionOffer.dataIntegrityErrorMessage =
            dtiRequest.dataIntegrityErrorMessage;
          await foundRetentionOffer.save({ silent: true });
          retWithSuccess(req, res, {
            message: `Retention offer (${offerId}) DIT results updated successfully`,
            data: null,
          });
        } else {
          return next(new AppError(`Can't find offer ${offerId}`, 404));
        }
      }
    } catch (err) {
      logger.error(
        `${logPrefix(targetEnv)} Failed to update offer ${offerId} DIT: ${
          err.message
        }`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);
