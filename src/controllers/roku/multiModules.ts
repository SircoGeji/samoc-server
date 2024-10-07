import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuAppCopy,
  RokuAppCopyValue,
  RokuCampaign,
  RokuCampaignHistory,
  RokuCountry,
  RokuCountryLanguage,
  RokuImageCollection,
  RokuImageGallery,
  RokuLanguage,
  RokuProduct,
  RokuSelectorConfig,
  RokuSelectorConfigSku,
  RokuSku,
  RokuStore,
  RokuStoreCopy,
  RokuStoreCopyValue,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { PlatformEnum, RokuModuleStatus } from '../../types/enum';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { String } from 'aws-sdk/clients/apigateway';
import { RokuCountryModel } from 'src/models/roku/Country';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { AppError } from '../../util/errorHandler';
import { RokuImageCollectionModel } from 'src/models/roku/ImageCollection';
import { getCurrentDate } from '.';
import { deleteObject } from '../../services/S3';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuImageGalleryModel } from 'src/models/roku/ImageGallery';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/publish/:moduleName/:id
 * Get Roku module info if it will rewrite live module
 * @param {Request}     req
 * @param {Response}    res
 */
export const getPublishingOverwriteWarningMessage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku modules Controller - getPublishingOverwriteWarningMessage');
    updateSpinnerText('Getting overwrite message...');
    try {
      const moduleName: string = req.params.moduleName;
      const moduleId: number = Number(req.params.id);
      const env: string = req.query.env as string;

      const result = await getModulesByParams(moduleName, moduleId, env);

      retWithSuccess(req, res, {
        message: 'Roku modules overwriting publishing',
        status: 200,
        data: result,
      });
    } catch (err) {
      logger.error(`Roku getPublishingOverwriteWarningMessage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getModulesByParams = async (moduleName: string, id: number, env: String) => {
  switch (moduleName) {
    case 'app-copy':
      const appCopyFactories = [RokuAppCopy, RokuAppCopyValue];
      const appCopyResults = await getOverwriteMessages(id, appCopyFactories, 'regions', 'appCopyId', env);
      return appCopyResults;
    case 'selector-config':
      const selectorConfigFactories = [RokuSelectorConfig, RokuSelectorConfigSku];
      const selectorConfigResults = await getOverwriteMessages(
        id,
        selectorConfigFactories,
        'regions',
        'selectorConfigId',
        env,
      );
      return selectorConfigResults;
    case 'store-copy':
      const storeCopyFactories = [RokuStoreCopy, RokuStoreCopyValue];
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
  const publishingCampaignModel: RokuCampaignModel = await RokuCampaign.findByPk(campaignId);
  const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
    where: {
      storeId: publishingCampaignModel.storeId,
      productId: publishingCampaignModel.productId,
      status: RokuModuleStatus.LIVE,
    },
  });
  const filteredCampaignModel: RokuCampaignModel = campaignModels.find((model) => model.deployedTo.includes(env));
  if (filteredCampaignModel) {
    return { name: filteredCampaignModel.name };
  } else {
    return null;
  }
};

export const getImageCollectionOverwriteMessages = async (imageCollectionId: number, env: string) => {
  const publishImageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
    imageCollectionId,
  );
  const imageCollectionModels: RokuImageCollectionModel[] = await RokuImageCollection.findAll({
    where: {
      storeId: publishImageCollectionModel.storeId,
      productId: publishImageCollectionModel.productId,
      status: RokuModuleStatus.LIVE,
    },
  });
  let filteredImageCollectionModels: RokuImageCollectionModel[] = imageCollectionModels.filter((model) =>
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
            const countryModel: RokuCountryModel = await RokuCountry.findByPk(Number(countryId));
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
        status: RokuModuleStatus.LIVE,
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
                const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
                  valueModel.countryLanguageId,
                );
                filterIndexesSet.add(countryLanguageModel.countryId);
              }
              for (let currentLiveValueModel of currentLiveValueModels) {
                const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
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
                  filterModel = await RokuLanguage.findByPk(id);
                } else {
                  filterModel = await RokuCountry.findByPk(id);
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
 * DELETE /api/roku/:moduleType/:moduleId/delete
 * Delete Roku module by id
 * @param {Request}     req
 * @param {Response}    res
 */
export const deleteModuleById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const moduleData: any = getProperModuleData(req.params);
  logger.debug(`Roku ${moduleData.type} module Controller - deleteModuleById`);
  updateSpinnerText('Deleting module...');
  try {
    if (moduleData) {
      const model: any = await moduleData.factory.findByPk(moduleData.id);
      if (model) {
        const storeId = model.storeId;
        const productId = model.productId;
        if (moduleData.type === 'ImageGallery') {
          const storeModel: RokuStoreModel = await RokuStore.findByPk(storeId);
          const productModel: RokuProductModel = await RokuProduct.findByPk(productId);
          const imageGalleryModel: RokuImageGalleryModel = await RokuImageGallery.findByPk(moduleData.id);
          const name = `${imageGalleryModel.name}.${imageGalleryModel.type.toLowerCase()}`;
          await deleteObject(PlatformEnum.ROKU, 'gallery', null, storeModel.path, productModel.path, name);
        }
        if (
          moduleData.type !== 'ImageGallery' &&
          moduleData.type !== 'Campaign' &&
          moduleData.type !== 'CampaignHistory' &&
          moduleData.type !== 'ImageCollection'
        ) {
          await setModelParameterNull(moduleData.idName, moduleData.id, RokuCampaign);
          await setModelParameterNull(moduleData.idName, moduleData.id, RokuCampaignHistory);
        }

        await model.destroy({ force: true, logging: console.log });

        // nullify records of ImageCollection module
        if (moduleData.type === 'ImageCollection') {
          await setImageCollectionParameterNull(storeId, productId, moduleData.id, RokuCampaign);
          await setImageCollectionParameterNull(storeId, productId, moduleData.id, RokuCampaignHistory);
        }
        retWithSuccess(req, res, {
          message: `Roku ${model.name} ${moduleData.type} module deleted from DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        throw new AppError(`Such Roku ${moduleData.type} model not found`, 404);
      }
    } else {
      throw new AppError(`Such Roku module type not found`, 404);
    }
  } catch (err) {
    logger.error(`Roku deleteModuleById failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getProperModuleData = (params: any) => {
  if (params.appCopyId) {
    return {
      id: Number(params.appCopyId),
      idName: 'appCopyId',
      type: 'AppCopy',
      factory: RokuAppCopy,
    };
  } else if (params.skuId) {
    return {
      id: Number(params.skuId),
      idName: 'winbackSkuId',
      type: 'Sku',
      factory: RokuSku,
    };
  } else if (params.selectorConfigId) {
    return {
      id: Number(params.selectorConfigId),
      idName: 'selectorConfigId',
      type: 'SelectorConfig',
      factory: RokuSelectorConfig,
    };
  } else if (params.imageId) {
    return {
      id: Number(params.imageId),
      idName: 'imageId',
      type: 'ImageGallery',
      factory: RokuImageGallery,
    };
  } else if (params.imageCollectionId) {
    return {
      id: Number(params.imageCollectionId),
      idName: 'imageCollectionId',
      type: 'ImageCollection',
      factory: RokuImageCollection,
    };
  } else if (params.storeCopyId) {
    return {
      id: Number(params.storeCopyId),
      idName: 'storeCopyId',
      type: 'StoreCopy',
      factory: RokuStoreCopy,
    };
  } else if (params.campaignId) {
    return {
      id: Number(params.campaignId),
      idName: 'campaignId',
      type: 'Campaign',
      factory: RokuCampaign,
    };
  } else if (params.campaignHistoryId) {
    return {
      id: Number(params.campaignHistoryId),
      idName: 'campaignHistoryId',
      type: 'CampaignHistory',
      factory: RokuCampaignHistory,
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
    const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
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
