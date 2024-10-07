import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidAppCopy,
  AndroidAppCopyValue,
  AndroidCampaign,
  AndroidCampaignHistory,
  AndroidCountry,
  AndroidCountryLanguage,
  AndroidImageCollection,
  AndroidImageGallery,
  AndroidLanguage,
  AndroidProduct,
  AndroidSelectorConfig,
  AndroidSelectorConfigSku,
  AndroidSku,
  AndroidStore,
  AndroidStoreCopy,
  AndroidStoreCopyValue,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidModuleStatus, PlatformEnum } from '../../types/enum';
import { AndroidCountryLanguageModel } from 'src/models/android/CountryLanguage';
import { String } from 'aws-sdk/clients/apigateway';
import { AndroidCountryModel } from 'src/models/android/Country';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import { AppError } from '../../util/errorHandler';
import { AndroidImageCollectionModel } from 'src/models/android/ImageCollection';
import { getCurrentDate } from '.';
import { deleteObject } from '../../services/S3';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { AndroidImageGalleryModel } from 'src/models/android/ImageGallery';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/publish/:moduleName/:id
 * Get Android module info if it will rewrite live module
 * @param {Request}     req
 * @param {Response}    res
 */
export const getPublishingOverwriteWarningMessage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android modules Controller - getPublishingOverwriteWarningMessage');
    updateSpinnerText('Getting overwrite message...');
    try {
      const moduleName: string = req.params.moduleName;
      const moduleId: number = Number(req.params.id);
      const env: string = req.query.env as string;

      const result = await getModulesByParams(moduleName, moduleId, env);

      retWithSuccess(req, res, {
        message: 'Android modules overwriting publishing',
        status: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`Android getPublishingOverwriteWarningMessage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getModulesByParams = async (moduleName: string, id: number, env: String) => {
  switch (moduleName) {
    case 'app-copy':
      const appCopyFactories = [AndroidAppCopy, AndroidAppCopyValue];
      const appCopyResults = await getOverwriteMessages(id, appCopyFactories, 'regions', 'appCopyId', env);
      return appCopyResults;
    case 'selector-config':
      const selectorConfigFactories = [AndroidSelectorConfig, AndroidSelectorConfigSku];
      const selectorConfigResults = await getOverwriteMessages(
        id,
        selectorConfigFactories,
        'regions',
        'selectorConfigId',
        env,
      );
      return selectorConfigResults;
    case 'store-copy':
      const storeCopyFactories = [AndroidStoreCopy, AndroidStoreCopyValue];
      const storeCopyResults = await getOverwriteMessages(id, storeCopyFactories, 'languages', 'storeCopyId', env);
      return storeCopyResults;
    case 'image-collection':
      const imageCollectionResults = await getImageCollectionOverwriteMessages(id, env);
      return imageCollectionResults;
    case 'campaign':
      const campaignResults = await getCampaignOverwriteMessages(id, env);
      return campaignResults;
  }
};

export const getCampaignOverwriteMessages = async (campaignId: number, env: string) => {
  const publishingCampaignModel: AndroidCampaignModel = await AndroidCampaign.findByPk(campaignId);
  const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll({
    where: {
      storeId: publishingCampaignModel.storeId,
      productId: publishingCampaignModel.productId,
      status: AndroidModuleStatus.LIVE,
    },
  });
  const filteredCampaignModel: AndroidCampaignModel = campaignModels.find((model) => model.deployedTo.includes(env));
  if (filteredCampaignModel) {
    return { name: filteredCampaignModel.name };
  } else {
    return null;
  }
};

export const getImageCollectionOverwriteMessages = async (imageCollectionId: number, env: string) => {
  const publishImageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
    imageCollectionId,
  );
  const imageCollectionModels: AndroidImageCollectionModel[] = await AndroidImageCollection.findAll({
    where: {
      storeId: publishImageCollectionModel.storeId,
      productId: publishImageCollectionModel.productId,
      status: AndroidModuleStatus.LIVE,
    },
  });
  let filteredImageCollectionModels: AndroidImageCollectionModel[] = imageCollectionModels.filter((model) =>
    model.deployedTo.includes(env),
  );
  if (filteredImageCollectionModels.length) {
    let results: any[] = [];
    let listName = 'regions';
    const imageCollectionCountries: string[] = publishImageCollectionModel.countries.split(',');
    for (let restImageCollectionModel of filteredImageCollectionModels) {
      const restImageCollectionCountries: string[] = restImageCollectionModel.countries.split(',');
      let list: string[] = [];
      for (let countryId of restImageCollectionCountries) {
        if (imageCollectionCountries.some((elem) => elem === countryId)) {
          const elemIndex = imageCollectionCountries.indexOf(countryId);
          if (elemIndex > -1) {
            const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(Number(countryId));
            if (countryModel) {
              list.push(countryModel.code);
            }
          }
        }
      }
      if (list.length) {
        results.push({ name: restImageCollectionModel.name, list, listName });
      }
    }
    return results.length ? results : null;
  } else {
    return null;
  }
};

export const getOverwriteMessages = async (
  id: number,
  factories: any[],
  listName: string,
  idName: string,
  env: string,
) => {
  const model: any = await factories[0].findByPk(id);
  if (model) {
    const defaultModel: any = await factories[0].findOne({
      where: {
        storeId: model.storeId,
        productId: model.productId,
        isDefault: true,
      },
    });
    let currentLiveModels: any[] = await factories[0].findAll({
      where: {
        storeId: model.storeId,
        productId: model.productId,
        status: AndroidModuleStatus.LIVE,
      },
    });
    currentLiveModels = currentLiveModels.filter((liveModel) => liveModel.deployedTo.includes(env));
    if (defaultModel && idName === 'appCopyId') {
      if (model.id !== defaultModel.id) {
        currentLiveModels = currentLiveModels.filter((liveModel) => liveModel.id !== defaultModel.id);
      } else if (model.id === defaultModel.id) {
        currentLiveModels = currentLiveModels.filter((liveModel) => liveModel.id === defaultModel.id);
      }
    }
    let results: any[] = [];
    if (currentLiveModels.length) {
      for (let currentLiveModel of currentLiveModels) {
        const valueModels: any[] = await factories[1].findAll({
          where: { [idName]: model.id },
        });
        const currentLiveValueModels: any[] = await factories[1].findAll({
          where: { [idName]: currentLiveModel.id },
        });
        if (valueModels.length) {
          if (currentLiveValueModels.length) {
            let list: any[] = [];
            let filterIndexesSet = new Set<number>();
            let currentLiveFilterIndexesSet = new Set<number>();
            if (idName === 'appCopyId') {
              for (let valueModel of valueModels) {
                const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
                  valueModel.countryLanguageId,
                );
                filterIndexesSet.add(countryLanguageModel.countryId);
              }
              for (let currentLiveValueModel of currentLiveValueModels) {
                const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
                  currentLiveValueModel.countryLanguageId,
                );
                currentLiveFilterIndexesSet.add(countryLanguageModel.countryId);
              }
            } else {
              filterIndexesSet = new Set<number>(
                valueModels.map((model) => {
                  return listName === 'languages' ? model.languageId : model.countryId;
                }),
              );
              currentLiveFilterIndexesSet = new Set<number>(
                currentLiveValueModels.map((model) => {
                  return listName === 'languages' ? model.languageId : model.countryId;
                }),
              );
            }
            for (let id of currentLiveFilterIndexesSet) {
              if (filterIndexesSet.has(id)) {
                let filterModel: any;
                if (listName === 'languages') {
                  filterModel = await AndroidLanguage.findByPk(id);
                } else {
                  filterModel = await AndroidCountry.findByPk(id);
                }
                if (filterModel) {
                  list.push(filterModel.code);
                }
              }
            }
            results.push({ name: currentLiveModel.name, list, listName });
          } else {
            return null;
          }
        }
      }
      return results;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

export const setModelParameterNull = async (parameter: string, paramId: number, factory: any) => {
  const models: any[] = await factory.findAll({
    where: { [parameter]: paramId },
  });
  if (models.length) {
    for (let model of models) {
      model.set(parameter, null);
      await model.save();
    }
  }
};

export const setImageCollectionParameterNull = async (
  storeId: number,
  productId: number,
  imageCollectionId: number,
  factory: any,
) => {
  const campaignModels: any[] = await factory.findAll({
    where: { storeId, productId },
  });
  for (let campaignModel of campaignModels) {
    if (campaignModel.imageCollectionIndexes) {
      const imageCollectionIndexesArr = campaignModel.imageCollectionIndexes.split(',');
      if (imageCollectionIndexesArr.includes(`${imageCollectionId}`)) {
        const properImageCollectionIndexesArr = await getProperImageCollectionIndexesArray(
          campaignModel.imageCollectionIndexes,
        );
        campaignModel.set('imageCollectionIndexes', properImageCollectionIndexesArr.join(','));
        await campaignModel.save();
      }
    }
  }
};

/**
 * DELETE /api/android/:moduleType/:moduleId/delete
 * Delete Android module by id
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteModuleById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const moduleData: any = getProperModuleData(req.params);
  logger.debug(`Android ${moduleData.type} module Controller - deleteModuleById`);
  updateSpinnerText('Deleting module...');
  try {
    if (moduleData) {
      const model: any = await moduleData.factory.findByPk(moduleData.id);
      if (model) {
        const storeId = model.storeId;
        const productId = model.productId;
        if (moduleData.type === 'ImageGallery') {
          const storeModel: AndroidStoreModel = await AndroidStore.findByPk(storeId);
          const productModel: AndroidProductModel = await AndroidProduct.findByPk(productId);
          const imageGalleryModel: AndroidImageGalleryModel = await AndroidImageGallery.findByPk(moduleData.id);
          const name = `${imageGalleryModel.name}.${imageGalleryModel.type.toLowerCase()}`;
          await deleteObject(PlatformEnum.ANDROID, 'gallery', null, storeModel.path, productModel.path, name);
        }
        if (
          moduleData.type !== 'ImageGallery' &&
          moduleData.type !== 'Campaign' &&
          moduleData.type !== 'CampaignHistory' &&
          moduleData.type !== 'ImageCollection'
        ) {
          await setModelParameterNull(moduleData.idName, moduleData.id, AndroidCampaign);
          await setModelParameterNull(moduleData.idName, moduleData.id, AndroidCampaignHistory);
        }

        await model.destroy({ force: true, logging: console.log });

        // nullify records of ImageCollection module
        if (moduleData.type === 'ImageCollection') {
          await setImageCollectionParameterNull(storeId, productId, moduleData.id, AndroidCampaign);
          await setImageCollectionParameterNull(storeId, productId, moduleData.id, AndroidCampaignHistory);
        }
        retWithSuccess(req, res, {
          message: `Android ${model.name} ${moduleData.type} module deleted from DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        throw new AppError(`Such Android ${moduleData.type} model not found`, 404);
      }
    } else {
      throw new AppError(`Such Android module type not found`, 404);
    }
  } catch (err) {
    logger.error(`Android deleteModuleById failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getProperModuleData = (params: any) => {
  if (params.appCopyId) {
    return {
      id: Number(params.appCopyId),
      idName: 'appCopyId',
      type: 'AppCopy',
      factory: AndroidAppCopy,
    };
  } else if (params.skuId) {
    return {
      id: Number(params.skuId),
      idName: 'winbackSkuId',
      type: 'Sku',
      factory: AndroidSku,
    };
  } else if (params.selectorConfigId) {
    return {
      id: Number(params.selectorConfigId),
      idName: 'selectorConfigId',
      type: 'SelectorConfig',
      factory: AndroidSelectorConfig,
    };
  } else if (params.imageId) {
    return {
      id: Number(params.imageId),
      idName: 'imageId',
      type: 'ImageGallery',
      factory: AndroidImageGallery,
    };
  } else if (params.imageCollectionId) {
    return {
      id: Number(params.imageCollectionId),
      idName: 'imageCollectionId',
      type: 'ImageCollection',
      factory: AndroidImageCollection,
    };
  } else if (params.storeCopyId) {
    return {
      id: Number(params.storeCopyId),
      idName: 'storeCopyId',
      type: 'StoreCopy',
      factory: AndroidStoreCopy,
    };
  } else if (params.campaignId) {
    return {
      id: Number(params.campaignId),
      idName: 'campaignId',
      type: 'Campaign',
      factory: AndroidCampaign,
    };
  } else if (params.campaignHistoryId) {
    return {
      id: Number(params.campaignHistoryId),
      idName: 'campaignHistoryId',
      type: 'CampaignHistory',
      factory: AndroidCampaignHistory,
    };
  }
};

export const getProperImageCollectionIndexesArray = async (imageCollectionString: string) => {
  let result: number[] = [];
  let imageCollectionIndexes: string[] = [];
  if (imageCollectionString.includes(',')) {
    imageCollectionIndexes = imageCollectionString.split(',');
  } else {
    imageCollectionIndexes.push(imageCollectionString);
  }
  for (let imageCollectionId of imageCollectionIndexes) {
    const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
      Number(imageCollectionId),
    );
    if (imageCollectionModel) {
      result.push(Number(imageCollectionId));
    }
  }
  return result.length ? result : null;
};

export const isTokenValid = (body: any) => {
  if (!!body && body.tardisToken && body.tardisTokenExpiresAt) {
    const currentTime = new Date(getCurrentDate());
    const expiresAt = new Date(body.tardisTokenExpiresAt);
    expiresAt.getTime() - currentTime.getTime() > 300e3 ? true : false;
  } else {
    return false;
  }
};

export const setModelStatus = async (model: any, status: string) => {
  model.set('status', status);
  await model.save();
};
