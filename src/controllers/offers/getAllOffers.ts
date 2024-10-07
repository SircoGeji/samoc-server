import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import {
  ExtensionOffer,
  Offer,
  Plan,
  RetentionOffer,
  Store,
} from '../../models';
import { OfferModel } from '../../models/Offer';
import { Op } from 'sequelize';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  compareDates,
  compareRankings,
  OFFER_QUERY_OPTS,
  processOfferError,
  RETENTION_OFFER_QUERY_OPTS,
  EXTENSION_OFFER_QUERY_OPTS,
} from '../../util/utils';
import {
  ActiveOfferStatuses,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../types/enum';
import * as Recurly from '../../services/Recurly';
import {
  getExtensionOfferModelPayload,
  getOfferDraftPayload,
  getOfferResponsePayload,
  getRetentionOfferDraftPayload,
  getRetentionOfferResponsePayload,
} from './index';
import { RetentionOfferModel } from '../../models/RetentionOffer';
import {
  OfferContentfulPayload,
  OfferRecurlyResponsePayload,
  PlanRecurlyPayload,
} from '../../types/payload';
import {
  ConfigurationValue,
  getAccessToken,
  getAllGlOffers,
  getConfigValue,
  getRetentionOfferCountry,
  GLSet,
  RetentionConfigurationValue,
} from '../../services/GhostLocker';
import { getAllSpecialOffers } from '../../services/Contentful';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get All Offers Controller:`;
  } else {
    return `Get All Offers Controller:`;
  }
};

/**
 * GET /api/offers?store=<storeCode>
 * Get all offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const getDBAllOffers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - getDBAllOffers');
    const { store } = req.query;
    const storeCode = store as string;
    try {
      let storeModels;
      if (storeCode) {
        const storeModel = await Store.findOne({
          where: {
            storeCode,
          },
        });
        storeModels = [storeModel];
      } else {
        storeModels = await Store.findAll();
      }
      const data: any[] = await getDBOffers(storeModels);
      if (data.length) {
        retWithSuccess(req, res, {
          message: `Plans and offers found for store (${store})`,
          data,
        });
      } else {
        retWithSuccess(req, res, {
          message: `No plan and offer found for store (${store})`,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`${logPrefix()} getDBAllOffers failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const getDBOffers = async (storeModels: any[]): Promise<any> => {
  let results: any[] = [];
  for (let storeModel of storeModels) {
    const offers: OfferModel[] = await Offer.findAll({
      include: [{ model: Plan }],
      ...OFFER_QUERY_OPTS,
      where: { storeCode: storeModel.storeCode },
    });
    for (let offer of offers) {
      if (!!offer.draftData) {
        results.push(getOfferPayload(offer));
      }
    }
    const retentionOffers: RetentionOfferModel[] = await RetentionOffer.findAll(
      {
        ...RETENTION_OFFER_QUERY_OPTS,
        where: { storeCode: storeModel.storeCode },
      },
    );
    for (let offer of retentionOffers) {
      if (!!offer.draftData) {
        results.push(getRetentionOfferPayload(offer));
      }
    }
    const extensionOffers: ExtensionOfferModel[] = await ExtensionOffer.findAll(
      {
        ...EXTENSION_OFFER_QUERY_OPTS,
        where: { storeCode: storeModel.storeCode },
      },
    );
    for (let offer of extensionOffers) {
      results.push(getExtensionOfferModelPayload(offer));
    }
  }
  results = results.sort((a, b) => {
    return (
      compareRankings(a.Status.sortPriority, b.Status.sortPriority) ||
      compareDates(
        new Date(a.couponCreatedAt).getTime(),
        new Date(b.couponCreatedAt).getTime(),
      )
    );
  });
  return results;
};

const getOfferPayload = (offer: OfferModel) => {
  let draftData = JSON.parse(JSON.stringify(offer.draftData));
  if (draftData.discountType === DiscountType.FREE_TRIAL) {
    draftData.discountAmount = null;
  }
  return {
    ...draftData,
    statusId: offer.statusId,
    Status: {
      id: offer.Status.statusId,
      title: offer.Status.title,
      description: offer.Status.description,
      sortPriority: offer.Status.sortPriority,
    },
    lastModifiedAt: offer.get('LastModifiedAt'),
    OfferType: {
      id: offer.offerTypeId,
      title: offer.OfferType ? offer.OfferType.title : null,
    },
    dataIntegrityStatus: offer.dataIntegrityStatus,
    dataIntegrityCheckTime: offer.dataIntegrityCheckTime,
    dataIntegrityErrorMessage: offer.dataIntegrityErrorMessage,
    campaign: offer.campaign,
    campaignName:
      offer.campaignName ||
      offer.Campaign?.name ||
      (!!draftData && draftData.offerName)
        ? draftData.offerName
        : null,
    storeCode: offer.storeCode,
  };
};

const getRetentionOfferPayload = (offer: RetentionOfferModel) => {
  let draftData = JSON.parse(JSON.stringify(offer.draftData));
  if (draftData.discountType === DiscountType.FREE_TRIAL) {
    draftData.discountAmount = null;
  }
  return {
    ...draftData,
    statusId: offer.statusId,
    Status: {
      id: offer.Status.statusId,
      title: offer.Status.title,
      description: offer.Status.description,
      sortPriority: offer.Status.sortPriority,
    },
    lastModifiedAt: offer.get('LastModifiedAt'),
    OfferType: {
      id: OfferTypes.RETENTION,
      title: 'Retention',
    },
    dataIntegrityStatus: offer.dataIntegrityStatus,
    dataIntegrityCheckTime: offer.dataIntegrityCheckTime,
    dataIntegrityErrorMessage: offer.dataIntegrityErrorMessage,
    campaign: offer.campaign,
    campaignName:
      offer.campaignName ||
      offer.Campaign?.name ||
      (!!draftData && draftData.offerName)
        ? draftData.offerName
        : null,
    storeCode: offer.storeCode,
  };
};

const loadContentfulDataAndMergeEnvs = async (
  results: any[],
  ignoreImages: boolean,
  stResults: OfferRecurlyResponsePayload[],
  prResults: OfferRecurlyResponsePayload[],
  storeCode: string,
  loadContentful: boolean,
) => {
  const activeOfferCodes = stResults
    .filter((offer) => ActiveOfferStatuses.has(offer.statusId))
    .map((offer) => offer.offerCode)
    .concat(
      prResults
        .filter((offer) => ActiveOfferStatuses.has(offer.statusId))
        .map((offer) => offer.offerCode),
    );

  let contentfulPayloads: Map<string, OfferContentfulPayload> = new Map();
  if (loadContentful) {
    const allOffers = await getAllSpecialOffers(
      storeCode,
      activeOfferCodes,
      ignoreImages,
    );
    contentfulPayloads = new Map<string, OfferContentfulPayload>(
      allOffers.map((offer) => {
        return [offer.offerCode, offer];
      }),
    );
  }

  results = results.concat(
    stResults.map((offer) => {
      const contentful = contentfulPayloads.get(offer.offerCode);
      return contentful ? { ...contentful, ...offer } : offer;
    }),
  );
  results = results.concat(
    prResults.map((offer) => {
      const contentful = contentfulPayloads.get(offer.offerCode);
      return contentful ? { ...contentful, ...offer } : offer;
    }),
  );

  return results;
};

/**
 * GET /api/offers?store=<storeCode>
 * Get all offers
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllOffers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - getAllOffers');
    const { store } = req.query;
    const storeCode = store as string;
    try {
      let storeModels;
      if (storeCode) {
        const storeModel = await Store.findOne({
          where: {
            storeCode,
          },
        });
        storeModels = [storeModel];
      } else {
        storeModels = await Store.findAll();
      }
      const cachedPlans: { [key: string]: PlanRecurlyPayload } = {};
      if (storeModels.length > 0) {
        let results: any[] = [];
        let message = 'No offer found';

        const [stgToken, prodToken] = await Promise.all([
          getAccessToken(Env.STG),
          getAccessToken(Env.PROD),
        ]);

        const configs = await Promise.all([
          getConfigValue(GLSet.PROMO_RECURLY, Env.STG, stgToken),
          getConfigValue(GLSet.RET_RECURLY_V2, Env.STG, stgToken),
          getConfigValue(GLSet.PROMO_RECURLY, Env.PROD, prodToken),
          getConfigValue(GLSet.RET_RECURLY_V2, Env.PROD, prodToken),
        ]);
        const stgPromotionConfig: ConfigurationValue = configs[0];
        const stgRetentionConfig: RetentionConfigurationValue = configs[1];
        const prodPromotionConfig: ConfigurationValue = configs[2];
        const prodRetentionConfig: RetentionConfigurationValue = configs[3];

        for (const storeModel of storeModels) {
          const offers: OfferModel[] = await Offer.findAll({
            include: [{ model: Plan }],
            ...OFFER_QUERY_OPTS,
            where: {
              storeCode: storeModel.storeCode,
            },
          });

          const glOffers = getAllGlOffers(
            stgPromotionConfig,
            stgRetentionConfig,
            prodPromotionConfig,
            prodRetentionConfig,
            storeModel.regionCode,
          );
          const stgCountry = getRetentionOfferCountry(
            storeModel.regionCode,
            stgRetentionConfig,
          );
          const prodCountry = getRetentionOfferCountry(
            storeModel.regionCode,
            prodRetentionConfig,
          );
          if (offers && offers.length > 0) {
            message = 'Offers found';
            // 1) separate draft, stage and prod offers from the database queried results
            const draftOffers = [];
            const stageOffers = [];
            const prodOffers = [];
            for (const offer of offers) {
              if (offer.statusId > StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(offer);
              } else if (offer.statusId === StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(offer);
              } else if (offer.statusId >= StatusEnum.STG_ERR_CRT) {
                if (offer.couponId) {
                  stageOffers.push(offer);
                } else {
                  draftOffers.push(offer);
                }
              } else if (offer.statusId >= StatusEnum.DFT) {
                draftOffers.push(offer);
              }
            }

            // 2) get draft recurly plans and map draft results
            const ids = [...new Set(draftOffers.map((of) => of.Plan.planId))];
            const recurlyPlansOfDrafts = await Recurly.getPlansRecurlyPayload(
              ids,
              storeModel,
              Env.PROD,
            );
            for (const plan of recurlyPlansOfDrafts) {
              cachedPlans[plan.planCode] = plan;
            }
            for (const model of draftOffers) {
              for (const pl of recurlyPlansOfDrafts) {
                if (model.Plan.planId === pl.planId) {
                  const draft = JSON.parse(JSON.stringify(model.draftData));
                  if (!draft) {
                    logger.error(
                      `Invalid draft offer ${
                        model.offerCode
                      } on ${Env.STG.toUpperCase()}`,
                    );
                    continue;
                  }
                  draft.discountAmount =
                    draft.discountType === DiscountType.FIXED_PRICE
                      ? (pl.price - draft.discountAmount).toFixed(2)
                      : draft.discountAmount;
                  model.draftData = draft;
                  results.push(await getOfferDraftPayload(model));
                  break;
                }
              }
            }
            // 3) get all stage offers from recurly
            const stResults = await Recurly.getOffersRecurlyPayload(
              stageOffers,
              storeModel,
              Env.STG,
              glOffers.get(Env.STG),
            );

            // 4) get all prod offers from recurly
            const prResults = await Recurly.getOffersRecurlyPayload(
              prodOffers,
              storeModel,
              Env.PROD,
              glOffers.get(Env.PROD),
            );

            results = await loadContentfulDataAndMergeEnvs(
              results,
              false,
              stResults,
              prResults,
              storeModel.storeCode,
              !!storeCode,
            );
          }
          const retentionOffers: RetentionOfferModel[] = await RetentionOffer.findAll(
            {
              ...RETENTION_OFFER_QUERY_OPTS,
              where: {
                storeCode: storeModel.storeCode,
              },
            },
          );
          if (retentionOffers && retentionOffers.length > 0) {
            message = 'Offers found';
            // 1) separate draft, stage and prod offers from the database queried results
            const draftOffers = [];
            const stageOffers = [];
            const prodOffers = [];
            for (const retentionOffer of retentionOffers) {
              if (retentionOffer.statusId > StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(retentionOffer);
              } else if (retentionOffer.statusId === StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(retentionOffer);
                // }
              } else if (retentionOffer.statusId >= StatusEnum.STG_ERR_CRT) {
                if (retentionOffer.couponId) {
                  stageOffers.push(retentionOffer);
                } else {
                  draftOffers.push(retentionOffer);
                }
              } else if (retentionOffer.statusId >= StatusEnum.DFT) {
                draftOffers.push(retentionOffer);
              }
            }

            // 2) get draft recurly plans and map draft results
            for (const model of draftOffers) {
              const planCode = model.eligiblePlans.split(',')[0];
              let plan = cachedPlans[planCode];
              if (!plan) {
                plan = await Recurly.getPlanRecurlyPayload(
                  planCode,
                  storeModel,
                  Env.PROD,
                );
                cachedPlans[planCode] = plan;
              }
              const draft = JSON.parse(JSON.stringify(model.draftData));
              draft.discountAmount =
                draft.discountType === DiscountType.FIXED_PRICE
                  ? (plan.price - draft.discountAmount).toFixed(2)
                  : draft.discountAmount;
              model.draftData = draft;
              results.push(await getRetentionOfferDraftPayload(model));
            }

            // 3) get all stage offers from recurly
            const stResults = await Recurly.getRetentionOffersRecurlyPayload(
              stageOffers,
              storeModel,
              Env.STG,
              glOffers.get(Env.STG),
              stgCountry,
            );

            // 4) get all prod offers from recurly
            const prResults = await Recurly.getRetentionOffersRecurlyPayload(
              prodOffers,
              storeModel,
              Env.PROD,
              glOffers.get(Env.PROD),
              prodCountry,
            );
            results = await loadContentfulDataAndMergeEnvs(
              results,
              true,
              stResults,
              prResults,
              storeModel.storeCode,
              !!storeCode,
            );
          }
        }
        results = results.sort((a, b) => {
          return (
            compareRankings(a.Status.sortPriority, b.Status.sortPriority) ||
            compareDates(a.endDateTime, b.endDateTime)
          );
        });
        retWithSuccess(req, res, {
          message: message,
          data: results,
        });
      } else {
        // no plan for the store code, thus no offers
        retWithSuccess(req, res, {
          message: `No plan and offer found for store (${store})`,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`${logPrefix()} getAllOffers failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * PUT /api/offers?store=<storeCode>
 * Pull all data from remote services offers data to environment data base
 * @param {Request}     req
 * @param {Response}    res
 */
export const putAllOffers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Offers Controller - putAllOffers');
    const { store } = req.query;
    const storeCode = store as string;
    try {
      let storeModels;
      if (storeCode) {
        const storeModel = await Store.findOne({
          where: {
            storeCode,
          },
        });
        storeModels = [storeModel];
      } else {
        storeModels = await Store.findAll();
      }
      const cachedPlans: { [key: string]: PlanRecurlyPayload } = {};
      if (storeModels.length > 0) {
        let results: any[] = [];
        let message = 'No offer found';

        const [stgToken, prodToken] = await Promise.all([
          getAccessToken(Env.STG),
          getAccessToken(Env.PROD),
        ]);

        const configs = await Promise.all([
          getConfigValue(GLSet.PROMO_RECURLY, Env.STG, stgToken),
          getConfigValue(GLSet.RET_RECURLY_V2, Env.STG, stgToken),
          getConfigValue(GLSet.PROMO_RECURLY, Env.PROD, prodToken),
          getConfigValue(GLSet.RET_RECURLY_V2, Env.PROD, prodToken),
        ]);
        const stgPromotionConfig: ConfigurationValue = configs[0];
        const stgRetentionConfig: RetentionConfigurationValue = configs[1];
        const prodPromotionConfig: ConfigurationValue = configs[2];
        const prodRetentionConfig: RetentionConfigurationValue = configs[3];
        let offers: OfferModel[] = [];
        let retentionOffers: RetentionOfferModel[] = [];

        for (const storeModel of storeModels) {
          offers = await Offer.findAll({
            include: [{ model: Plan }],
            ...OFFER_QUERY_OPTS,
            where: {
              storeCode: storeModel.storeCode,
            },
          });

          const glOffers = getAllGlOffers(
            stgPromotionConfig,
            stgRetentionConfig,
            prodPromotionConfig,
            prodRetentionConfig,
            storeModel.regionCode,
          );
          const stgCountry = getRetentionOfferCountry(
            storeModel.regionCode,
            stgRetentionConfig,
          );
          const prodCountry = getRetentionOfferCountry(
            storeModel.regionCode,
            prodRetentionConfig,
          );
          if (offers && offers.length > 0) {
            message = 'Offers found';
            // 1) separate draft, stage and prod offers from the database queried results
            const draftOffers = [];
            const stageOffers = [];
            const prodOffers = [];
            for (const offer of offers) {
              if (offer.statusId > StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(offer);
              } else if (offer.statusId === StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(offer);
              } else if (offer.statusId >= StatusEnum.STG_ERR_CRT) {
                if (offer.couponId) {
                  stageOffers.push(offer);
                } else {
                  draftOffers.push(offer);
                }
              } else if (offer.statusId >= StatusEnum.DFT) {
                draftOffers.push(offer);
              }
            }

            // 2) get draft recurly plans and map draft results
            const ids = [...new Set(draftOffers.map((of) => of.Plan.planId))];
            const recurlyPlansOfDrafts = await Recurly.getPlansRecurlyPayload(
              ids,
              storeModel,
              Env.PROD,
            );
            for (const plan of recurlyPlansOfDrafts) {
              cachedPlans[plan.planCode] = plan;
            }
            for (const model of draftOffers) {
              for (const pl of recurlyPlansOfDrafts) {
                if (model.Plan.planId === pl.planId) {
                  const draft = JSON.parse(JSON.stringify(model.draftData));
                  if (!draft) {
                    logger.error(
                      `Invalid draft offer ${
                        model.offerCode
                      } on ${Env.STG.toUpperCase()}`,
                    );
                    continue;
                  }
                  draft.discountAmount =
                    draft.discountType === DiscountType.FIXED_PRICE
                      ? (pl.price - draft.discountAmount).toFixed(2)
                      : draft.discountAmount;
                  model.draftData = draft;
                  results.push(await getOfferDraftPayload(model));
                  break;
                }
              }
            }
            // 3) get all stage offers from recurly
            const stResults = await Recurly.getOffersRecurlyPayload(
              stageOffers,
              storeModel,
              Env.STG,
              glOffers.get(Env.STG),
            );

            // 4) get all prod offers from recurly
            const prResults = await Recurly.getOffersRecurlyPayload(
              prodOffers,
              storeModel,
              Env.PROD,
              glOffers.get(Env.PROD),
            );

            results = await loadContentfulDataAndMergeEnvs(
              results,
              false,
              stResults,
              prResults,
              storeModel.storeCode,
              !!storeCode,
            );
          }
          retentionOffers = await RetentionOffer.findAll({
            ...RETENTION_OFFER_QUERY_OPTS,
            where: {
              storeCode: storeModel.storeCode,
            },
          });
          if (retentionOffers && retentionOffers.length > 0) {
            message = 'Offers found';
            // 1) separate draft, stage and prod offers from the database queried results
            const draftOffers = [];
            const stageOffers = [];
            const prodOffers = [];
            for (const retentionOffer of retentionOffers) {
              if (retentionOffer.statusId > StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(retentionOffer);
              } else if (retentionOffer.statusId === StatusEnum.PROD_ERR_PUB) {
                prodOffers.push(retentionOffer);
                // }
              } else if (retentionOffer.statusId >= StatusEnum.STG_ERR_CRT) {
                if (retentionOffer.couponId) {
                  stageOffers.push(retentionOffer);
                } else {
                  draftOffers.push(retentionOffer);
                }
              } else if (retentionOffer.statusId >= StatusEnum.DFT) {
                draftOffers.push(retentionOffer);
              }
            }

            // 2) get draft recurly plans and map draft results
            for (const model of draftOffers) {
              const planCode = model.eligiblePlans.split(',')[0];
              let plan = cachedPlans[planCode];
              if (!plan) {
                plan = await Recurly.getPlanRecurlyPayload(
                  planCode,
                  storeModel,
                  Env.PROD,
                );
                cachedPlans[planCode] = plan;
              }
              const draft = JSON.parse(JSON.stringify(model.draftData));
              draft.discountAmount =
                draft.discountType === DiscountType.FIXED_PRICE
                  ? (plan.price - draft.discountAmount).toFixed(2)
                  : draft.discountAmount;
              model.draftData = draft;
              results.push(await getRetentionOfferDraftPayload(model));
            }

            // 3) get all stage offers from recurly
            const stResults = await Recurly.getRetentionOffersRecurlyPayload(
              stageOffers,
              storeModel,
              Env.STG,
              glOffers.get(Env.STG),
              stgCountry,
            );

            // 4) get all prod offers from recurly
            const prResults = await Recurly.getRetentionOffersRecurlyPayload(
              prodOffers,
              storeModel,
              Env.PROD,
              glOffers.get(Env.PROD),
              prodCountry,
            );
            results = await loadContentfulDataAndMergeEnvs(
              results,
              true,
              stResults,
              prResults,
              storeModel.storeCode,
              !!storeCode,
            );
          }
        }
        results = results.sort((a, b) => {
          return (
            compareRankings(a.Status.sortPriority, b.Status.sortPriority) ||
            compareDates(a.endDateTime, b.endDateTime)
          );
        });

        // pull offers to environment's DB
        let finalResults: any[] = [];
        for (let offer of offers) {
          if (!offer.draftData) {
            const draftData = results.find(
              (remoteOffer) => remoteOffer.offerCode === offer.offerCode,
            );
            if (!!draftData) {
              offer.set('draftData', JSON.parse(JSON.stringify(draftData)));
              await offer.save();
              finalResults.push(getOfferPayload(offer));
            }
          } else {
            finalResults.push(getOfferPayload(offer));
          }
        }
        for (let retentionOffer of retentionOffers) {
          if (!retentionOffer.draftData) {
            const draftData = results.find(
              (remoteOffer) =>
                remoteOffer.offerCode === retentionOffer.offerCode,
            );
            if (!!draftData) {
              retentionOffer.set(
                'draftData',
                JSON.parse(JSON.stringify(draftData)),
              );
              await retentionOffer.save();
              finalResults.push(getRetentionOfferPayload(retentionOffer));
            }
          } else {
            finalResults.push(getRetentionOfferPayload(retentionOffer));
          }
        }
        finalResults = finalResults.sort((a, b) => {
          // return compareRankings(a.Status.sortPriority, b.Status.sortPriority) || compareDates(a.endDateTime, b.endDateTime);
          return (
            compareRankings(a.Status.sortPriority, b.Status.sortPriority) ||
            compareDates(a.createdAtDate, b.createdAtDate)
          );
        });

        retWithSuccess(req, res, {
          message: message,
          data: finalResults,
        });
      } else {
        // no plan for the store code, thus no offers
        retWithSuccess(req, res, {
          message: `No plan and offer found for store (${store})`,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`${logPrefix()} putAllOffers failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);
