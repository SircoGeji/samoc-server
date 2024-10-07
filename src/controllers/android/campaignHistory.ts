import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidAppCopy,
  AndroidCampaignHistory,
  AndroidImageCollection,
  AndroidSelectorConfig,
  AndroidSku,
  AndroidStoreCopy,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidSelectorConfigModel } from 'src/models/android/SelectorConfig';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import { AndroidAppCopyModel } from 'src/models/android/AppCopy';
import { AndroidImageCollectionModel } from 'src/models/android/ImageCollection';
import { AndroidSkuModel } from 'src/models/android/Sku';
import { AndroidStoreCopyModel } from 'src/models/android/StoreCopy';
import { getAppCopyModuleData } from './appCopy';
import { getSkuModuleData } from './sku';
import { getSelectorConfigModuleData } from './selectorConfig';
import { getStoreCopyModuleData } from './storeCopy';
import { getImageCollectionModuleData } from './image';
import { getCurrentDate } from '.';
import { AndroidCampaignHistoryModel } from 'src/models/android/CampaignHistory';
import { getProperImageCollectionIndexesArray } from './multiModules';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/campaign/history/
 * Get all Android CampaignHistory modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCampaignHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CampaignHistory module Controller - getAllCampaignHistory');
  updateSpinnerText('Getting all campaign history modules...');
  try {
    const campaignHistoryModels: AndroidCampaignHistoryModel[] = await AndroidCampaignHistory.findAll();

    if (campaignHistoryModels.length) {
      let results: any = [];

      for (let model of campaignHistoryModels) {
        const result = await getCampaignHistoryModuleData(model);
        if (result) {
          results.push(result);
        }
      }

      retWithSuccess(req, res, {
        message: 'Android CampaignHistory modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Android CampaignHistory modules not found',
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Android getAllCampaignHistory failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/campaign/history/:campaignId
 * Get Android CampaignHistory module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCampaignHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android CampaignHistory module Controller - getCampaignHistory');
  updateSpinnerText('Getting campaign history module...');
  try {
    const campaignHistoryId: number = Number(req.params.campaignHistoryId);
    const campaignHistoryModel: AndroidCampaignHistoryModel = await AndroidCampaignHistory.findByPk(campaignHistoryId);

    if (campaignHistoryModel) {
      const result = await getCampaignHistoryModuleData(campaignHistoryModel);
      retWithSuccess(req, res, {
        message: 'Android CampaignHistory module found',
        status: 200,
        data: result,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Android CampaignHistory module not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android getCampaignHistory failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCampaignHistoryModuleData = async (campaignHistoryModel: AndroidCampaignHistoryModel) => {
  let appCopy: any = null;
  if (campaignHistoryModel.appCopyId !== null && campaignHistoryModel.appCopyId !== undefined) {
    const appCopyModel: AndroidAppCopyModel = await AndroidAppCopy.findByPk(campaignHistoryModel.appCopyId);
    const appCopyData = await getAppCopyModuleData(appCopyModel);
    appCopy = {
      appCopyId: appCopyData.appCopyId,
      name: appCopyData.name,
      status: appCopyData.status,
      platforms: appCopyData.platforms,
    };
  }
  let sku: any = null;
  if (campaignHistoryModel.winbackSkuId !== null && campaignHistoryModel.winbackSkuId !== undefined) {
    const skuModel: AndroidSkuModel = await AndroidSku.findByPk(campaignHistoryModel.winbackSkuId);
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
  if (campaignHistoryModel.selectorConfigId !== null && campaignHistoryModel.selectorConfigId !== undefined) {
    const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
      campaignHistoryModel.selectorConfigId,
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
  if (campaignHistoryModel.storeCopyId !== null && campaignHistoryModel.storeCopyId !== undefined) {
    const storeCopyModel: AndroidStoreCopyModel = await AndroidStoreCopy.findByPk(campaignHistoryModel.storeCopyId);
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
  if (
    campaignHistoryModel.imageCollectionIndexes !== null &&
    campaignHistoryModel.imageCollectionIndexes !== undefined
  ) {
    const imageCollectionIndexes = await getProperImageCollectionIndexesArray(
      campaignHistoryModel.imageCollectionIndexes,
    );
    if (imageCollectionIndexes && imageCollectionIndexes.length) {
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

  return {
    campaignHistoryId: campaignHistoryModel.id,
    created: campaignHistoryModel.created,
    updated: campaignHistoryModel.updated,
    storeId: campaignHistoryModel.storeId,
    productId: campaignHistoryModel.productId,
    name: campaignHistoryModel.name,
    startDate: campaignHistoryModel.startDate,
    endDate: campaignHistoryModel.endDate,
    appCopy,
    sku,
    selectorConfig,
    storeCopy,
    imageCollection,
  };
};

export const saveCampaignHistoryModel = async (campaignModel: AndroidCampaignModel) => {
  updateSpinnerText('Saving campaign history module...');
  if (campaignModel) {
    let campaignHistoryId: number;
    try {
      const campaignHistoryDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!campaignModel.createdBy ? campaignModel.createdBy : null,
        storeId: campaignModel.storeId,
        productId: campaignModel.productId,
        name: campaignModel.name,
        startDate: `${campaignModel.startDate}`,
        endDate: `${campaignModel.endDate}`,
        appCopyId: campaignModel.appCopyId,
        selectorConfigId: campaignModel.selectorConfigId,
        imageCollectionIndexes: campaignModel.imageCollectionIndexes,
        winbackSkuId: campaignModel.winbackSkuId,
        storeCopyId: campaignModel.storeCopyId,
      };
      const campaignHistoryResult = await AndroidCampaignHistory.create(campaignHistoryDBPayload);
      campaignHistoryId = campaignHistoryResult.id;
    } catch (err) {
      throw new AppError(err, 400);
    }
  } else {
    throw new AppError('Campaign model is required', 400);
  }
};
