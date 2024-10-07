import { NextFunction, Request, Response } from 'express';
import Logger from '../../util/logger';
import { retWithSuccess } from '../../models/SamocResponse';
import { Env, OfferTypes, StatusEnum } from '../../types/enum';
import {
  ExtensionOfferDbPayload,
  OfferDbPayload,
  RetentionOfferDbPayload,
} from '../../types/payload';
import asyncHandler from 'express-async-handler';
import {
  getPlanModel,
  processOfferError,
  updateSpinnerText,
} from '../../util/utils';
import { createOfferInDb } from './createNewOffer';
import * as httpContext from 'express-http-context';
import { createRetentionOfferInDb } from './createNewRetentionOffer';
import { uniqueCampaignId } from './campaign/utils';
import { createExtensionOfferInDb } from './extension/createNewExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Save Draft Controller:`;
  } else {
    return `Save Draft Controller:`;
  }
};

/**
 * POST /api/offers/save
 * Save a draft offer
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveDraftOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offer Controller - saveDraftOffer');
    updateSpinnerText('Saving offer...');
    const offerTypeId = (req.body as OfferDbPayload).offerTypeId;
    try {
      // Save draft offer to DB
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          const dbOfferPayload = req.body as OfferDbPayload;
          httpContext.set('offerCode', dbOfferPayload.offerCode);
          httpContext.set('planCode', dbOfferPayload.planCode);
          httpContext.set('env', Env.DB);
          const plan = await getPlanModel(dbOfferPayload.planCode);
          if (!dbOfferPayload.campaign) {
            dbOfferPayload.campaign = await uniqueCampaignId(
              dbOfferPayload.offerCode,
            );
            dbOfferPayload.campaignName = '';
          }
          if (!dbOfferPayload.storeCode) {
            dbOfferPayload.storeCode = plan.storeCode;
          }
          const offer = await createOfferInDb(dbOfferPayload, StatusEnum.DFT);
          retWithSuccess(req, res, {
            message: `Offer (${offer.offerCode}) saved as draft successfully`,
            status: 201,
            data: null,
          });
          break;
        case OfferTypes.RETENTION:
          const dbRetentionPayload = req.body as RetentionOfferDbPayload;
          httpContext.set('offerCode', dbRetentionPayload.offerCode);
          httpContext.set('storeCode', dbRetentionPayload.storeCode);
          httpContext.set('env', Env.DB);
          if (!dbRetentionPayload.campaign) {
            dbRetentionPayload.campaign = await uniqueCampaignId(
              dbRetentionPayload.offerCode,
            );
            dbRetentionPayload.campaignName = '';
          }
          const retentionOffer = await createRetentionOfferInDb(
            dbRetentionPayload,
            StatusEnum.DFT,
          );
          retWithSuccess(req, res, {
            message: `Offer (${retentionOffer.offerCode}) saved as draft successfully`,
            status: 201,
            data: null,
          });
          break;
        case OfferTypes.EXTENSION:
          const dbExtensionPayload = req.body;
          httpContext.set('offerCode', dbExtensionPayload.offerCode);
          httpContext.set('storeCode', dbExtensionPayload.storeCode);
          httpContext.set('env', Env.DB);
          if (!!dbExtensionPayload.usersOnPlans.length) {
            const usersOnPlansArr = dbExtensionPayload.usersOnPlans.filter(
              (elem: string) => elem !== '-',
            );
            dbExtensionPayload.usersOnPlans = !!usersOnPlansArr.length
              ? usersOnPlansArr.join(',')
              : null;
          } else {
            dbExtensionPayload.usersOnPlans = null;
          }
          const extensionOffer = await createExtensionOfferInDb(
            dbExtensionPayload,
            StatusEnum.DFT,
          );
          retWithSuccess(req, res, {
            message: `Offer (${extensionOffer.offerCode}) saved as draft successfully`,
            status: 201,
            data: null,
          });
          break;
      }
      // if ((req.body as OfferDbPayload).offerTypeId !== OfferTypes.RETENTION) {
      //   // Save draft offer to DB
      //   const dbPayload = req.body as OfferDbPayload;
      //   httpContext.set('offerCode', dbPayload.offerCode);
      //   httpContext.set('planCode', dbPayload.planCode);
      //   httpContext.set('env', Env.DB);
      //   const plan = await getPlanModel(dbPayload.planCode);
      //   if (!dbPayload.campaign) {
      //     dbPayload.campaign = await uniqueCampaignId(dbPayload.offerCode);
      //     dbPayload.campaignName = '';
      //   }
      //   if (!dbPayload.storeCode) {
      //     dbPayload.storeCode = plan.storeCode;
      //   }

      //   const offer = await createOfferInDb(dbPayload, StatusEnum.DFT);
      //   retWithSuccess(req, res, {
      //     message: `Offer (${offer.offerCode}) saved as draft successfully`,
      //     status: 201,
      //     data: null,
      //   });
      // } else {
      //   // Save draft offer to DB
      //   const dbPayload = req.body as RetentionOfferDbPayload;
      //   httpContext.set('offerCode', dbPayload.offerCode);
      //   httpContext.set('storeCode', dbPayload.storeCode);
      //   httpContext.set('env', Env.DB);
      //   if (!dbPayload.campaign) {
      //     dbPayload.campaign = await uniqueCampaignId(dbPayload.offerCode);
      //     dbPayload.campaignName = '';
      //   }
      //   const offer = await createRetentionOfferInDb(dbPayload, StatusEnum.DFT);
      //   retWithSuccess(req, res, {
      //     message: `Offer (${offer.offerCode}) saved as draft successfully`,
      //     status: 201,
      //     data: null,
      //   });
      // }
    } catch (err) {
      logger.error(
        `${logPrefix(Env.DB)} saveDraftOffer failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);
