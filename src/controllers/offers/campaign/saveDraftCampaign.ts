import { NextFunction, Request, Response } from 'express';
import Logger from '../../../util/logger';
import { retWithSuccess } from '../../../models/SamocResponse';
import { Env, OfferTypes, StatusEnum } from '../../../types/enum';
import asyncHandler from 'express-async-handler';
import { processOfferError, updateSpinnerText } from '../../../util/utils';
import { createOfferInDb } from '../createNewOffer';
import * as httpContext from 'express-http-context';
import { CampaignPayload } from './payloads';
import {
  convertFromCampaign,
  convertOrUpdateCampaignInDb,
  retentionConvertFromCampaign,
  uniqueCampaignId,
} from './utils';
import { OfferDbPayload } from '../../../types/payload';
import { createRetentionOfferInDb } from '../createNewRetentionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Save Draft Controller:`;
  } else {
    return `Save Draft Controller:`;
  }
};

/**
 * POST /api/offers/campaign/save
 * Save a draft offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveDraftCampaign = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Campaign Controller - saveDraftCampaign');
    updateSpinnerText('Saving campaign...');

    if ((req.body as OfferDbPayload).offerTypeId == OfferTypes.RETENTION) {
      return saveRetentionDraftCampaign(req, res, next);
    }

    try {
      // Save draft offer to DB
      const campaignPayload = req.body as CampaignPayload;
      const campaignId = await uniqueCampaignId(
        campaignPayload.regions[0].offerCode,
      );
      httpContext.set('campaign', campaignPayload.campaignName);
      httpContext.set('env', Env.DB);
      if (!campaignPayload.campaign) {
        campaignPayload.campaign = campaignId;
      }
      const offers = await convertFromCampaign(campaignPayload);
      await convertOrUpdateCampaignInDb(campaignPayload);
      for (const offer of offers) {
        await createOfferInDb(offer, StatusEnum.DFT);
      }
      retWithSuccess(req, res, {
        message: `Campaign (${campaignPayload.campaignName}) saved as draft successfully`,
        status: 201,
        data: {
          campaign: campaignId,
        },
      });
    } catch (err) {
      logger.error(
        `${logPrefix(Env.DB)} saveDraftCampaign failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

export const saveRetentionDraftCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Save draft offer to DB
    const campaignPayload = req.body as CampaignPayload;
    const campaignId = await uniqueCampaignId(
      campaignPayload.regions[0].offerCode,
    );
    httpContext.set('campaign', campaignPayload.campaignName);
    httpContext.set('env', Env.DB);
    if (!campaignPayload.campaign) {
      campaignPayload.campaign = campaignId;
    }
    const offers = await retentionConvertFromCampaign(campaignPayload);
    await convertOrUpdateCampaignInDb(campaignPayload);
    for (const offer of offers) {
      await createRetentionOfferInDb(offer, StatusEnum.DFT);
    }
    retWithSuccess(req, res, {
      message: `Campaign (${campaignPayload.campaignName}) saved as draft successfully`,
      status: 201,
      data: {
        campaign: campaignId,
      },
    });
  } catch (err) {
    logger.error(
      `${logPrefix(Env.DB)} saveDraftCampaign failed, ${err.message}`,
      err,
    );
    return next(processOfferError(err));
  }
};
