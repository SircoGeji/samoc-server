import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidAppCopy,
  AndroidCampaign,
  AndroidImageCollection,
  AndroidProduct,
  AndroidSelectorConfig,
  AndroidSku,
  AndroidStore,
  AndroidStoreCopy,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { AndroidModuleStatus } from '../../types/enum';
import { AndroidSelectorConfigModel } from 'src/models/android/SelectorConfig';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import { AndroidAppCopyModel } from 'src/models/android/AppCopy';
import { AndroidImageCollectionModel } from 'src/models/android/ImageCollection';
import { AndroidSkuModel } from 'src/models/android/Sku';
import { AndroidStoreCopyModel } from 'src/models/android/StoreCopy';
import { getAppCopyModuleData, publishAppCopyModule } from './appCopy';
import { getSkuModuleData } from './sku';
import { getSelectorConfigModuleData, publishSelectorConfigModule } from './selectorConfig';
import { getStoreCopyModuleData, publishStoreCopyModule } from './storeCopy';
import { getImageCollectionModuleData, getImagesNameAndPathForS3, publishBundleRetry, publishImageCollectionModule } from './image';
import { getCurrentDate, setModuleEnv } from '.';
import { saveCampaignHistoryModel } from './campaignHistory';
import { getProperImageCollectionIndexesArray, setModelStatus } from './multiModules';
import { updateSpinnerText, pRetryAll } from '../../util/utils';
import pRetry from 'p-retry';

const logger = Logger(module);

