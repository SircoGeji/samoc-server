import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidAppCopyValue,
  AndroidCountry,
  AndroidCountryLanguage,
  AndroidLanguage,
  AndroidProduct,
  AndroidSkuValue,
  AndroidStore,
  AndroidStoreCopy,
  AndroidStoreCopyValue,
} from '../../models';
import { AndroidLanguageModel } from 'src/models/android/Language';
import { processOfferError } from '../../util/utils';
import { AndroidCountryLanguageModel } from 'src/models/android/CountryLanguage';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { AndroidCountryModel } from 'src/models/android/Country';
import { getCurrentDate } from '.';
import { AndroidAppCopyValueModel } from 'src/models/android/AppCopyValue';
import { AndroidSkuValueModel } from 'src/models/android/SkuValue';
import { AndroidStoreCopyValueModel } from 'src/models/android/StoreCopyValue';
import { AndroidStoreCopyModel } from 'src/models/android/StoreCopy';
import { AndroidModuleStatus } from '../../types/enum';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/language?store&product
 * Get all Android languages
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Languages Controller - getAllLanguage');
  updateSpinnerText('Getting all language modules...');
  try {
    let languagesArr: AndroidLanguageModel[] = [];
    if (req.query.store && req.query.product) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      const productModel: AndroidProductModel = await AndroidProduct.findOne({
        where: { path: req.query.product },
      });
      if (storeModel && productModel) {
        const storeId: number = storeModel.id;
        const productId: number = productModel.id;
        const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll({
          where: { storeId, productId },
        });
        if (countryModels.length) {
          let languagesIdSet = new Set<number>();
          for (let countryModel of countryModels) {
            const foundCountryLanguageModels = await AndroidCountryLanguage.findAll({
              where: { countryId: countryModel.id },
            });
            foundCountryLanguageModels.forEach((model) => {
              languagesIdSet.add(model.languageId);
            });
          }
          for (let languageId of Array.from(languagesIdSet)) {
            const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(languageId);
            if (languageModel) {
              languagesArr.push(languageModel);
            }
          }
        } else {
          throw new AppError('Language modules for such store and product in DB not found', 404);
        }
      } else {
        throw new AppError('Such Store and Product modules in DB not found', 404);
      }
    } else {
      languagesArr = await AndroidLanguage.findAll();
    }

    if (languagesArr) {
      let results: any[] = [];
      for (let language of languagesArr) {
        const isActive = await isLanguageActive(language.id);
        results.push({
          languageId: language.id,
          created: language.created,
          updated: language.updated,
          code: language.code,
          name: language.name,
          isActive,
        });
      }

      retWithSuccess(req, res, {
        message: 'Android languages found',
        status: 200,
        data: results,
      });
    } else {
      throw new AppError('Language modules in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Android getAllLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const isLanguageActive = async (languageId: number) => {
  const countryLanguageIndexes = new Set<number>();
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
    where: { languageId },
  });
  countryLanguageModels.forEach((model) => countryLanguageIndexes.add(model.id));
  let appCopyValueModels: AndroidAppCopyValueModel[] = await AndroidAppCopyValue.findAll();
  appCopyValueModels = appCopyValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  let skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll();
  skuValueModels = skuValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  const storeCopyValueModels: AndroidStoreCopyValueModel[] = await AndroidStoreCopyValue.findAll({
    where: { languageId },
  });
  if (appCopyValueModels.length || skuValueModels.length || storeCopyValueModels.length) {
    return true;
  } else {
    return false;
  }
};

/**
 * GET /api/android/language/:languageId
 * Get Android language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Languages Controller - getLanguage');
  updateSpinnerText('Getting language module...');
  try {
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(req.params.languageId);

    let message = `No such Android language found`;
    if (languageModel) {
      message = `Android language found`;
      const isActive = await isLanguageActive(languageModel.id);
      const result = {
        languageId: languageModel.id,
        created: languageModel.created,
        updated: languageModel.updated,
        code: languageModel.code,
        name: languageModel.name,
        isActive,
      };

      retWithSuccess(req, res, {
        message,
        status: 200,
        data: result,
      });
    } else {
      retWithSuccess(req, res, {
        message,
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android getLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/android/language/save
 * Save Android language
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Languages Controller - saveLanguage');
  updateSpinnerText('Saving language module...');
  try {
    const languageDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!req.body.createdBy ? req.body.createdBy : null,
      name: req.body.name,
      code: req.body.code,
    };

    const languageResult = await AndroidLanguage.create(languageDBPayload);
    await updateModulesStatus();

    retWithSuccess(req, res, {
      message: `Android ${languageResult.name} language saved in DB successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Android saveLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateModulesStatus = async () => {
  const languageModels: AndroidLanguageModel[] = await AndroidLanguage.findAll();
  const storeCopyModels: AndroidStoreCopyModel[] = await AndroidStoreCopy.findAll();
  for (let storeCopyModel of storeCopyModels) {
    //check StoreCopyValue models
    const storeCopyValueModels: AndroidStoreCopyValueModel[] = await AndroidStoreCopyValue.findAll({
      where: { storeCopyId: storeCopyModel.id },
    });
    let languageIndexes = new Set<number>();
    if (storeCopyValueModels.length) {
      storeCopyValueModels.forEach((model) => languageIndexes.add(model.languageId));
    }
    if (storeCopyModel.status === AndroidModuleStatus.READY && languageIndexes.size < languageModels.length) {
      storeCopyModel.set('status', AndroidModuleStatus.DRAFT);
      storeCopyModel.set('updated', getCurrentDate());
      await storeCopyModel.save();
    } else if (storeCopyModel.status === AndroidModuleStatus.DRAFT && languageModels.length === languageIndexes.size) {
      storeCopyModel.set('status', AndroidModuleStatus.READY);
      storeCopyModel.set('updated', getCurrentDate());
      await storeCopyModel.save();
    }
  }
};

/**
 * PUT /api/android/language/:languageId/update
 * Update Android language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Languages Controller - updateLanguage');
  updateSpinnerText('Updating language module...');
  try {
    const languageId: number = Number(req.params.languageId);
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(languageId);

    let message = `No such Android language found`;
    if (languageModel) {
      languageModel.set('code', req.body.code);
      languageModel.set('name', req.body.name);
      languageModel.set('updated', getCurrentDate());
      const languageResult = await languageModel.save();

      retWithSuccess(req, res, {
        message: `Android ${languageResult.name} language updated successfully`,
        status: 201,
        data: {
          languageResult,
        },
      });
    } else {
      retWithSuccess(req, res, {
        message,
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android updateLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * DELETE /api/android/language/:languageId/delete
 * Delete Android language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Languages Controller - deleteLanguage');
  updateSpinnerText('Deleting language module...');
  try {
    const languageId: number = Number(req.params.languageId);
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(languageId);

    let message = `No such Android language found in DB`;
    if (languageModel) {
      await languageModel.destroy({ force: true });

      await updateModulesStatus();

      retWithSuccess(req, res, {
        message: `Android ${languageModel.name} language deleted successfully`,
        status: 201,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message,
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android deleteLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
