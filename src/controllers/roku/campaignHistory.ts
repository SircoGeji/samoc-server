import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuAppCopy,
  RokuCampaignHistory,
  RokuImageCollection,
  RokuSelectorConfig,
  RokuSku,
  RokuStoreCopy,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuSelectorConfigModel } from 'src/models/roku/SelectorConfig';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { RokuAppCopyModel } from 'src/models/roku/AppCopy';
import { RokuImageCollectionModel } from 'src/models/roku/ImageCollection';
import { RokuSkuModel } from 'src/models/roku/Sku';
import { RokuStoreCopyModel } from 'src/models/roku/StoreCopy';
import { getAppCopyModuleData } from './appCopy';
import { getSkuModuleData } from './sku';
import { getSelectorConfigModuleData } from './selectorConfig';
import { getStoreCopyModuleData } from './storeCopy';
import { getImageCollectionModuleData } from './image';
import { getCurrentDate } from '.';
import { RokuCampaignHistoryModel } from 'src/models/roku/CampaignHistory';
import { getProperImageCollectionIndexesArray } from './multiModules';
import { updateSpinnerText } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/campaign/history/
 * Get all Roku CampaignHistory modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllCampaignHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CampaignHistory module Controller - getAllCampaignHistory');
  updateSpinnerText('Getting all campaign history modules...');
  try {
    const campaignHistoryModels: RokuCampaignHistoryModel[] = await RokuCampaignHistory.findAll();

    if (campaignHistoryModels.length) {
      let results: any = [];

      for (let model of campaignHistoryModels) {
        const result = await getCampaignHistoryModuleData(model);
        if (result) {
          results.push(result);
        }
      }

      retWithSuccess(req, res, {
        message: 'Roku CampaignHistory modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku CampaignHistory modules not found',
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Roku getAllCampaignHistory failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/campaign/history/:campaignId
 * Get Roku CampaignHistory module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getCampaignHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku CampaignHistory module Controller - getCampaignHistory');
  updateSpinnerText('Getting campaign history module...');
  try {
    const campaignHistoryId: number = Number(req.params.campaignHistoryId);
    const campaignHistoryModel: RokuCampaignHistoryModel = await RokuCampaignHistory.findByPk(campaignHistoryId);

    if (campaignHistoryModel) {
      const result = await getCampaignHistoryModuleData(campaignHistoryModel);
      retWithSuccess(req, res, {
        message: 'Roku CampaignHistory module found',
        status: 200,
        data: result,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku CampaignHistory module not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku getCampaignHistory failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getCampaignHistoryModuleData = async (campaignHistoryModel: RokuCampaignHistoryModel) => {
  let appCopy: any = null;
  if (campaignHistoryModel.appCopyId !== null && campaignHistoryModel.appCopyId !== undefined) {
    const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(campaignHistoryModel.appCopyId);
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
    const skuModel: RokuSkuModel = await RokuSku.findByPk(campaignHistoryModel.winbackSkuId);
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
    const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
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
    const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(campaignHistoryModel.storeCopyId);
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

export const saveCampaignHistoryModel = async (campaignModel: RokuCampaignModel) => {
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
      const campaignHistoryResult = await RokuCampaignHistory.create(campaignHistoryDBPayload);
      campaignHistoryId = campaignHistoryResult.id;
    } catch (err) {
      throw new AppError(err, 400);
    }
  } else {
    throw new AppError('Campaign model is required', 400);
  }
};