/**
 * GET /api/android/campaign/
 * Get all Android Campaign modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Campaign module Controller - getAllCampaign');
  updateSpinnerText('Getting all campaign modules...');
  try {
    const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll();

    if (!!campaignModels && campaignModels.length) {
      let results: any = [];

      for (let model of campaignModels) {
        const result = await getCampaignModuleData(model);
        results.push(result);
      }

      retWithSuccess(req, res, {
        message: 'Android Campaign modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Android Campaign modules not found',
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Android getAllCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/campaign/:campaignId
 * Get Android Campaign module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Campaign module Controller - getCampaign');
  updateSpinnerText('Getting campaign module...');
  try {
    const campaignId: number = Number(req.params.campaignId);
    const campaignModel: AndroidCampaignModel = await AndroidCampaign.findByPk(campaignId);

    if (campaignModel) {
      const result = await getCampaignModuleData(campaignModel);
      retWithSuccess(req, res, {
        message: 'Android Campaign module found',
        status: 200,
        data: result,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Android Campaign module not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android getCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCampaignModuleData = async (campaignModel: AndroidCampaignModel) => {
  let appCopy: any = null;
  if (campaignModel.appCopyId !== null && campaignModel.appCopyId !== undefined) {
    const appCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findByPk(campaignModel.appCopyId);
    const appCopyData = await getAppCopyModuleData(appCopyModel);
    appCopy = {
      appCopyId: appCopyData.appCopyId,
      name: appCopyData.name,
      status: appCopyData.status,
      platforms: appCopyData.platforms,
    };
  }
  let sku: any = null;
  if (campaignModel.winbackSkuId !== null && campaignModel.winbackSkuId !== undefined) {
    const skuModel: AndroidSkuModel = await AndroidSku.findByPk(campaignModel.winbackSkuId);
    if (skuModel) {
      const skuData = await getSkuModuleData(skuModel);
      sku = {
        skuId: skuData.skuId,
        name: skuData.name,
        status: skuData.status,
      };
    }
  }
  let selectorConfig: any = null;
  if (campaignModel.selectorConfigId !== null && campaignModel.selectorConfigId !== undefined) {
    const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
      campaignModel.selectorConfigId,
    );
    if (selectorConfigModel) {
      const selectorConfigData = await getSelectorConfigModuleData(selectorConfigModel);
      selectorConfig = {
        selectorConfigId: selectorConfigData.selectorConfigId,
        name: selectorConfigData.name,
        status: selectorConfigData.status,
      };
    }
  }
  let storeCopy: any = null;
  if (campaignModel.storeCopyId !== null && campaignModel.storeCopyId !== undefined) {
    const storeCopyModel: AndroidStoreCopyModel = await AndroidStoreCopy.findByPk(campaignModel.storeCopyId);
    if (storeCopyModel) {
      const storeCopyData = await getStoreCopyModuleData(storeCopyModel);
      storeCopy = {
        storeCopyId: storeCopyData.storeCopyId,
        name: storeCopyData.name,
        status: storeCopyData.status,
      };
    }
  }
  let imageCollection: any[] = [];
  if (campaignModel.imageCollectionIndexes !== null && campaignModel.imageCollectionIndexes !== undefined) {
    const imageCollectionIndexes = await getProperImageCollectionIndexesArray(campaignModel.imageCollectionIndexes);
    if (!!imageCollectionIndexes && imageCollectionIndexes.length) {
      for (let imageCollectionId of imageCollectionIndexes) {
        const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
          imageCollectionId,
        );
        if (imageCollectionModel) {
          const imageCollectionData = await getImageCollectionModuleData(imageCollectionModel);
          imageCollection.push({
            imageCollectionId: imageCollectionData.imageCollectionId,
            name: imageCollectionData.name,
            status: imageCollectionData.status,
            regions: imageCollectionData.countries,
          });
        }
      }
    }
  }
  const status = await getCurrentModuleStatus(campaignModel);

  return {
    campaignId: campaignModel.id,
    created: campaignModel.created,
    updated: campaignModel.updated,
    storeId: campaignModel.storeId,
    productId: campaignModel.productId,
    name: campaignModel.name,
    startDate: campaignModel.startDate,
    endDate: campaignModel.endDate,
    appCopy,
    sku,
    selectorConfig,
    storeCopy,
    imageCollection,
    isDefault: campaignModel.isDefault,
    deployedTo: campaignModel.deployedTo,
    endedOn: campaignModel.endedOn,
    status,
  };
};

/**
 * POST /api/android/campaign/:store/save?product
 * Save Android Campaign module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Campaign module Controller - saveCampaign');
  updateSpinnerText('Saving campaign module...');
  const storeModel: AndroidStoreModel = await AndroidStore.findOne({
    where: { path: req.query.store as string },
  });

  const productModel: AndroidProductModel = await AndroidProduct.findOne({
    where: { path: req.query.product as string },
  });

  let campaignId: number;
  if (storeModel && productModel) {
    const storeId: number = storeModel.id;
    const productId: number = productModel.id;

    try {
      // Check if the module is the first in DB
      let isDefault: boolean = false;
      const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll({
        where: { storeId, productId },
      });
      if (!campaignModels && !campaignModels.length) {
        isDefault = true;
      }

      if (req.body.name && req.body.startDate && req.body.endDate && req.body.appCopyId) {
        // check validity of ImageCollection indexes
        let imageCollectionIndexes = null;
        if (req.body.imageCollectionIndexes) {
          const imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(req.body.imageCollectionIndexes);
          imageCollectionIndexes = imageCollectionIndexesArr.join(',');
        }

        const campaignDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          name: req.body.name,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          appCopyId: req.body.appCopyId,
          selectorConfigId: req.body.selectorConfigId ?? req.body.selectorConfigId,
          imageCollectionIndexes,
          winbackSkuId: req.body.winbackSkuId ?? req.body.winbackSkuId,
          storeCopyId: req.body.storeCopyId ?? req.body.storeCopyId,
          isDefault,
          status: AndroidModuleStatus.DRAFT,
        };
        const campaignResult = await AndroidCampaign.create(campaignDBPayload);
        campaignId = campaignResult.id;

        const currentStatus = await getCurrentModuleStatus(campaignResult);
        if (currentStatus !== AndroidModuleStatus.DRAFT) {
          campaignResult.set('status', currentStatus);
          await campaignResult.save();
        }

        retWithSuccess(req, res, {
          message: `Android ${campaignResult.name} Campaign module saved in DB successfully`,
          status: 201,
          data: { campaignId },
        });
      } else {
        throw new AppError('All required parameters are not found', 400);
      }
    } catch (err) {
      logger.error(`Android saveCampaign failed, ${err.message}`, err);

      // deleting incomplete records from DB
      const campaignModel: AndroidCampaignModel = await AndroidCampaign.findByPk(campaignId);
      if (campaignModel) {
        await campaignModel.destroy({ force: true });
      }

      return next(processOfferError(err));
    }
  } else {
    throw new AppError('Such store or product not found', 404);
  }
});

/**
 * PUT /api/android/campaign/:campaignId/update
 * Update Android Campaign module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android Campaign module Controller - updateCampaign');
  updateSpinnerText('Updating campaign module...');
  try {
    const campaignId: number = Number(req.params.campaignId);
    const campaignModel: AndroidCampaignModel = await AndroidCampaign.findByPk(campaignId);

    if (campaignModel) {
      if (req.query.status !== undefined) {
        campaignModel.set('status', req.query.status);
      } else if (req.query.isDefault !== undefined) {
        campaignModel.set('isDefault', req.query.isDefault === 'true');
      } else {
        let imageCollectionIndexes = campaignModel.imageCollectionIndexes;
        if (req.body.imageCollectionIndexes) {
          const imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(req.body.imageCollectionIndexes);
          imageCollectionIndexes = imageCollectionIndexesArr.join(',');
        }

        campaignModel.set('name', req.body.name);
        campaignModel.set('startDate', req.body.startDate);
        campaignModel.set('endDate', req.body.endDate);
        campaignModel.set('appCopyId', req.body.appCopyId);
        campaignModel.set('winbackSkuId', !req.body.winbackSkuId ? null : req.body.winbackSkuId);
        campaignModel.set('selectorConfigId', !req.body.selectorConfigId ? null : req.body.selectorConfigId);
        campaignModel.set('imageCollectionIndexes', imageCollectionIndexes);
        campaignModel.set('storeCopyId', !req.body.storeCopyId ? null : req.body.storeCopyId);
      }

      const currentStatus = await getCurrentModuleStatus(campaignModel);
      campaignModel.set('status', currentStatus);
      campaignModel.set('updated', getCurrentDate());
      await campaignModel.save();

      retWithSuccess(req, res, {
        message: `Android ${campaignModel.name} Campaign module updated in DB successfully`,
        status: 201,
        data: null,
      });
    } else {
      throw new AppError('Campaign module in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Android updateCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/android/campaign/:campaignId/publish?env
 * Publish Android Campaign module by campaignId and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  req.socket.setTimeout(105e4); // increase request socket timeout to 21 minutes
  logger.debug('Android Campaign module Controller - publishCampaign');
  let campaignModel: AndroidCampaignModel;
  let bundleModel: AndroidImageCollectionModel;
  try {
    const campaignId: number = Number(req.params.campaignId);
    campaignModel = await AndroidCampaign.findByPk(campaignId);
    const env: string = req.query.env as string;
    if (!env) {
      throw new AppError('Environment where to publish Campaign module not found', 404);
    }
    if (!campaignModel) {
      throw new AppError('Campaign module in DB not found', 404);
    }
    // set status to IN PROGRESS
    const envStr = req.query.envStr as string;
    campaignModel.set('status', AndroidModuleStatus.PUBLISH_PROGRESS + envStr);
    await campaignModel.save();

    await publishCampaignRetry(
      campaignModel,
      req.body,
      bundleModel,
      env,
      envStr,
    );

    retWithSuccess(req, res, {
      message: `Android ${campaignModel.name} Campaign module published on ${env.toUpperCase()} successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Android publishCampaign failed, ${err.message}`, err);
    if (!!campaignModel) {
      campaignModel.set('status', AndroidModuleStatus.READY);
      await campaignModel.save();
    }
    if (!!bundleModel) {
      bundleModel.set('status', AndroidModuleStatus.READY);
      await bundleModel.save();
    }
    return next(processOfferError(err));
  }
});

export const publishCampaignRetry = async (
  campaignModel: AndroidCampaignModel,
  body: any,
  bundleModel: AndroidImageCollectionModel,
  env: string,
  envStr: string,
): Promise<any> => {
  let appCopyPublishFinished = false;
  let selectorConfigPublishFinished = false;
  let imageCollectionPublishFinished = false;
  let storeCopyPublishFinished = false;
  let campaignPublishFinished = false;
  const campaignOp = async () => {
    if (!appCopyPublishFinished) {
      // publish AppCopy module
      if (campaignModel.appCopyId) {
        // const appCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findByPk(campaignModel.appCopyId);
        // const defaultAppCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findOne({
        //   where: {
        //     storeId: appCopyModel.storeId,
        //     productId: appCopyModel.productId,
        //     isDefault: true,
        //   },
        // });
        // if (
        //   defaultAppCopyModel &&
        //   defaultAppCopyModel.id !== appCopyModel.id &&
        //   defaultAppCopyModel.status !== AndroidModuleStatus.DRAFT &&
        //   (!defaultAppCopyModel.deployedTo || !defaultAppCopyModel.deployedTo.includes(env))
        // ) {
        //   await publishAppCopyModule(defaultAppCopyModel, env);
        // }
        // await publishAppCopyModule(appCopyModel, env);
      }
      appCopyPublishFinished = true;
    }

    if (!selectorConfigPublishFinished) {
      // publish SelectorConfig module
      if (campaignModel.selectorConfigId) {
        const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
          campaignModel.selectorConfigId,
        );
        await publishSelectorConfigModule(selectorConfigModel, env, body);
      }
      selectorConfigPublishFinished = true;
    }

    if (!imageCollectionPublishFinished) {
      // publish ImageCollection modules
      if (campaignModel.imageCollectionIndexes) {
        const imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(
          campaignModel.imageCollectionIndexes,
        );
        const productModel: AndroidProductModel = await AndroidProduct.findByPk(campaignModel.productId);
        for (let imageCollectionId of imageCollectionIndexesArr) {
          const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
            imageCollectionId,
          );
          if (imageCollectionModel) {
            bundleModel = imageCollectionModel;
            const imageArr: any[] = await getImagesNameAndPathForS3(imageCollectionModel);
            if (!!imageArr && imageArr.length) {
              // set status to IN PROGRESS
              imageCollectionModel.set('status', AndroidModuleStatus.PUBLISH_PROGRESS + envStr);
              await imageCollectionModel.save();
              
              await publishBundleRetry(
                imageArr,
                env,
                productModel,
                imageCollectionModel,
              );
            }
          }
        }
      }
      imageCollectionPublishFinished = true;
    }
    
    if (!storeCopyPublishFinished) {
      // publish StoreCopy module
      if (campaignModel.storeCopyId) {
        const storeCopyModel: AndroidStoreCopyModel = await AndroidStoreCopy.findByPk(campaignModel.storeCopyId);
        await publishStoreCopyModule(storeCopyModel, env);
      }
      storeCopyPublishFinished = true;
    }

    if (!campaignPublishFinished) {
      // publish Campaign module
      let restCampaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll({
        where: {
          storeId: campaignModel.storeId,
          productId: campaignModel.productId,
          status: AndroidModuleStatus.LIVE,
        },
      });
      restCampaignModels = restCampaignModels.filter((elem) => {
        return elem.id !== campaignModel.id && elem.deployedTo.includes(env);
      });
      for (let restCampaignModel of restCampaignModels) {
        if (restCampaignModel.deployedTo === env) {
          restCampaignModel.set('deployedTo', null);
          setModuleEnv(restCampaignModel, env, 'endedOn');
        } else {
          let newDeployedTo: string = restCampaignModel.deployedTo.replace(env, '');
          newDeployedTo = newDeployedTo.replace('-', '');
          restCampaignModel.set('deployedTo', newDeployedTo);
          setModuleEnv(restCampaignModel, env, 'endedOn');
        }
        const currentStatus = await getCurrentModuleStatus(restCampaignModel);
        restCampaignModel.set('status', currentStatus);
        restCampaignModel.set('updated', getCurrentDate());
        await restCampaignModel.save();
      }
      setModuleEnv(campaignModel, env, 'deployedTo');
      if (env === campaignModel.endedOn) {
        campaignModel.set('endedOn', null);
      }

      campaignModel.set('status', AndroidModuleStatus.LIVE);
      campaignModel.set('updated', getCurrentDate());
      await campaignModel.save();
    }

    await saveCampaignHistoryModel(campaignModel);
  };
  // setup retry mechanism
  await pRetry(campaignOp, pRetryAll);
};

export const getCurrentModuleStatus = async (campaignModel: AndroidCampaignModel) => {
  if (campaignModel.status.includes(AndroidModuleStatus.PUBLISH_PROGRESS)) {
    return campaignModel.status;
  }
  if (!campaignModel.deployedTo && !!campaignModel.endedOn) {
    await setModelStatus(campaignModel, AndroidModuleStatus.ENDED);
    return AndroidModuleStatus.ENDED;
  } else if (!!campaignModel.deployedTo) {
    await setModelStatus(campaignModel, AndroidModuleStatus.LIVE);
    return AndroidModuleStatus.LIVE;
  } else {
    const isCampaignCompleteResult = await isCampaignComplete(campaignModel);
    if (isCampaignCompleteResult) {
      await setModelStatus(campaignModel, AndroidModuleStatus.READY);
      return AndroidModuleStatus.READY;
    } else {
      await setModelStatus(campaignModel, AndroidModuleStatus.DRAFT);
      return AndroidModuleStatus.DRAFT;
    }
  }
};

export const isCampaignComplete = async (campaignModel: AndroidCampaignModel) => {
  const appCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findByPk(campaignModel.appCopyId);
  const skuModel: AndroidSkuModel = await AndroidSku.findByPk(campaignModel.winbackSkuId);
  const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
    campaignModel.selectorConfigId,
  );
  const storeCopyModel: AndroidStoreCopyModel = await AndroidStoreCopy.findByPk(campaignModel.storeCopyId);

  let imageCollectionModelsComplete = new Set<boolean>();
  if (campaignModel.imageCollectionIndexes) {
    const imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(campaignModel.imageCollectionIndexes);
    if (!!imageCollectionIndexesArr && imageCollectionIndexesArr.length) {
      for (let imageCollectionId of imageCollectionIndexesArr) {
        const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
          imageCollectionId,
        );
        if (imageCollectionModel && imageCollectionModel.status !== AndroidModuleStatus.DRAFT) {
          imageCollectionModelsComplete.add(true);
        } else {
          imageCollectionModelsComplete.add(false);
        }
      }
    }
  }

  return (
    !!campaignModel.name &&
    !!campaignModel.startDate &&
    !!campaignModel.endDate &&
    !!campaignModel.appCopyId &&
    appCopyModel.status !== AndroidModuleStatus.DRAFT &&
    ((!!campaignModel.winbackSkuId && skuModel.status !== AndroidModuleStatus.DRAFT) || !campaignModel.winbackSkuId) &&
    ((!!campaignModel.selectorConfigId && selectorConfigModel.status !== AndroidModuleStatus.DRAFT) ||
      !campaignModel.selectorConfigId) &&
    (!imageCollectionModelsComplete.has(false) || !imageCollectionModelsComplete.size) &&
    ((!!campaignModel.storeCopyId && storeCopyModel.status !== AndroidModuleStatus.DRAFT) || !campaignModel.storeCopyId)
  );
};

export const setLiveCampaignParameter = async (
  storeId: number,
  productId: number,
  moduleType: string,
  env: string,
  id: number,
) => {
  const liveCampaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll({
    where: {
      status: AndroidModuleStatus.LIVE,
      storeId,
      productId,
    },
  });
  if (!!liveCampaignModels && liveCampaignModels.length) {
    const foundCampaignModel = liveCampaignModels.find((model) => model.deployedTo.includes(env));
    if (foundCampaignModel) {
      switch (moduleType) {
        case 'app-copy':
          const appCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findByPk(foundCampaignModel.appCopyId);
          if (!!appCopyModel && appCopyModel.status === AndroidModuleStatus.ENDED) {
            foundCampaignModel.set('appCopyId', id);
          }
          break;
        case 'sku':
          const skuModel: AndroidSkuModel = await AndroidSku.findByPk(foundCampaignModel.winbackSkuId);
          if (!!skuModel && skuModel.status === AndroidModuleStatus.ENDED) {
            foundCampaignModel.set('winbackSkuId', id);
          }
          break;
        case 'selector-config':
          const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
            foundCampaignModel.selectorConfigId,
          );
          if (!!selectorConfigModel && selectorConfigModel.status === AndroidModuleStatus.ENDED) {
            foundCampaignModel.set('selectorConfigId', id);
          }
          break;
        case 'image-collection':
          if (foundCampaignModel.imageCollectionIndexes) {
            let imageCollectionIndexes = foundCampaignModel.imageCollectionIndexes;
            let imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(
              foundCampaignModel.imageCollectionIndexes,
            );
            if (!!imageCollectionIndexes && imageCollectionIndexesArr.length) {
              for (let [i, imageCollectionId] of imageCollectionIndexesArr.entries()) {
                const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
                  imageCollectionId,
                );
                if (imageCollectionModel.status === AndroidModuleStatus.ENDED) {
                  imageCollectionIndexesArr[i] = id;
                }
              }
              imageCollectionIndexes = imageCollectionIndexesArr.join(',');
              foundCampaignModel.set('imageCollectionIndexes', imageCollectionIndexes);
            }
          }
          break;
        case 'store-copy':
          const storeCopyModel: AndroidStoreCopyModel = await AndroidStoreCopy.findByPk(foundCampaignModel.storeCopyId);
          if (!!storeCopyModel && storeCopyModel.status === AndroidModuleStatus.ENDED) {
            foundCampaignModel.set('storeCopyId', id);
          }
          break;
      }
      await foundCampaignModel.save();
    }
  }
};
