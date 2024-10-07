import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../../models/SamocResponse';
import { AppError } from '../../../util/errorHandler';
import Logger from '../../../util/logger';
import {
  OFFER_QUERY_OPTS,
  processOfferError,
  RETENTION_OFFER_QUERY_OPTS,
} from '../../../util/utils';
import {
  getOfferDraftPayload,
  getOfferResponsePayload,
  getRetentionOfferDraftPayload,
  getRetentionOfferResponsePayload,
} from '../index';
import { Env, StatusEnum } from '../../../types/enum';
import * as httpContext from 'express-http-context';
import { Campaign, Offer, Plan, RetentionOffer } from '../../../models';
import { OfferResponsePayload, RetentionOfferResponsePayload } from '../../../types/payload';
import { convertToCampaign, retentionConvertToCampaign } from './utils';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get Offer Controller:`;
  } else {
    return `Get Offer Controller:`;
  }
};

/**
 * GET /api/offers/campaign/:campaignId
 * Get an existing campaign by campaign ID
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Campaigns Controller - getCampaign');
    const { campaignId } = req.params;
    httpContext.set('campaign', campaignId);
    try {
      const offerModels = await Offer.findAll({
        include: [{ model: Plan }],
        ...OFFER_QUERY_OPTS,
        where: { campaign: campaignId },
      });
      if (offerModels.length === 0) {
        return getRetentionCampaign(req, res, next, campaignId);
      }
      const campaignModel = await Campaign.findByPk(campaignId);

      const offerPromises: Promise<any>[] = [];
      for (const offerModel of offerModels) {
        if (offerModel.statusId === StatusEnum.DFT) {
          // this is a draft offer, just return the draft data
          const fetchPlanDetail = true;
          offerPromises.push(getOfferDraftPayload(offerModel, fetchPlanDetail));
        } else {
          const draftData: any = await getOfferResponsePayload(offerModel);
          offerModel.set('draftData', draftData);
          offerModel.save();
          offerPromises.push(draftData);
        }
      }

      const offers: OfferResponsePayload[] = await Promise.all(offerPromises);
      retWithSuccess(req, res, {
        message: `Campaign (${campaignId}) found`,
        data: await convertToCampaign(campaignModel, offers, offerModels),
      });
    } catch (err) {
      logger.error(`${logPrefix()} getCampaign failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const getRetentionCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
  campaignId: string,
) => {
  const offerModels = await RetentionOffer.findAll({
    ...RETENTION_OFFER_QUERY_OPTS,
    where: { campaign: campaignId },
  });
  if (offerModels.length === 0) {
    throw new AppError(`Campaign (${campaignId}) not found`, 404);
  }
  const campaignModel = await Campaign.findByPk(campaignId);

  const offerPromises: Promise<any>[] = [];
  for (const offerModel of offerModels) {
    if (
      offerModel.statusId === StatusEnum.DFT ||
      offerModel.statusId === StatusEnum.STG_ERR_CRT ||
      offerModel.statusId === StatusEnum.STG_FAIL
    ) {
      // this is a draft offer, just return the draft data
      const fetchPlanDetail = true;
      offerPromises.push(
        getRetentionOfferDraftPayload(offerModel, fetchPlanDetail),
      );
    } else {
      const draftData: any = await getRetentionOfferResponsePayload(offerModel);
      offerModel.set('draftData', draftData);
      offerModel.save();
      offerPromises.push(draftData);
    }
  }

  const offers: RetentionOfferResponsePayload[] = await Promise.all(offerPromises);
  retWithSuccess(req, res, {
    message: `Campaign (${campaignId}) found`,
    data: await retentionConvertToCampaign(campaignModel, offers),
  });
};
