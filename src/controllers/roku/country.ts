import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuCountry,
  RokuLanguage,
  RokuCountryLanguage,
  RokuStore,
  RokuProduct,
  RokuAppCopyValue,
  RokuSkuValue,
  RokuSelectorConfigSku,
  RokuAppCopy,
  RokuSku,
  RokuImageCollection,
} from '../../models';
import { RokuCountryModel } from 'src/models/roku/Country';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { getCurrentDate } from '.';
import { RokuAppCopyValueModel } from 'src/models/roku/AppCopyValue';
import { RokuSkuValueModel } from 'src/models/roku/SkuValue';
import { RokuSelectorConfigSkuModel } from 'src/models/roku/SelectorConfigSku';
import { RokuAppCopyModel } from 'src/models/roku/AppCopy';
import { RokuModuleStatus } from '../../types/enum';
import { RokuSkuModel } from 'src/models/roku/Sku';
import { changeSelectorConfigModule } from './sku';
import { RokuImageCollectionModel } from 'src/models/roku/ImageCollection';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/country
 * Get all Roku country
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CountryLanguages Controller - getAllCountryLanguages');
  updateSpinnerText('Getting all country modules...');
  try {
    let countryModels: RokuCountryModel[] = [];
    if (req.query.store && req.query.product) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: {
          path: req.query.store,
        },
      });
      const productModel: RokuProductModel = await RokuProduct.findOne({
        where: {
          path: req.query.product,
        },
      });
      countryModels = await RokuCountry.findAll({
        where: {
          storeId: storeModel.id,
          productId: productModel.id,
        },
      });
    } else {
      countryModels = await RokuCountry.findAll();
    }

    let message = `No Roku country modules found`;
    if (countryModels) {
      message = `Roku country modules found`;
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
    logger.error(`Roku getAllCountryLanguages failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/country/:countryId
 * Get Roku region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CountryLanguages Controller - getCountryLanguage');
  updateSpinnerText('Getting country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);
    const countryLanguagesModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
      where: { countryId },
    });
    const languagesModels: RokuLanguageModel[] = await RokuLanguage.findAll();
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

    let message = `No such Roku country found`;
    if (countryModel && languages.length) {
      message = `Roku country found`;
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
    logger.error(`Roku getCountryLanguage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCountryModelData = async (countryModel: RokuCountryModel) => {
  const countryId = countryModel.id;
  let languages: any[] = [];
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
    where: { countryId },
  });

  let defaultLanguage: string = '';
  for (let countryLanguageModel of countryLanguageModels) {
    const language: RokuLanguageModel = await RokuLanguage.findByPk(countryLanguageModel.languageId);
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
 * POST /api/roku/country?store
 * Save Roku region by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CountryLanguages Controller - saveCountryLanguages');
  updateSpinnerText('Saving country module...');
  let countryId: number;
  try {
    const storeModel: RokuStoreModel = await RokuStore.findOne({
      where: { path: req.query.store },
    });

    if (storeModel) {
      const storeId: number = storeModel.id;

      const product = req.query.product as string;
      const productModel: RokuProductModel = await RokuProduct.findOne({
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
      const countryResult = await RokuCountry.create(countryDBPayload);
      countryId = countryResult.id;
      await updateCountryLanguagesModels(countryId, req.body.languages, req.body.defaultLanguage);
      await updateModulesStatus(countryResult.storeId, countryResult.productId);

      retWithSuccess(req, res, {
        message: `Roku ${countryResult.name} country module saved as draft successfully`,
        status: 201,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Roku country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku saveCountryLanguages failed, ${err.message}`, err);

    // deleting incomplete records from DB
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);
    await countryModel.destroy({ force: false });

    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/country/:countryId
 * Save Roku region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CountryLanguages Controller - updateCountryLanguages');
  updateSpinnerText('Updating country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);

    if (countryModel) {
      countryModel.set('name', req.body.name);
      countryModel.set('code', req.body.code);
      countryModel.set('path', req.body.code.toLowerCase());
      const countryResult = await countryModel.save();

      await updateCountryLanguagesModels(countryId, req.body.languages, req.body.defaultLanguage);
      await updateModulesStatus(countryResult.storeId, countryResult.productId);

      retWithSuccess(req, res, {
        message: `Roku ${countryResult.name} country module updated successfully`,
        status: 201,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Roku country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku updateCountryLanguages failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateModulesStatus = async (storeId: number, productId: number) => {
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll({
    where: { storeId, productId },
  });
  let countryLanguageIndexes = new Set<number>();
  for (let countryModel of countryModels) {
    const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
      where: { countryId: countryModel.id },
    });
    if (countryLanguageModels.length) {
      for (let countryLanguageModel of countryLanguageModels) {
        countryLanguageIndexes.add(countryLanguageModel.id);
      }
    }
  }

  //check AppCopy models
  const appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll({
    where: { storeId, productId },
  });
  for (let appCopyModel of appCopyModels) {
    let appCopyValueCountryLanguageIndexes = new Set<number>();
    const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll({
      where: { appCopyId: appCopyModel.id },
    });
    if (appCopyValueModels.length) {
      appCopyValueModels.forEach((model) => appCopyValueCountryLanguageIndexes.add(model.countryLanguageId));
    }
    if (
      appCopyModel.status === RokuModuleStatus.READY &&
      countryLanguageIndexes.size !== appCopyValueCountryLanguageIndexes.size
    ) {
      appCopyModel.set('status', RokuModuleStatus.DRAFT);
      await appCopyModel.save();
    } else if (
      appCopyModel.status === RokuModuleStatus.DRAFT &&
      countryLanguageIndexes.size === appCopyValueCountryLanguageIndexes.size
    ) {
      appCopyModel.set('status', RokuModuleStatus.READY);
      await appCopyModel.save();
    }
  }

  //check Sku models
  const skuModels: RokuSkuModel[] = await RokuSku.findAll({
    where: { storeId, productId },
  });
  for (let skuModel of skuModels) {
    let skuValueCountryLanguageIndexes = new Set<number>();
    const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
      where: { skuId: skuModel.id },
    });
    if (skuValueModels.length) {
      skuValueModels.forEach((model) => skuValueCountryLanguageIndexes.add(model.countryLanguageId));
    }
    let skuValueCountryIndexes = new Set<number>();
    for (let countryLanguageId of skuValueCountryLanguageIndexes) {
      const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
        countryLanguageId,
      );
      if (countryLanguageModel) {
        skuValueCountryIndexes.add(countryLanguageModel.countryId);
      }
    }
    if (skuModel.status === RokuModuleStatus.COMPLETE && countryModels.length < skuValueCountryIndexes.size) {
      skuModel.set('status', RokuModuleStatus.DRAFT);
      await skuModel.save();
      await changeSelectorConfigModule(skuModel, RokuModuleStatus.DRAFT);
    } else if (skuModel.status === RokuModuleStatus.DRAFT && countryModels.length === skuValueCountryIndexes.size) {
      skuModel.set('status', RokuModuleStatus.COMPLETE);
      await skuModel.save();
      await changeSelectorConfigModule(skuModel, RokuModuleStatus.COMPLETE);
    }
  }
};

/**
 * DELETE /api/roku/country/:countryId/delete
 * Delete Roku region by countryId
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteCountry = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CountryLanguages Controller - deleteCountry');
  updateSpinnerText('Deleting country module...');
  try {
    const countryId: number = Number(req.params.countryId);
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);

    if (countryModel) {
      const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
        where: { countryId: countryModel.id }
      });
      if (!!countryLanguageModels && countryLanguageModels.length) {
        for (let countryLanguageModel of countryLanguageModels) {
          await countryLanguageModel.destroy({ force: false });
        }
      }
      await countryModel.destroy({ force: false });

      await updateModulesStatus(countryModel.storeId, countryModel.productId);

      retWithSuccess(req, res, {
        message: `Roku ${countryModel.name} country deleted successfully`,
        status: 200,
        data: null,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'No such Roku country module found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku deleteCountry failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const updateCountryLanguagesModels = async (countryId: number, languages: string[], defaultLanguage: string) => {
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
    where: { countryId },
  });
  let languageIdsSet = new Set<number>();
  countryLanguageModels.forEach((model) => languageIdsSet.add(model.languageId));
  for (const language of languages) {
    const languageModel: RokuLanguageModel = await RokuLanguage.findOne({
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
      await RokuCountryLanguage.create(countryLanguageDBPayload);
    }
  }

  if (languageIdsSet.size) {
    for (let languageId of languageIdsSet) {
      const countryLanguageModel = countryLanguageModels.find((model) => model.languageId === languageId);
      await countryLanguageModel.destroy({ force: false });
    }
  }
};

export const isCountryActive = async (countryId: number) => {
  const countryLanguageIndexes = new Set<number>();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll({
    where: { countryId },
  });
  countryLanguageModels.forEach((model) => countryLanguageIndexes.add(model.id));
  let appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll();
  appCopyValueModels = appCopyValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  let skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll();
  skuValueModels = skuValueModels.filter((model) => countryLanguageIndexes.has(model.countryLanguageId));
  const selectorConfig: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll({
    where: { countryId },
  });
  const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);
  let imageCollection: RokuImageCollectionModel[] = await RokuImageCollection.findAll({
    where: { storeId: countryModel.storeId, productId: countryModel.productId },
  });
  imageCollection = imageCollection.filter((model) => model.countries.includes(`${countryId}`));

  if (appCopyValueModels.length || skuValueModels.length || selectorConfig.length || imageCollection.length) {
    return true;
  } else {
    return false;
  }
};
