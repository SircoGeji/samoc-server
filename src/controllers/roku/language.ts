import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuAppCopyValue,
  RokuCountry,
  RokuCountryLanguage,
  RokuLanguage,
  RokuProduct,
  RokuSkuValue,
  RokuStore,
  RokuStoreCopy,
  RokuStoreCopyValue,
} from '../../models';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { processOfferError } from '../../util/utils';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuCountryModel } from 'src/models/roku/Country';
import { getCurrentDate } from '.';
import { RokuAppCopyValueModel } from 'src/models/roku/AppCopyValue';
import { RokuSkuValueModel } from 'src/models/roku/SkuValue';
import { RokuStoreCopyValueModel } from 'src/models/roku/StoreCopyValue';
import { RokuStoreCopyModel } from 'src/models/roku/StoreCopy';
import { RokuModuleStatus } from '../../types/enum';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/language?store&product
 * Get all Roku languages
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Languages Controller - getAllLanguage');
  updateSpinnerText('Getting all language modules...');
  try {
    let languagesArr: RokuLanguageModel[] = [];
    if (req.query.store && req.query.product) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      const productModel: RokuProductModel = await RokuProduct.findOne({
        where: { path: req.query.product },
      });
      if (storeModel && productModel) {
        const storeId: number = storeModel.id;
        const productId: number = productModel.id;
        const countryModels: RokuCountryModel[] = await RokuCountry.findAll({
          where: { storeId, productId },
        });
        if (countryModels.length) {
          let languagesIdSet = new Set<number>();
          for (let countryModel of countryModels) {
            const foundCountryLanguageModels = await RokuCountryLanguage.findAll({
              where: { countryId: countryModel.id },
            });
            foundCountryLanguageModels.forEach((model) => {
              languagesIdSet.add(model.languageId);
            });
          }
          for (let languageId of Array.from(languagesIdSet)) {
            const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(languageId);
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
      languagesArr = await RokuLanguage.findAll();
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
        message: 'Roku languages found',
        status: 200,
        data: results,
      });
    } else {
      throw new AppError('Language modules in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Roku getAllLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const isLanguageActive = async (languageId: number) => {
  const countryLanguageIndexes = new Set<number>();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
    where: { languageId },
  });
  countryLanguageModels.forEach((model) => countryLanguageIndexes.add(model.id));
  let appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll();
  appCopyValueModels = appCopyValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  let skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll();
  skuValueModels = skuValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
    where: { languageId },
  });
  if (appCopyValueModels.length || skuValueModels.length || storeCopyValueModels.length) {
    return true;
  } else {
    return false;
  }
};

/**
 * GET /api/roku/language/:languageId
 * Get Roku language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Languages Controller - getLanguage');
  updateSpinnerText('Getting language module...');
  try {
    const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(req.params.languageId);

    let message = `No such Roku language found`;
    if (languageModel) {
      message = `Roku language found`;
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
    logger.error(`Roku getLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/language/save
 * Save Roku language
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Languages Controller - saveLanguage');
  updateSpinnerText('Saving language module...');
  try {
    const languageDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!req.body.createdBy ? req.body.createdBy : null,
      name: req.body.name,
      code: req.body.code,
    };

    const languageResult = await RokuLanguage.create(languageDBPayload);
    await updateModulesStatus();

    retWithSuccess(req, res, {
      message: `Roku ${languageResult.name} language saved in DB successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Roku saveLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateModulesStatus = async () => {
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
  const storeCopyModels: RokuStoreCopyModel[] = await RokuStoreCopy.findAll();
  for (let storeCopyModel of storeCopyModels) {
    //check StoreCopyValue models
    const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
      where: { storeCopyId: storeCopyModel.id },
    });
    let languageIndexes = new Set<number>();
    if (storeCopyValueModels.length) {
      storeCopyValueModels.forEach((model) => languageIndexes.add(model.languageId));
    }
    if (storeCopyModel.status === RokuModuleStatus.READY && languageIndexes.size < languageModels.length) {
      storeCopyModel.set('status', RokuModuleStatus.DRAFT);
      await storeCopyModel.save();
    } else if (storeCopyModel.status === RokuModuleStatus.DRAFT && languageModels.length === languageIndexes.size) {
      storeCopyModel.set('status', RokuModuleStatus.READY);
      await storeCopyModel.save();
    }
  }
};

/**
 * PUT /api/roku/language/:languageId/update
 * Update Roku language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Languages Controller - updateLanguage');
  updateSpinnerText('Updating language module...');
  try {
    const languageId: number = Number(req.params.languageId);
    const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(languageId);

    let message = `No such Roku language found`;
    if (languageModel) {
      languageModel.set('code', req.body.code);
      languageModel.set('name', req.body.name);
      const languageResult = await languageModel.save();

      retWithSuccess(req, res, {
        message: `Roku ${languageResult.name} language updated successfully`,
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
    logger.error(`Roku updateLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * DELETE /api/roku/language/:languageId/delete
 * Delete Roku language by languageId
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteLanguage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Languages Controller - deleteLanguage');
  updateSpinnerText('Deleting language module...');
  try {
    const languageId: number = Number(req.params.languageId);
    const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(languageId);

    let message = `No such Roku language found in DB`;
    if (languageModel) {
      await languageModel.destroy({ force: false });

      await updateModulesStatus();

      retWithSuccess(req, res, {
        message: `Roku ${languageModel.name} language deleted successfully`,
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
    logger.error(`Roku deleteLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});
