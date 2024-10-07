import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuAppCopy,
  RokuCampaign,
  RokuImageCollection,
  RokuProduct,
  RokuSelectorConfig,
  RokuSku,
  RokuStore,
  RokuStoreCopy,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuModuleStatus } from '../../types/enum';
import { RokuSelectorConfigModel } from 'src/models/roku/SelectorConfig';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { RokuAppCopyModel } from 'src/models/roku/AppCopy';
import { RokuImageCollectionModel } from 'src/models/roku/ImageCollection';
import { RokuSkuModel } from 'src/models/roku/Sku';
import { RokuStoreCopyModel } from 'src/models/roku/StoreCopy';
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
 * GET /api/roku/campaign/
 * Get all Roku Campaign modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Campaign module Controller - getAllCampaign');
  updateSpinnerText('Getting all campaign modules...');
  try {
    const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll();

    if (!!campaignModels && campaignModels.length) {
      let results: any = [];

      for (let model of campaignModels) {
        const result = await getCampaignModuleData(model);
        results.push(result);
      }

      retWithSuccess(req, res, {
        message: 'Roku Campaign modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku Campaign modules not found',
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Roku getAllCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/campaign/:campaignId
 * Get Roku Campaign module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Campaign module Controller - getCampaign');
  updateSpinnerText('Getting campaign module...');
  try {
    const campaignId: number = Number(req.params.campaignId);
    const campaignModel: RokuCampaignModel = await RokuCampaign.findByPk(campaignId);

    if (campaignModel) {
      const result = await getCampaignModuleData(campaignModel);
      retWithSuccess(req, res, {
        message: 'Roku Campaign module found',
        status: 200,
        data: result,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku Campaign module not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku getCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCampaignModuleData = async (campaignModel: RokuCampaignModel) => {
  let appCopy: any = null;
  if (campaignModel.appCopyId !== null && campaignModel.appCopyId !== undefined) {
    const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(campaignModel.appCopyId);
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
    const skuModel: RokuSkuModel = await RokuSku.findByPk(campaignModel.winbackSkuId);
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
    const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
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
    const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(campaignModel.storeCopyId);
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
        const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
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
 * POST /api/roku/campaign/:store/save?product
 * Save Roku Campaign module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Campaign module Controller - saveCampaign');
  updateSpinnerText('Saving campaign module...');
  const storeModel: RokuStoreModel = await RokuStore.findOne({
    where: { path: req.query.store as string },
  });

  const productModel: RokuProductModel = await RokuProduct.findOne({
    where: { path: req.query.product as string },
  });

  let campaignId: number;
  if (storeModel && productModel) {
    const storeId: number = storeModel.id;
    const productId: number = productModel.id;

    try {
      // Check if the module is the first in DB
      let isDefault: boolean = false;
      const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
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
          status: RokuModuleStatus.DRAFT,
        };
        const campaignResult = await RokuCampaign.create(campaignDBPayload);
        campaignId = campaignResult.id;

        const currentStatus = await getCurrentModuleStatus(campaignResult);
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          campaignResult.set('status', currentStatus);
          await campaignResult.save();
        }

        retWithSuccess(req, res, {
          message: `Roku ${campaignResult.name} Campaign module saved in DB successfully`,
          status: 201,
          data: { campaignId },
        });
      } else {
        throw new AppError('All required parameters are not found', 400);
      }
    } catch (err) {
      logger.error(`Roku saveCampaign failed, ${err.message}`, err);

      // deleting incomplete records from DB
      const campaignModel: RokuCampaignModel = await RokuCampaign.findByPk(campaignId);
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
 * PUT /api/roku/campaign/:campaignId/update
 * Update Roku Campaign module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku Campaign module Controller - updateCampaign');
  updateSpinnerText('Updating campaign module...');
  try {
    const campaignId: number = Number(req.params.campaignId);
    const campaignModel: RokuCampaignModel = await RokuCampaign.findByPk(campaignId);

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
        message: `Roku ${campaignModel.name} Campaign module updated in DB successfully`,
        status: 201,
        data: null,
      });
    } else {
      throw new AppError('Campaign module in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Roku updateCampaign failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/campaign/:campaignId/publish?env
 * Publish Roku Campaign module by campaignId and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishCampaign = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  req.socket.setTimeout(105e4); // increase request socket timeout to 21 minutes
  logger.debug('Roku Campaign module Controller - publishCampaign');
  let campaignModel: RokuCampaignModel;
  let bundleModel: RokuImageCollectionModel;
  try {
    const campaignId: number = Number(req.params.campaignId);
    campaignModel = await RokuCampaign.findByPk(campaignId);
    const env: string = req.query.env as string;
    if (!env) {
      throw new AppError('Environment where to publish Campaign module not found', 404);
    }
    if (!campaignModel) {
      throw new AppError('Campaign module in DB not found', 404);
    }
    // set status to IN PROGRESS
    const envStr = req.query.envStr as string;
    campaignModel.set('status', RokuModuleStatus.PUBLISH_PROGRESS + envStr);
    await campaignModel.save();

    await publishCampaignRetry(
      campaignModel,
      req.body,
      bundleModel,
      env,
      envStr,
    );

    retWithSuccess(req, res, {
      message: `Roku ${campaignModel.name} Campaign module published on ${env.toUpperCase()} successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Roku publishCampaign failed, ${err.message}`, err);
    if (!!campaignModel) {
      campaignModel.set('status', RokuModuleStatus.READY);
      await campaignModel.save();
    }
    if (!!bundleModel) {
      bundleModel.set('status', RokuModuleStatus.READY);
      await bundleModel.save();
    }
    return next(processOfferError(err));
  }
});

export const publishCampaignRetry = async (
  campaignModel: RokuCampaignModel,
  body: any,
  bundleModel: RokuImageCollectionModel,
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
        // const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(campaignModel.appCopyId);
        // const defaultAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne({
        //   where: {
        //     storeId: appCopyModel.storeId,
        //     productId: appCopyModel.productId,
        //     isDefault: true,
        //   },
        // });
        // if (
        //   defaultAppCopyModel &&
        //   defaultAppCopyModel.id !== appCopyModel.id &&
        //   defaultAppCopyModel.status !== RokuModuleStatus.DRAFT &&
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
        const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
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
        const productModel: RokuProductModel = await RokuProduct.findByPk(campaignModel.productId);
        for (let imageCollectionId of imageCollectionIndexesArr) {
          const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
            imageCollectionId,
          );
          if (imageCollectionModel) {
            bundleModel = imageCollectionModel;
            const imageArr: any[] = await getImagesNameAndPathForS3(imageCollectionModel);
            if (!!imageArr && imageArr.length) {
              // set status to IN PROGRESS
              imageCollectionModel.set('status', RokuModuleStatus.PUBLISH_PROGRESS + envStr);
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
        const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(campaignModel.storeCopyId);
        await publishStoreCopyModule(storeCopyModel, env);
      }
      storeCopyPublishFinished = true;
    }

    if (!campaignPublishFinished) {
      // publish Campaign module
      let restCampaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
        where: {
          storeId: campaignModel.storeId,
          productId: campaignModel.productId,
          status: RokuModuleStatus.LIVE,
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

      campaignModel.set('status', RokuModuleStatus.LIVE);
      campaignModel.set('updated', getCurrentDate());
      await campaignModel.save();
    }

    await saveCampaignHistoryModel(campaignModel);
  };
  // setup retry mechanism
  await pRetry(campaignOp, pRetryAll);
};

export const getCurrentModuleStatus = async (campaignModel: RokuCampaignModel) => {
  if (campaignModel.status.includes(RokuModuleStatus.PUBLISH_PROGRESS)) {
    return campaignModel.status;
  }
  if (!campaignModel.deployedTo && !!campaignModel.endedOn) {
    await setModelStatus(campaignModel, RokuModuleStatus.ENDED);
    return RokuModuleStatus.ENDED;
  } else if (!!campaignModel.deployedTo) {
    await setModelStatus(campaignModel, RokuModuleStatus.LIVE);
    return RokuModuleStatus.LIVE;
  } else {
    const isCampaignCompleteResult = await isCampaignComplete(campaignModel);
    if (isCampaignCompleteResult) {
      await setModelStatus(campaignModel, RokuModuleStatus.READY);
      return RokuModuleStatus.READY;
    } else {
      await setModelStatus(campaignModel, RokuModuleStatus.DRAFT);
      return RokuModuleStatus.DRAFT;
    }
  }
};

export const isCampaignComplete = async (campaignModel: RokuCampaignModel) => {
  const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(campaignModel.appCopyId);
  const skuModel: RokuSkuModel = await RokuSku.findByPk(campaignModel.winbackSkuId);
  const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
    campaignModel.selectorConfigId,
  );
  const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(campaignModel.storeCopyId);

  let imageCollectionModelsComplete = new Set<boolean>();
  if (campaignModel.imageCollectionIndexes) {
    const imageCollectionIndexesArr = await getProperImageCollectionIndexesArray(campaignModel.imageCollectionIndexes);
    if (!!imageCollectionIndexesArr && imageCollectionIndexesArr.length) {
      for (let imageCollectionId of imageCollectionIndexesArr) {
        const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
          imageCollectionId,
        );
        if (imageCollectionModel && imageCollectionModel.status !== RokuModuleStatus.DRAFT) {
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
    appCopyModel.status !== RokuModuleStatus.DRAFT &&
    ((!!campaignModel.winbackSkuId && skuModel.status !== RokuModuleStatus.DRAFT) || !campaignModel.winbackSkuId) &&
    ((!!campaignModel.selectorConfigId && selectorConfigModel.status !== RokuModuleStatus.DRAFT) ||
      !campaignModel.selectorConfigId) &&
    (!imageCollectionModelsComplete.has(false) || !imageCollectionModelsComplete.size) &&
    ((!!campaignModel.storeCopyId && storeCopyModel.status !== RokuModuleStatus.DRAFT) || !campaignModel.storeCopyId)
  );
};

export const setLiveCampaignParameter = async (
  storeId: number,
  productId: number,
  moduleType: string,
  env: string,
  id: number,
) => {
  const liveCampaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
    where: {
      status: RokuModuleStatus.LIVE,
      storeId,
      productId,
    },
  });
  if (!!liveCampaignModels && liveCampaignModels.length) {
    const foundCampaignModel = liveCampaignModels.find((model) => model.deployedTo.includes(env));
    if (foundCampaignModel) {
      switch (moduleType) {
        case 'app-copy':
          const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(foundCampaignModel.appCopyId);
          if (!!appCopyModel && appCopyModel.status === RokuModuleStatus.ENDED) {
            foundCampaignModel.set('appCopyId', id);
          }
          break;
        case 'selector-config':
          const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
            foundCampaignModel.selectorConfigId,
          );
          if (!!selectorConfigModel && selectorConfigModel.status === RokuModuleStatus.ENDED) {
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
                const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
                  imageCollectionId,
                );
                if (imageCollectionModel.status === RokuModuleStatus.ENDED) {
                  imageCollectionIndexesArr[i] = id;
                }
              }
              imageCollectionIndexes = imageCollectionIndexesArr.join(',');
              foundCampaignModel.set('imageCollectionIndexes', imageCollectionIndexes);
            }
          }
          break;
        case 'store-copy':
          const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(foundCampaignModel.storeCopyId);
          if (!!storeCopyModel && storeCopyModel.status === RokuModuleStatus.ENDED) {
            foundCampaignModel.set('storeCopyId', id);
          }
          break;
      }
      await foundCampaignModel.save();
    }
  }
};
