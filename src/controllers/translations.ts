import Logger from '../util/logger';
import { Env } from '../types/enum';
import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../models/SamocResponse';
import {
  getAccessToken,
  getCurrentConfigVersion,
  GLSet,
  OfferConfiguration,
  rollbackToVersion,
} from '../services/GhostLocker';
import { StoreTranslations } from '../models';
import { StoreTranslatedPayload, StoreTranslatedState } from '../types/payload';
import { StoreTranslatedStatus } from '../models/StoreTranslations';
import {
  getStoreModel,
  processOfferError,
  updateSpinnerText,
} from '../util/utils';
import {
  loadTranslations,
  updateTranslations,
} from '../services/StoreTranslated';
import { AppError } from '../util/errorHandler';

const logger = Logger(module);

const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get Store Translations Controller:`;
  } else {
    return `Get Store Translations:`;
  }
};

const baseEnv = (): Env =>
  (process.env.TRANSLATIONS_BASE_ENV || Env.PROD) as Env;
const stgEnv = (): Env => (process.env.TRANSLATIONS_STG_ENV || Env.STG) as Env;
const prodEnv = (): Env =>
  (process.env.TRANSLATIONS_PROD_ENV || Env.PROD) as Env;

const getLastTranslated = async () => {
  const translations = await StoreTranslations.findAll({
    order: [['createdAt', 'DESC']],
  });
  return translations.length > 0 ? translations[0] : null;
};

const getGlStgVersion = async (): Promise<number> => {
  const token = await getAccessToken(stgEnv());
  return getCurrentConfigVersion(stgEnv(), token, GLSet.PROMO_TRANSLATED);
};

const getGlProdVersion = async (): Promise<number> => {
  const token = await getAccessToken(prodEnv());
  return getCurrentConfigVersion(prodEnv(), token, GLSet.PROMO_TRANSLATED);
};

const getStoreTranslatedState = async () => {
  const lastTranslated = await getLastTranslated();
  const stgVer = await getGlStgVersion();
  const prodVer = await getGlProdVersion();
  const result: StoreTranslatedState = {
    stgVer,
    prodVer,
    status: StoreTranslatedStatus.NEW,
    canDelete: false,
    canRetire: false,
    errorMessage: null,
  };
  if (lastTranslated) {
    result.status = lastTranslated.statusId;
    result.updatedBy = lastTranslated.createdBy;
    result.updatedAt = lastTranslated.get('CreatedAt') as Date;
    if (lastTranslated.statusId === StoreTranslatedStatus.STG) {
      if (lastTranslated.stgRollbackVersion === stgVer) {
        result.canRetire = true;
      } else {
        result.errorMessage =
          'Store translated settings were updated on STG, please check your configuration';
        await lastTranslated.destroy({ force: true });
      }
    } else if (lastTranslated.statusId === StoreTranslatedStatus.PROD) {
      if (lastTranslated.prodRollbackVersion === prodVer) {
        result.canRetire = true;
      }
    }
  }
  return result;
};

const checkRevisions = async (state: StoreTranslatedState) => {
  const currentState = await getStoreTranslatedState();
  if (currentState.stgVer != state.stgVer) {
    return 'Store translations configuration was modified on STG';
  }
  return null;
};

/**
 * GET /api/translations
 * Get store translations data
 * @param {Request}     req
 * @param {Response}    res
 */
export const getStoreTranslations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Store Translated Controller - getStoreTranslated');
    const translatedState = await getStoreTranslatedState();
    const env =
      translatedState.status === StoreTranslatedStatus.STG
        ? stgEnv()
        : baseEnv();

    try {
      const translationsResponse = (await loadTranslations(
        env as Env,
      )) as OfferConfiguration;
      const translations = JSON.parse(translationsResponse.configurationValue);

      const result: StoreTranslatedPayload = {
        translatedState,
        translations,
      };
      retWithSuccess(req, res, {
        message: 'Store translations loaded successfully',
        data: result,
      });
    } catch (err) {
      logger.error(
        `${logPrefix()} getStoreTranslations failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

