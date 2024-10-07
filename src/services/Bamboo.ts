import Logger from '../util/logger';
import axios from 'axios';
import pRetry from 'p-retry';
import { Request } from 'express';
import {
  BambooApiCfg,
  rollbackOfferForValidate,
  rollbackRetentionOfferForValidate,
} from '../controllers/offers/validateOffer';
import { Offer, RetentionOffer } from '../models';
import { Env, StatusEnum } from '../types/enum';
import { io } from '../server';
import {
  getOfferModel,
  getRetentionOfferModel,
  getTargetEnv,
  OFFER_QUERY_OPTS,
  RETENTION_OFFER_QUERY_OPTS,
  pRetryOptions,
  updateOfferStatus,
  updateRetentionOfferStatus,
} from '../util/utils';
import {
  AppError,
  BambooIsBusyError,
  BambooIsOfflineError,
} from '../util/errorHandler';
import * as httpContext from 'express-http-context';
import { DISABLE_ROLLBACK } from '../util/config';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Bamboo:`;
  } else {
    return `Bamboo:`;
  }
};
const BAMBOO_REST_ENDPOINT = process.env.BAMBOO_REST_ENDPOINT;
const BAMBOO_SVC_USER_ID = process.env.BAMBOO_SVC_USER_ID;
const BAMBOO_SVC_USER_PWD = process.env.BAMBOO_SVC_USER_PWD;

export const build = async (cfg: BambooApiCfg): Promise<BuildResponse> => {
  logger.debug(`${logPrefix(cfg.valdnEnv)} Triggering Bamboo Build`);
  const buildOp = async () => {
    const resp = await axios({
      method: 'POST',
      url: `${BAMBOO_REST_ENDPOINT}`,
      params: {
        'bamboo.variable.OFFERS_URL': `${cfg.offersUrl}`,
        'bamboo.variable.OFFER_TYPE': `${cfg.offerType}`,
        'bamboo.variable.PROMO_CODE': `${cfg.offerCode}`,
        'bamboo.variable.VALDN_ENV': `${cfg.valdnEnv}`,
      },
      auth: {
        username: `${BAMBOO_SVC_USER_ID}`,
        password: `${BAMBOO_SVC_USER_PWD}`,
      },
    });

    return resp.data as BuildResponse;
  };
  try {
    return await pRetry(buildOp, pRetryOptions);
  } catch (err) {
    logger.error(
      `${logPrefix(cfg.valdnEnv)} Failed to trigger Bamboo build for ${
        cfg.offerCode
      }, ${err.message}`,
      err,
    );
    if (
      err.response.status === 400 &&
      err.response.data.message.indexOf(
        'you have reached the maximum number of concurrent builds allowed',
      ) > -1
    ) {
      // Bamboo is busy, no need to rollback, can retry.
      throw new BambooIsBusyError(
        `Another offer is being validated on Bamboo, please try again in a few minutes.`,
        400,
      );
    } else if (err.response.status === 503) {
      // Bamboo is offline, no need to rollback, can retry.
      throw new BambooIsOfflineError(
        `Bamboo may be down for scheduled maintenance. Please retry publishing the offer later.`,
        503,
      );
    } else {
      throw new AppError(
        `Bamboo: Failed to trigger build for ${cfg.offerCode}, ${err.message}`,
        err.statusCode ? err.statusCode : 500,
      );
    }
  }
};

export const webhookConsumer = async (
  req: Request,
): Promise<WebhookPayload> => {
  logger.debug(`Bamboo: webhookConsumer triggered`);
  const whObj = req.body as WebhookPayload;
  const { updatedBy } = req.query;

  const buildKey: string = whObj.build.key;
  const buildStatus: string = whObj.build.status; //SUCCESS

  const offer = await Offer.findOne({
    ...OFFER_QUERY_OPTS,
    where: { bambooBuildKey: buildKey },
  });
  if (offer) {
    const offerCode = offer.offerCode;
    const targetEnv = getTargetEnv(offer);
    httpContext.set('offerCode', offerCode);
    httpContext.set('planCode', offer.planCode);
    httpContext.set('env', targetEnv);
    offer.bambooBuildKey = null;
    logger.debug(`Bamboo: Offer found, processing build result`, {
      offerCode: offerCode,
      planCode: offer.planCode,
      env: targetEnv,
      buildStatus: buildStatus,
    });
    if (buildStatus === 'SUCCESS') {
      await updateOfferStatus(
        offer,
        targetEnv === Env.PROD
          ? StatusEnum.PROD_VALDN_PASS
          : StatusEnum.STG_VALDN_PASS,
      );
    } else {
      // rollback offer on Bamboo validation failed (offer code will be dead)
      if (!DISABLE_ROLLBACK) {
        await rollbackOfferForValidate(offer, targetEnv, updatedBy as string);
      }
      await updateOfferStatus(
        offer,
        targetEnv === Env.PROD
          ? StatusEnum.PROD_VALDN_FAIL
          : StatusEnum.STG_VALDN_FAIL,
      );
    }
    const updatedOffer = await getOfferModel(offer.storeCode, offerCode);
    io.emit('offer-status-updated', updatedOffer.toJSON());
  } else {
    const offer = await RetentionOffer.findOne({
      ...RETENTION_OFFER_QUERY_OPTS,
      where: { bambooBuildKey: buildKey },
    });
    if (offer) {
      const storeCode = offer.storeCode;
      const offerCode = offer.offerCode;
      const targetEnv = getTargetEnv(offer);
      httpContext.set('offerCode', offerCode);
      httpContext.set('env', targetEnv);
      offer.bambooBuildKey = null;
      logger.debug(`Bamboo: Offer found, processing build result`, {
        offerCode: offerCode,
        env: targetEnv,
        buildStatus: buildStatus,
      });
      if (buildStatus === 'SUCCESS') {
        await updateRetentionOfferStatus(
          offer,
          targetEnv === Env.PROD
            ? StatusEnum.PROD_VALDN_PASS
            : StatusEnum.STG_VALDN_PASS,
        );
      } else {
        // rollback offer on Bamboo validation failed (offer code will be dead)
        if (!DISABLE_ROLLBACK) {
          await rollbackRetentionOfferForValidate(offer, targetEnv, updatedBy as string);
        }
        await updateRetentionOfferStatus(
          offer,
          targetEnv === Env.PROD
            ? StatusEnum.PROD_VALDN_FAIL
            : StatusEnum.STG_VALDN_FAIL,
        );
      }
      const updatedOffer = await getRetentionOfferModel(storeCode, offerCode);
      io.emit('offer-status-updated', updatedOffer.toJSON());
    }
  }
  return whObj;
};

interface Link {
  href: string;
  rel: string;
}

export interface BuildResponse {
  planKey: string;
  buildNumber: number;
  buildResultKey: string;
  triggerReason: string;
  link: Link;
}

interface Plan {
  name: string;
  key: string;
  url: string;
}

interface Job {
  name: string;
  url: string;
  status: string;
  duration: string;
  summary: string;
}

interface Stage {
  name: string;
  jobs: Job[];
}

interface Build {
  key: string;
  number: number;
  trigger: string;
  url: string;
  status: string;
  summary: string;
  stages: Stage[];
  custom_build: boolean;
  branch_build: boolean;
}

export interface WebhookPayload {
  id: string;
  time: Date;
  plan: Plan;
  build: Build;
  project_name: string;
}
