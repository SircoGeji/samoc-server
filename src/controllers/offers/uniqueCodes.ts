import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { CodeType, Env, WorkflowAction } from '../../types/enum';
import { AppError } from '../../util/errorHandler';
import * as CsvHandler from '../../services/CsvHandler';
import Logger from '../../util/logger';
import {
  addExtraCodes,
  checkOfferInWorkflowQueue,
  getOfferModel,
  getRecurlyCredential,
  getTargetEnv,
  processOfferError,
  updateSpinnerText,
} from '../../util/utils';
import * as Recurly from '../../services/Recurly';
import { generateNewCouponCodes } from '../../services/Recurly';
import * as httpContext from 'express-http-context';
import { retWithSuccess } from '../../models/SamocResponse';
import { checkFileExist, generateCsvFileName } from './index';
import { io } from '../../server';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Export Unique Coupons Controller:`;
  } else {
    return `Export Unique Coupons Controller:`;
  }
};

/**
 * GET /api/offers/:offerId/uniqueCodes/generate
 * Generate unique Codes Csv for an existing offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const generateCodes = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { offerId } = req.params;
    const { store } = req.query;
    const storeCode = store ? (store as string) : null;
    updateSpinnerText('Generating coupon codes...');
    httpContext.set('offerCode', offerId);
    let env: Env;
    try {
      const offer = await getOfferModel(storeCode, offerId);
      if (!offer) {
        throw new AppError(`Offer (${offerId}) not found in the database`, 404);
      }
      httpContext.set('planCode', offer.planCode);
      env = getTargetEnv(offer);
      httpContext.set('env', env);
      const coupon = await Recurly.getOfferRecurlyPayload(
        offer.offerCode,
        offer.Plan.Store,
        env,
      );
      if (!coupon) {
        throw new AppError(
          `Recurly Coupon (${offerId}) not found on ${env.toUpperCase()}`,
          404,
        );
      }
      const wfAction = await checkOfferInWorkflowQueue(
        offer.offerCode,
        WorkflowAction.GENERATE_CSV,
      );
      if (coupon.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
        if (wfAction !== WorkflowAction.GENERATE_CSV) {
          // generate new coupon codes (new total minus old total)
          const recurlyCredential = getRecurlyCredential(offer.Plan.Store, env);
          if (addExtraCodes(offer.totalUniqueCodes) > coupon.totalUniqueCodes) {
            generateNewCouponCodes(
              offerId,
              addExtraCodes(offer.totalUniqueCodes) - coupon.totalUniqueCodes,
              env,
              recurlyCredential,
            )
              .then(() => {
                io.emit('show-snackbar', {
                  action: 'OK',
                  msg: `Generate unique codes completed for '${offerId}', ready to validate...`,
                  campaign: offer.campaign,
                  offerCode: offer.offerCode,
                  isInWorkflow: WorkflowAction.GENERATE_CSV,
                  event: 'generateCsvComplete',
                  storeCode: offer.Plan.Store.storeCode,
                });
              })
              .catch((err) => {
                io.emit('show-snackbar', {
                  action: 'OK',
                  msg: `Generate unique codes failed for '${offerId}', please hit (refresh) button...`,
                  campaign: offer.campaign,
                  offerCode: offer.offerCode,
                  isInWorkflow: WorkflowAction.GENERATE_CSV,
                  event: 'generateCsvFailed',
                  storeCode: offer.Plan.Store.storeCode,
                });
              });
          }
          retWithSuccess(req, res, {
            message: `Generate unique codes started for '${offerId}', this may take a while...`,
            data: {},
          });
        } else {
          retWithSuccess(req, res, {
            message: `Generate unique codes for '${offerId}' is already in progress, please wait...`,
            data: {},
          });
        }
      } else {
        throw new AppError(
          `Offer '(${offerId})' is not a bulk offer on ${env.toUpperCase()}`,
          400,
        );
      }
    } catch (err) {
      logger.error(
        `${logPrefix(env)} generateCodes failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/offers/:offerId/uniqueCodes/export
 * List/export unique Codes Csv for an existing offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const exportCodes = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { offerId } = req.params;
    const { store } = req.query;
    updateSpinnerText('Export coupon codes...');
    httpContext.set('offerCode', offerId);
    let env: Env;
    try {
      const foundOffer = await getOfferModel(store as string, offerId);
      if (!foundOffer) {
        throw new AppError(`Offer (${offerId}) not found in the database`, 404);
      }
      httpContext.set('planCode', foundOffer.planCode);
      env = getTargetEnv(foundOffer);
      httpContext.set('env', env);
      const recurlyCoupon = await Recurly.getOfferRecurlyPayload(
        foundOffer.offerCode,
        foundOffer.Plan.Store,
        env,
      );
      if (!recurlyCoupon) {
        throw new AppError(
          `Recurly Coupon (${offerId}) not found on ${env.toUpperCase()}`,
          404,
        );
      }
      const wfAction = await checkOfferInWorkflowQueue(
        foundOffer.offerCode,
        WorkflowAction.EXPORT_CSV,
      );
      if (recurlyCoupon.offerCodeType === CodeType.BULK_UNIQUE_CODE) {
        if (wfAction !== WorkflowAction.EXPORT_CSV) {
          CsvHandler.listUniqueCodes(foundOffer, res, env)
            .then(() => {
              io.emit('show-snackbar', {
                action: 'OK',
                msg: `CSV export completed for '${offerId}', ready for download.`,
                campaign: foundOffer.campaign,
                offerCode: foundOffer.offerCode,
                isInWorkflow: WorkflowAction.EXPORT_CSV,
                event: 'exportCsvCompleted',
                storeCode: foundOffer.Plan.Store.storeCode,
              });
            })
            .catch((err) => {
              logger.error(
                `${logPrefix(env)} exportUniqueCouponCodes failed, ${
                  err.message
                }`,
                err,
              );
              io.emit('show-snackbar', {
                action: 'OK',
                msg: `CSV export failed for '${offerId}', please try again later.`,
                campaign: foundOffer.campaign,
                offerCode: foundOffer.offerCode,
                isInWorkflow: WorkflowAction.EXPORT_CSV,
                event: 'exportCsvFailed',
                storeCode: foundOffer.Plan.Store.storeCode,
              });
              return next(processOfferError(err));
            });
          io.emit('show-snackbar', {
            action: 'OK',
            msg: `CSV export requested for '${offerId}', this may take a while...`,
            campaign: foundOffer.campaign,
            offerCode: foundOffer.offerCode,
            isInWorkflow: WorkflowAction.EXPORT_CSV,
            storeCode: foundOffer.Plan.Store.storeCode,
          });
          retWithSuccess(req, res, {
            message: `CSV export requested for '${offerId}', this may take a while...`,
            data: {},
          });
        } else {
          retWithSuccess(req, res, {
            message: `A CSV export for '${offerId}' is already in progress, please wait...`,
            data: {},
          });
        }
      } else {
        throw new AppError(
          `Offer '(${offerId})' is not a bulk offer on ${env.toUpperCase()}`,
          400,
        );
      }
    } catch (err) {
      logger.error(`${logPrefix(env)} exportCodes failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/offers/:offerId/uniqueCodes/download
 * Download unique Codes Csv for an existing offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const downloadCsv = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { offerId } = req.params;
    const { store } = req.query;
    const storeCode = store ? (store as string) : null;

    //TODO: use store code
    const offer = await getOfferModel(storeCode, offerId);
    const env = getTargetEnv(offer);
    const fileName = generateCsvFileName(storeCode, offer.offerCode, env);
    const csvRoot = process.env.CSV_ROOT;
    const fullPath = csvRoot + `/` + fileName;

    try {
      if (checkFileExist(fullPath)) {
        res.download(fullPath, fileName, (err) => {
          if (err) {
            res.status(500).send({
              message: 'Could not download the file. ' + err,
            });
          }
        });
      } else {
        throw new AppError(`CSV export for '${offerId}' not found`, 404);
      }
    } catch (err) {
      logger.error(`${logPrefix()} downloadCsv failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
