import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidCountry,
  AndroidLanguage,
  AndroidCountryLanguage,
  AndroidStore,
  AndroidProduct,
  AndroidAppCopyValue,
  AndroidSkuValue,
  AndroidSelectorConfigSku,
  AndroidAppCopy,
  AndroidSku,
  AndroidSelectorConfig,
  AndroidImageCollection,
} from '../../models';
import { AndroidCountryModel } from 'src/models/android/Country';
import { AndroidCountryLanguageModel } from 'src/models/android/CountryLanguage';
import { AndroidLanguageModel } from 'src/models/android/Language';
import { processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { getCurrentDate } from '.';
import { AndroidAppCopyValueModel } from 'src/models/android/AppCopyValue';
import { AndroidSkuValueModel } from 'src/models/android/SkuValue';
import { AndroidSelectorConfigSkuModel } from 'src/models/android/SelectorConfigSku';
import { AndroidAppCopyModel } from 'src/models/android/AppCopy';
import { AndroidModuleStatus } from '../../types/enum';
import { AndroidSkuModel } from 'src/models/android/Sku';
import { changeSelectorConfigModule } from './sku';
import { AndroidImageCollectionModel } from 'src/models/android/ImageCollection';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/country
 * Get all Android country
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CountryLanguages Controller - getAllCountryLanguages');
  updateSpinnerText('Getting all country modules...');
  try {
    let countryModels: AndroidCountryModel[] = [];
    if (req.query.store && req.query.product) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: {
          path: req.query.store,
        },
      });
      const productModel: AndroidProductModel = await AndroidProduct.findOne({
        where: {
          path: req.query.product,
        },
      });
      countryModels = await AndroidCountry.findAll({
        where: {
          storeId: storeModel.id,
          productId: productModel.id,
        },
      });
    } else {
      countryModels = await AndroidCountry.findAll();
    }

    let message = `No Android country modules found`;
    if (countryModels) {
      message = `Android country modules found`;
      let results: any[] = [];
      for (let countryModel of countryModels) {
        const result = await getCountryModelData(countryModel);
        results.push(result);
      }

      retWithSuccess(req, res, {
        message,
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message,
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android getAllCountryLanguages failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/country/:countryId
 * Get Android region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CountryLanguages Controller - getCountryLanguage');
  updateSpinnerText('Getting country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);
    const countryLanguagesModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
      where: { countryId },
    });
    const languagesModels: AndroidLanguageModel[] = await AndroidLanguage.findAll();
    let languages: string[] = [];

    let defaultLanguage: string = '';
    countryLanguagesModels.forEach((countryLanguageModel) => {
      const foundLanguageModel = languagesModels.find((languageModel) => {
        return languageModel.id === countryLanguageModel.languageId;
      });
      if (foundLanguageModel.code) {
        languages.push(foundLanguageModel.code);
      }
      if (countryLanguageModel.isDefault) {
        defaultLanguage = foundLanguageModel.code;
      }
    });

    let message = `No such Android country found`;
    if (countryModel && languages.length) {
      message = `Android country found`;
      const isActive = await isCountryActive(countryId);
      const result = {
        countryId,
        created: countryModel.created,
        updated: countryModel.updated,
        code: countryModel.code,
        name: countryModel.name,
        languages,
        defaultLanguage,
        isActive,
      };

      retWithSuccess(req, res, {
        message: message,
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
    logger.error(`Android getCountryLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCountryModelData = async (countryModel: AndroidCountryModel) => {
  const countryId = countryModel.id;
  let languages: any[] = [];
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
    where: { countryId },
  });

  let defaultLanguage: string = '';
  for (let countryLanguageModel of countryLanguageModels) {
    const language: AndroidLanguageModel = await AndroidLanguage.findByPk(countryLanguageModel.languageId);
    if (countryLanguageModel.isDefault) {
      defaultLanguage = language.code;
    }
    if (language) {
      languages = {
        ...languages,
        [language.code]: {
          name: language.name,
          code: language.code,
        },
      };
    }
  }
  const isActive = await isCountryActive(countryModel.id);

  return {
    created: countryModel.created,
    updated: countryModel.updated,
    code: countryModel.code,
    name: countryModel.name,
    languages,
    countryId: countryModel.id,
    storeId: countryModel.storeId,
    productId: countryModel.productId,
    defaultLanguage,
    isActive,
  };
};

/**
 * POST /api/android/country?store
 * Save Android region by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CountryLanguages Controller - saveCountryLanguages');
  updateSpinnerText('Saving country module...');
  let countryId: number;
  try {
    const storeModel: AndroidStoreModel = await AndroidStore.findOne({
      where: { path: req.query.store },
    });

    if (storeModel) {
      const storeId: number = storeModel.id;

      const product = req.query.product as string;
      const productModel: AndroidProductModel = await AndroidProduct.findOne({
        where: { path: product },
      });
      const productId: number = productModel.id;

      const countryDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!req.body.createdBy ? req.body.createdBy : null,
        storeId,
        productId,
        name: req.body.name,
        code: req.body.code,
        path: req.body.code.toLowerCase(),
      };
      const countryResult = await AndroidCountry.create(countryDBPayload);
      countryId = countryResult.id;
      await updateCountryLanguagesModels(countryId, req.body.languages, req.body.defaultLanguage);
      await updateModulesStatus(countryResult.storeId, countryResult.productId);

      retWithSuccess(req, res, {
        message: `Android ${countryResult.name} country module saved as draft successfully`,
        status: 201,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Android country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android saveCountryLanguages failed, ${err.message}`, err);

    // deleting incomplete records from DB
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);
    await countryModel.destroy({ force: true });

    return next(processOfferError(err));
  }
});

/**
 * POST /api/android/country/:countryId
 * Save Android region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CountryLanguages Controller - updateCountryLanguages');
  updateSpinnerText('Updating country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);

    if (countryModel) {
      countryModel.set('name', req.body.name);
      countryModel.set('code', req.body.code);
      countryModel.set('path', req.body.code.toLowerCase());
      countryModel.set('updated', getCurrentDate());
      const countryResult = await countryModel.save();

      await updateCountryLanguagesModels(countryId, req.body.languages, req.body.defaultLanguage);
      await updateModulesStatus(countryResult.storeId, countryResult.productId);

      retWithSuccess(req, res, {
        message: `Android ${countryResult.name} country module updated successfully`,
        status: 201,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Android country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android updateCountryLanguages failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateModulesStatus = async (storeId: number, productId: number) => {
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll({
    where: { storeId, productId },
  });
  let countryLanguageIndexes = new Set<number>();
  for (let countryModel of countryModels) {
    const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
      where: { countryId: countryModel.id },
    });
    if (countryLanguageModels.length) {
      for (let countryLanguageModel of countryLanguageModels) {
        countryLanguageIndexes.add(countryLanguageModel.id);
      }
    }
  }

  //check AppCopy models
  const appCopyModels: AndroidAppCopyModel[] = await AndroidAppCopy.findAll({
    where: { storeId, productId },
  });
  for (let appCopyModel of appCopyModels) {
    let appCopyValueCountryLanguageIndexes = new Set<number>();
    const appCopyValueModels: AndroidAppCopyValueModel[] = await AndroidAppCopyValue.findAll({
      where: { appCopyId: appCopyModel.id },
    });
    if (appCopyValueModels.length) {
      appCopyValueModels.forEach((model) => appCopyValueCountryLanguageIndexes.add(model.countryLanguageId));
    }
    if (
      appCopyModel.status === AndroidModuleStatus.READY &&
      countryLanguageIndexes.size !== appCopyValueCountryLanguageIndexes.size
    ) {
      appCopyModel.set('status', AndroidModuleStatus.DRAFT);
      appCopyModel.set('updated', getCurrentDate());
      await appCopyModel.save();
    } else if (
      appCopyModel.status === AndroidModuleStatus.DRAFT &&
      countryLanguageIndexes.size === appCopyValueCountryLanguageIndexes.size
    ) {
      appCopyModel.set('status', AndroidModuleStatus.READY);
      appCopyModel.set('updated', getCurrentDate());
      await appCopyModel.save();
    }
  }

  //check Sku models
  const skuModels: AndroidSkuModel[] = await AndroidSku.findAll({
    where: { storeId, productId },
  });
  for (let skuModel of skuModels) {
    let skuValueCountryLanguageIndexes = new Set<number>();
    const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
      where: { skuId: skuModel.id },
    });
    if (skuValueModels.length) {
      skuValueModels.forEach((model) => skuValueCountryLanguageIndexes.add(model.countryLanguageId));
    }
    let skuValueCountryIndexes = new Set<number>();
    for (let countryLanguageId of skuValueCountryLanguageIndexes) {
      const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
        countryLanguageId,
      );
      if (countryLanguageModel) {
        skuValueCountryIndexes.add(countryLanguageModel.countryId);
      }
    }
    if (skuModel.status === AndroidModuleStatus.COMPLETE && countryModels.length < skuValueCountryIndexes.size) {
      skuModel.set('status', AndroidModuleStatus.DRAFT);
      skuModel.set('updated', getCurrentDate());
      await skuModel.save();
      await changeSelectorConfigModule(skuModel, AndroidModuleStatus.DRAFT);
    } else if (skuModel.status === AndroidModuleStatus.DRAFT && countryModels.length === skuValueCountryIndexes.size) {
      skuModel.set('status', AndroidModuleStatus.COMPLETE);
      skuModel.set('updated', getCurrentDate());
      await skuModel.save();
      await changeSelectorConfigModule(skuModel, AndroidModuleStatus.COMPLETE);
    }
  }
};

/**
 * DELETE /api/android/country/:countryId/delete
 * Delete Android region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CountryLanguages Controller - deleteCountry');
  updateSpinnerText('Deleting country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);

    if (countryModel) {
      await countryModel.destroy({ force: true });

      await updateModulesStatus(countryModel.storeId, countryModel.productId);

      retWithSuccess(req, res, {
        message: `Android ${countryModel.name} country deleted successfully`,
        status: 200,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Android country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android deleteCountry failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateCountryLanguagesModels = async (countryId: number, languages: string[], defaultLanguage: string) => {
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
    where: { countryId },
  });
  let languageIdsSet = new Set<number>();
  countryLanguageModels.forEach((model) => languageIdsSet.add(model.languageId));
  for (const language of languages) {
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findOne({
      where: { code: language },
    });
    if (languageIdsSet.has(languageModel.id)) {
      const countryLanguageModel = countryLanguageModels.find((model) => model.languageId === languageModel.id);
      if (language === defaultLanguage) {
        countryLanguageModel.isDefault = true;
      } else {
        countryLanguageModel.isDefault = false;
      }
      await countryLanguageModel.save();
      languageIdsSet.delete(languageModel.id);
    } else {
      const isDefault = defaultLanguage === languageModel.code;
      const countryLanguageDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!languageModel.createdBy ? languageModel.createdBy : null,
        countryId,
        languageId: languageModel.id,
        isDefault,
      };
      await AndroidCountryLanguage.create(countryLanguageDBPayload);
    }
  }

  if (languageIdsSet.size) {
    for (let languageId of languageIdsSet) {
      const countryLanguageModel = countryLanguageModels.find((model) => model.languageId === languageId);
      await countryLanguageModel.destroy({ force: true });
    }
  }
};

export const isCountryActive = async (countryId: number) => {
  const countryLanguageIndexes = new Set<number>();
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll({
    where: { countryId },
  });
  countryLanguageModels.forEach((model) => countryLanguageIndexes.add(model.id));
  let appCopyValueModels: AndroidAppCopyValueModel[] = await AndroidAppCopyValue.findAll();
  appCopyValueModels = appCopyValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  let skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll();
  skuValueModels = skuValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  const selectorConfig: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll({
    where: { countryId },
  });
  const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);
  let imageCollection: AndroidImageCollectionModel[] = await AndroidImageCollection.findAll({
    where: { storeId: countryModel.storeId, productId: countryModel.productId },
  });
  imageCollection = imageCollection.filter((model) => model.countries.includes(`${countryId}`));

  if (appCopyValueModels.length || skuValueModels.length || selectorConfig.length || imageCollection.length) {
    return true;
  } else {
    return false;
  }
};
