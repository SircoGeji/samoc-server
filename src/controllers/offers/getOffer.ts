import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import { AppError } from '../../util/errorHandler';
import Logger from '../../util/logger';
import {
  getExtensionOfferModel,
  getOfferModel,
  getRetentionOfferModel,
  processOfferError,
} from '../../util/utils';
import {
  getExtensionOfferDraftPayload,
  getExtensionOfferResponsePayload,
  getOfferDraftPayload,
  getOfferResponsePayload,
  getRetentionOfferDraftPayload,
  getRetentionOfferResponsePayload,
} from './index';
import { Env, OfferTypes, StatusEnum } from '../../types/enum';
import * as httpContext from 'express-http-context';
import { isStatusAllowed } from './createNewOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get Offer Controller:`;
  } else {
    return `Get Offer Controller:`;
  }
};

/**
 * GET /api/offers/:offerId
 * Get an existing offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const getOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - getOffer');
    const { offerId } = req.params;
    const { store } = req.query;
    const offerTypeId = Number(req.query.offerTypeId);
    const storeCode = store ? (store as string) : null;
    httpContext.set('offerCode', offerId);
    let model;
    try {
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          model = await getOfferModel(storeCode, offerId);
          break;
        case OfferTypes.RETENTION:
          return getRetentionOfferDetail(storeCode, offerId, req, res, next);
        case OfferTypes.EXTENSION:
          return getExtensionOfferDetail(storeCode, offerId, req, res, next);
      }
      httpContext.set('planCode', model.planCode);
      if (model.statusId === StatusEnum.DFT) {
        // this is a draft offer, just return the draft data
        const fetchPlanDetail = true;
        retWithSuccess(req, res, {
          message: `Offer (${model.offerCode}) found`,
          data: await getOfferDraftPayload(model, fetchPlanDetail),
        });
      } else {
        const draftData = await getOfferResponsePayload(model);
        model.set('draftData', draftData);
        model.save();
        retWithSuccess(req, res, {
          message: `Offer (${model.offerCode}) found`,
          data: draftData,
        });
      }
    } catch (err) {
      logger.error(`${logPrefix()} getOffer failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const getRetentionOfferDetail = async (
  storeCode: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const model = await getRetentionOfferModel(storeCode, offerId);
  if (!model) {
    throw new AppError(`Offer (${offerId}) not found`, 404);
  }
  httpContext.set('storeCode', model.storeCode);
  if (model.statusId === StatusEnum.DFT) {
    // this is a draft offer, just return the draft data
    const fetchPlanDetail = true;
    retWithSuccess(req, res, {
      message: `Offer (${model.offerCode}) found`,
      data: await getRetentionOfferDraftPayload(model, fetchPlanDetail),
    });
  } else {
    const draftData = await getRetentionOfferResponsePayload(model);
    model.set('draftData', draftData);
    model.save();
    retWithSuccess(req, res, {
      message: `Offer (${model.offerCode}) found`,
      data: draftData,
    });
  }
};

const getExtensionOfferDetail = async (
  storeCode: string,
  offerId: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const model = await getExtensionOfferModel(storeCode, offerId);
  if (!model) {
    throw new AppError(`Offer (${offerId}) not found`, 404);
  }
  httpContext.set('storeCode', model.storeCode);
  if (!!isStatusAllowed(model.statusId)) {
    // this is a draft offer, just return the draft data
    const fetchPlanDetail = true;
    retWithSuccess(req, res, {
      message: `Offer (${model.offerCode}) found`,
      data: await getExtensionOfferDraftPayload(model, fetchPlanDetail),
    });
  } else {
    const draftData = await getExtensionOfferResponsePayload(model);
    model.save();
    retWithSuccess(req, res, {
      message: `Offer (${model.offerCode}) found`,
      data: draftData,
    });
  }
};