/**
 * PUT api/translations?publish=<true|false>
 * Update store translations
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateStoreTranslations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { publish } = req.query;
    const isProd = publish === 'true';
    const env = isProd ? prodEnv() : stgEnv();
    try {
      const payload = req.body as StoreTranslatedPayload;
      updateSpinnerText('Updating store translations...');

      if (
        payload.translatedState.status !== StoreTranslatedStatus.STG &&
        isProd
      ) {
        return next(
          processOfferError(
            new AppError(
              `Workflow violation - create store translations on stage before publishing`,
              400,
            ),
          ),
        );
      }
      let lastTranslated = await getLastTranslated();
      if (
        lastTranslated &&
        lastTranslated.statusId === StoreTranslatedStatus.STG &&
        (lastTranslated.statusId != payload.translatedState.status ||
          lastTranslated.stgRollbackVersion != payload.translatedState.stgVer)
      ) {
        return next(
          processOfferError(
            new AppError(
              `Store translations were modified by another user (${lastTranslated.createdBy})`,
              400,
            ),
          ),
        );
      }

      const checkError = await checkRevisions(payload.translatedState);
      if (checkError) {
        if (lastTranslated) {
          await lastTranslated.destroy();
        }
        return next(processOfferError(new AppError(checkError, 400)));
      }

      if (
        !lastTranslated ||
        lastTranslated.statusId === StoreTranslatedStatus.PROD
      ) {
        lastTranslated = await StoreTranslations.build({
          statusId: StoreTranslatedStatus.NEW,
          stgRollbackVersion: 0,
          prodRollbackVersion: 0,
        });
      }

      if (isProd && stgEnv() === prodEnv()) {
        lastTranslated.prodRollbackVersion = lastTranslated.stgRollbackVersion;
        lastTranslated.statusId = StoreTranslatedStatus.PROD;
      } else {
        const result = await updateTranslations(
          payload.translations,
          env,
          payload.translatedState.updatedBy ?? 'Unknown',
        );
        lastTranslated.createdBy = payload.translatedState.updatedBy;
        if (isProd) {
          lastTranslated.prodRollbackVersion = result.configurationVersion;
          lastTranslated.statusId = StoreTranslatedStatus.PROD;
        } else {
          lastTranslated.stgRollbackVersion = result.configurationVersion;
          lastTranslated.statusId = StoreTranslatedStatus.STG;
        }
      }
      await lastTranslated.save();

      retWithSuccess(req, res, {
        message: `Store translations updated successfully`,
        data: {},
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * PUT /api/translations/rollback?store=<storeCode>
 * Rollback store translations
 * @param {Request}     req
 * @param {Response}    res
 */
export const rollbackStoreTranslations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { store, publish } = req.query;
    const storeCode = store as string;
    const storeModel = await getStoreModel(storeCode);
    const payload = req.body as StoreTranslatedState;
    updateSpinnerText('Rolling back store translations...');
    const lastTranslated = await getLastTranslated();
    if (!lastTranslated) {
      return next(
        processOfferError(
          new AppError(`Can't retire non-existent store translations`, 400),
        ),
      );
    }
    if (
      lastTranslated &&
      (lastTranslated.statusId !== payload.status ||
        lastTranslated.stgRollbackVersion != payload.stgVer ||
        (lastTranslated.statusId === StoreTranslatedStatus.PROD &&
          lastTranslated.prodRollbackVersion != payload.prodVer))
    ) {
      return next(
        processOfferError(
          new AppError(
            `Store translations were modified by another user (${lastTranslated.createdBy})`,
            400,
          ),
        ),
      );
    }
    const checkError = await checkRevisions(payload);
    if (checkError) {
      return next(processOfferError(new AppError(checkError, 400)));
    }
    try {
      if (
        stgEnv() !== prodEnv() &&
        lastTranslated.statusId === StoreTranslatedStatus.PROD
      ) {
        await rollbackToVersion(
          GLSet.PROMO_TRANSLATED,
          '',
          lastTranslated.prodRollbackVersion - 1,
          prodEnv(),
        );
      }
      await rollbackToVersion(
        GLSet.PROMO_TRANSLATED,
        '',
        lastTranslated.stgRollbackVersion - 1,
        stgEnv(),
      );
      await lastTranslated.destroy();
      retWithSuccess(req, res, {
        message: `Store translations successfully rolled back`,
        data: {},
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);
