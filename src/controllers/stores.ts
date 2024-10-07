import { Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { Brand, Currency, Language, Platform, Region, Store } from '../models';
import asyncHandler from 'express-async-handler';
import {
  BrandInfoPayload,
  CurrencyInfoPayload,
  LanguageInfoPayload,
  PlatformInfoPayload,
  RegionInfoPayload,
  StorePayload,
} from '../types/payload';
import { StoreModel } from '../models/Store';

const logger = Logger(module);

/**
 * GET /api/stores
 * Get all stores
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStores = asyncHandler(
  async (req: Request, res: Response) => {
    logger.debug('Stores Controller - getAllStores');
    const stores = await Store.findAll({
      include: [
        { model: Brand },
        { model: Platform },
        { model: Region, include: [{ model: Language }, { model: Currency }] },
      ],
      order: ['RegionCode', 'BrandCode', 'PlatformCode'],
    });
    let results: StorePayload = {};
    let message = 'No store found';
    if (stores && stores.length > 0) {
      message = 'Stores found';
      stores.forEach((value) => {
        const storeModel = value as StoreModel;
        const platform: PlatformInfoPayload = {
          displayName: storeModel.Platform.title,
          storeCode: storeModel.storeCode,
        };
        const brand: BrandInfoPayload = {
          displayName: storeModel.Brand.title,
          platforms: {
            ...getExistingPlatforms(results, storeModel),
            [storeModel.platformCode]: platform,
          },
        };
        const currency: CurrencyInfoPayload = {
          code: storeModel.Region.Currency.code,
          name: storeModel.Region.Currency.name,
          ratio: storeModel.Region.Currency.ratio,
          prefix: storeModel.Region.Currency.prefix,
        };
        const language: LanguageInfoPayload = {
          name: storeModel.Region.Language.name,
          isFallback: storeModel.Region.Language.isFallback,
        };
        const region: RegionInfoPayload = {
          displayName: storeModel.Region.title,
          description: storeModel.Region.description,
          currency: currency,
          brands: {
            ...getExistingBrands(results, storeModel),
            [storeModel.brandCode]: brand,
          },
          languages: {
            ...getExistingLanguages(results, storeModel),
            [storeModel.Region.Language.languageCode]: language,
          },
        };
        results = { ...results, [storeModel.regionCode]: region };
      });
    }
    retWithSuccess(req, res, {
      message: message,
      data: results,
    });
  },
);

const getExistingBrands = (payload: StorePayload, model: StoreModel) => {
  if ((payload as any)[model.regionCode]) {
    return (payload as any)[model.regionCode].brands;
  }
  return {};
};

const getExistingPlatforms = (payload: StorePayload, model: StoreModel) => {
  const brands = getExistingBrands(payload, model);
  if ((brands as any)[model.brandCode]) {
    return (brands as any)[model.brandCode].platforms;
  }
  return {};
};

const getExistingLanguages = (payload: StorePayload, model: StoreModel) => {
  if ((payload as any)[model.regionCode]) {
    return (payload as any)[model.regionCode].languages;
  }
  return {};
};
