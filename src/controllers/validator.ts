import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { Store } from '../models';
import asyncHandler from 'express-async-handler';
import {
  getExtensionOfferModel,
  getOfferModel,
  getPlanModel,
  getRetentionOfferModel,
} from '../util/utils';
import { AppError } from '../util/errorHandler';
import * as Recurly from '../services/Recurly';
import * as Contentful from '../services/Contentful';
import * as GhostLocker from '../services/GhostLocker';
import { Env, OfferTypes } from '../types/enum';
import { PlanRecurlyPayload } from '../types/payload';
import { StoreModel } from '../models/Store';
import { SKIP_GL_PROD_VALIDATION } from '../util/config';

const logger = Logger(module);

/**
 * GET //api/validator/:storeId/:planCode
 * Validate plan code - ensure plan code *DOES* exist before proceeding (Phase 2)
 * TODO:  Next phase, we will ensure it *DOES NOT* exist before proceeding (Phase 3+, TBD)
 *
 * @param {Request}     req
 * @param {Response}    res
 */
export const validatePlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Validate Controller - validatePlan');
    const { storeId, planCode } = req.params;

    // First, get store model by storeId
    const store: StoreModel = await Store.findByPk(storeId);
    if (!store) {
      next(
        new AppError(
          `Store '${storeId}' not found or invalid, unable to verify.`,
          400,
        ),
      );
    }

    // Ensure Plan Code does not exist in the database
    // Phase 2/3+: should not exist in the database
    const validateDb = async (): Promise<boolean> => {
      const model = await getPlanModel(planCode);
      if (model) {
        next(
          new AppError(
            `Plan with code = ${planCode} already exists in SAMOC.`,
            409,
          ),
        );
      }
      return true;
    };

    // Valid Plan Code on Recurly
    // Phase 2 - Ensure Plan Code does *EXIST* on STG and PROD
    // Phase 3+ - Ensure Plan Code does *NOT* exist on STG and PROD
    const validateRecurly = async (
      store: StoreModel,
      env: Env,
    ): Promise<any> => {
      let result: PlanRecurlyPayload;
      try {
        result = await Recurly.getPlanRecurlyPayload(planCode, store, env);
      } catch (err) {
        result = null; // return null in future Phase
        if (err.statusCode === 404) {
          next(
            new AppError(
              `${err.message} on Recurly ${env.toUpperCase()}.`,
              404,
            ),
          );
        } else {
          next(
            new AppError(
              `${err.message} on Recurly ${env.toUpperCase()}.`,
              err.statusCode,
            ),
          );
        }
      }
      if (result && result.state === 'active') {
        return { validity: true, result: result };
      } else {
        next(
          new AppError(
            `Plan with code = ${planCode} is ${
              result && result.state ? result.state : 'Undefined'
            } on Recurly ${env.toUpperCase()}.`,
            404,
          ),
        );
      }
    };

    // run step 1-3 together and if any reject will throw error
    let planPayload = null;
    const promises = [validateDb(), validateRecurly(store, Env.STG)];
    if (store.rlyApiKeyProd) {
      promises.push(validateRecurly(store, Env.PROD));
    }
    await Promise.all(promises)
      .then((data) => {
        console.debug('validatePlan results', data);
        planPayload = data.pop().result;
      })
      .catch((errs: any) => {
        console.error('validatePlan errors', errs);
      });
    retWithSuccess(req, res, {
      message: `Plan Code '${planCode}' is good to use.`,
      data: planPayload,
    });
  },
);

/**
 * GET /api/validator/:storeId/:planCode/:offerCode
 * Validate offer code
 * @param {Request}     req
 * @param {Response}    res
 */
export const validateOffer = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Validate Controller - validateOffer');
    const { storeId, offerCode } = req.params;
    const offerTypeId = Number(req.query.offerTypeId);

    // get store model by storeId
    const store = await Store.findByPk(storeId);

    // check record does not exist on db
    const validateDb = async (): Promise<boolean> => {
      switch (offerTypeId) {
        case OfferTypes.ACQUISITION:
        case OfferTypes.WINBACK:
          const model = await getOfferModel(storeId, offerCode);
          if (model) {
            next(
              new AppError(
                `Offer code '${offerCode}' already exists in the database`,
                409,
              ),
            );
          }
          return true;
        case OfferTypes.RETENTION:
          const retentionModel = await getRetentionOfferModel(
            storeId,
            offerCode,
          );
          if (retentionModel) {
            next(
              new AppError(
                `Offer code '${offerCode}' already exists in the database`,
                409,
              ),
            );
          }
          return true;
        case OfferTypes.EXTENSION:
          const extensionModel = await getExtensionOfferModel(
            storeId,
            offerCode,
          );
          if (extensionModel) {
            next(
              new AppError(
                `Offer code '${offerCode}' already exists in the database`,
                409,
              ),
            );
          }
          return true;
      }
    };

    // check record does not exist on recurly, if it does, it is still okay if archived
    const validateRecurly = async (env: Env): Promise<boolean> => {
      try {
        const result = await Recurly.getOfferRecurlyPayload(
          offerCode,
          store,
          env,
        );
        if (result && result.couponState.toLowerCase() !== 'expired') {
          next(
            new AppError(
              `Offer code '${offerCode}' already exists on Recurly ${env.toUpperCase()}.`,
              409,
            ),
          );
        } else {
          return true;
        }
      } catch (err) {
        if (err.statusCode === 404) {
          return true;
        } else {
          if (
            err.statusCode === 401 ||
            err.message.toLowerCase().indexOf('invalid api key')
          ) {
            next(
              new AppError(err.message, err.statusCode ? err.statusCode : 401),
            );
          } else {
            next(
              new AppError(err.message, err.statusCode ? err.statusCode : 500),
            );
          }
        }
      }
    };

    // check gl
    const validateGL = async (env: Env) => {
      // check prod
      // check stage
      if (
        !(await GhostLocker.promoOfferExists(
          offerCode,
          store.regionCode,
          env,
        )) &&
        !(await GhostLocker.retentionOfferExists(
          offerCode,
          store.regionCode,
          env,
        ))
      ) {
        return true;
      }
      next(
        new AppError(
          `Offer code '${offerCode}' already exists on GhostLocker ${env.toUpperCase()}.`,
          409,
        ),
      );
    };

    // check contentful
    const validateContentful = async () => {
      try {
        const result = await Contentful.couponExists(
          store.regionCode,
          offerCode,
          storeId,
        );
        if (result) {
          next(
            new AppError(
              `Offer code '${offerCode}' already exists on Contentful.`,
              409,
            ),
          );
        } else {
          return true;
        }
      } catch (err) {
        if (err.statusCode === 404) {
          return true;
        } else {
          next(new AppError(err.message, err.statusCode));
        }
      }
    };

    // run step 2 - 6 together and if any reject will throw error
    await Promise.all([
      validateDb(),
      validateRecurly(Env.STG),
      ...(store.rlyApiKeyProd ? [validateRecurly(Env.PROD)] : []),
      validateGL(Env.STG),
      ...(SKIP_GL_PROD_VALIDATION ? [] : [validateGL(Env.PROD)]),
      validateContentful(),
    ]).then((data) => {
      logger.debug('Validator: All promises resolved', { results: data });
    });
    retWithSuccess(req, res, {
      message: `Offer code '${offerCode}' is valid and good to use.`,
      data: null,
    });
  },
);
