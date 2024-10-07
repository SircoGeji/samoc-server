import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidCampaign,
  AndroidCampaignHistory,
  AndroidCountry,
  AndroidCountryLanguage,
  AndroidEnvironments,
  AndroidLanguage,
  AndroidProduct,
  AndroidSelectorConfig,
  AndroidSelectorConfigSku,
  AndroidSku,
  AndroidSkuField,
  AndroidSkuValue,
  AndroidStore,
} from '../../models';
import { getProperValue, processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidCountryModel } from 'src/models/android/Country';
import { AndroidLanguageModel } from 'src/models/android/Language';
import { AndroidProductModel } from 'src/models/android/Product';
import {
  AndroidEnv,
  AndroidModuleStatus,
  AndroidModuleValueStatus,
} from '../../types/enum';
import { AndroidSkuFieldModel } from 'src/models/android/SkuField';
import { AndroidSkuModel } from 'src/models/android/Sku';
import { AndroidSkuValueModel } from 'src/models/android/SkuValue';
import { getCurrentDate } from '.';
import { AndroidCountryLanguageModel } from 'src/models/android/CountryLanguage';
import { AndroidSelectorConfigModel } from 'src/models/android/SelectorConfig';
import { AndroidSelectorConfigSkuModel } from 'src/models/android/SelectorConfigSku';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import {
  isTokenValid,
  setModelParameterNull,
  setModelStatus,
} from './multiModules';
import { updateSpinnerText, whitespaceSort } from '../../util/utils';
import { publishSelectorConfigModule } from './selectorConfig';
import { getAuthToken } from '../../services/GateKeeper';
import { checkTardisConnection, requestUrl } from '../../services/Tardis';
import { setLiveCampaignParameter } from './campaign';
import axios from 'axios';
import { AndroidEnvironmentsModel } from 'src/models/android/AndroidEnvironments';

const logger = Logger(module);

/**
 * GET /api/android/sku/fields?store
 * Get Android SKU fields list by store
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuFields = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android SKU fields Controller - getSkuFields');
    updateSpinnerText('Getting sku module fields...');
    try {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        const skuFieldModels: AndroidSkuFieldModel[] = await AndroidSkuField.findAll(
          {
            where: { storeId },
          },
        );

        let message = `No Android Sku fields found`;
        if (skuFieldModels) {
          message = `Android Sku fields found`;
          const results = skuFieldModels.map((model) => {
            return {
              fieldName: model.name,
              dataType: model.type,
              translatable: model.translatable,
              maxLength: model.charLimit,
              required: model.required,
              order: model.order,
            };
          });

          retWithSuccess(req, res, {
            message: message,
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
      } else {
        retWithSuccess(req, res, {
          message: 'No such store found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android getSkuFields failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/sku/preview?product
 * Get Android SKU preview images list by product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuSelectPreviewImages = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android SKU module Controller - getSkuSelectPreviewImages');
    updateSpinnerText('Getting sku preview images...');
    try {
      const productModel: AndroidProductModel = await AndroidProduct.findOne({
        where: { path: req.query.product },
      });
      if (productModel) {
        const baseUrl = process.env.ANDROID_PREVIEW_IMAGE_BASE_URL;
        let result: any = [
          {
            name: 'Mobile Selector',
            url: `${baseUrl}/sku/${productModel.path}_mobile_selector.png`,
          },
          {
            name: 'Mobile Winback',
            url: `${baseUrl}/sku/${productModel.path}_mobile_winback.png`,
          },
          {
            name: 'TV Selector',
            url: `${baseUrl}/sku/${productModel.path}_tv_selector.png`,
          },
          {
            name: 'TV Winback',
            url: `${baseUrl}/sku/${productModel.path}_tv_winback.png`,
          },
        ];

        retWithSuccess(req, res, {
          message: 'Android Sku module select preview images found',
          status: 200,
          data: result,
        });
      } else {
        throw new AppError(`Such product model not found`, 404);
      }
    } catch (err) {
      logger.error(
        `Android getSkuSelectPreviewImages failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/sku/
 * Get all Android Sku modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - getAllSku');
    updateSpinnerText('Getting all sku modules...');
    try {
      const skuModels: AndroidSkuModel[] = await AndroidSku.findAll();

      let message = `No Android Sku modules found`;
      if (skuModels) {
        message = `Android Sku modules found`;
        let results: any = [];

        for (let model of skuModels) {
          const result = await getSkuModuleData(model);
          results.push(result);
        }

        retWithSuccess(req, res, {
          message: message,
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
      logger.error(`Android getAllSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/sku/:skuId
 * Get Android Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - getSku');
    updateSpinnerText('Getting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);

      let message = `No such Android Sku module found`;
      if (skuModel) {
        message = `Android Sku module found`;
        const result = await getSkuModuleData(skuModel);

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
      logger.error(`Android getSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getSkuModuleData = async (skuModel: AndroidSkuModel) => {
  const languageModels: AndroidLanguageModel[] = await AndroidLanguage.findAll();
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll();
  const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll();
  const skuFieldModels: AndroidSkuFieldModel[] = await AndroidSkuField.findAll();

  const countryLanguageIndexes = new Set<number>();
  skuValueModels.forEach((model) =>
    countryLanguageIndexes.add(model.countryLanguageId),
  );
  let countries: any = {};
  const countryIndexes = new Set<number>();
  countryLanguageIndexes.forEach((countryLanguageId) => {
    const countryId = countryLanguageModels.find(
      (country) => country.id === countryLanguageId,
    ).countryId;
    countryIndexes.add(countryId);
  });
  countryIndexes.forEach((countryId) => {
    const countryCode = countryModels.find(
      (country) => country.id === countryId,
    ).code;
    const currentCountryCountryLanguageModels = countryLanguageModels.filter(
      (model) => model.countryId === countryId,
    );
    const currentCountryCountryLanguageIndexes = new Set<number>();
    currentCountryCountryLanguageModels.forEach((model) =>
      currentCountryCountryLanguageIndexes.add(model.id),
    );
    const countryValueData: AndroidSkuValueModel[] = skuValueModels.filter(
      (elem) => {
        return currentCountryCountryLanguageIndexes.has(elem.countryLanguageId);
      },
    );

    let languages: any;
    let countryStatusSet = new Set<string>();
    currentCountryCountryLanguageModels.forEach((countryLanguageModel) => {
      const languageCode = languageModels.find(
        (language) => language.id === countryLanguageModel.languageId,
      ).code;
      const languageValueData: AndroidSkuValueModel[] = countryValueData.filter(
        (elem) => {
          return elem.countryLanguageId === countryLanguageModel.id;
        },
      );

      let fieldsValues: any;
      languageValueData.forEach((elem) => {
        const skuFieldModel: AndroidSkuFieldModel = skuFieldModels.find(
          (field) => field.id === elem.skuFieldId,
        );
        if (!!skuFieldModel) {
          fieldsValues = {
            ...fieldsValues,
            [skuFieldModel.name]: getProperValue(
              elem.value,
              skuFieldModel.type,
            ),
          };
          countryStatusSet.add(elem.status);
        }
      });
      languages = { ...languages, [languageCode]: fieldsValues };
    });
    countries = {
      ...countries,
      [countryCode]: { status: getCountryStatus(countryStatusSet), languages },
    };
  });

  let usedInLiveCampaign = false;
  const isSkuUsedInCampaign = await getSkuModuleUsage(skuModel.id);
  if (isSkuUsedInCampaign !== null) {
    const usedCampaignName = isSkuUsedInCampaign[0];
    const campaignModel: AndroidCampaignModel = await AndroidCampaign.findOne({
      where: { name: usedCampaignName },
    });
    if (campaignModel.status === AndroidModuleStatus.LIVE) {
      usedInLiveCampaign = true;
    }
  }
  const usedInLiveOnProdCampaign = await isUsedInLiveOnProdCampaign(skuModel);
  return {
    created: skuModel.created,
    updated: skuModel.updated,
    storeId: skuModel.storeId,
    productId: skuModel.productId,
    envId: skuModel.envId,
    promotionId: skuModel.promotionId,
    hasChanges: skuModel.hasChanges,
    skuId: skuModel.id,
    name: skuModel.name,
    parentSkuId: skuModel.parentSkuId,
    storeSkuId: skuModel.storeSkuId,
    linkId: skuModel.linkId,
    isPublished: skuModel.isPublished,
    status: skuModel.status,
    isArchived: skuModel.isArchived,
    countries,
    active: skuModel.active,
    usedInLiveCampaign,
    usedInLiveOnProdCampaign,
    promotedAt: skuModel.promotedAt,
    needToPromote: skuModel.needToPromote,
  };
};

const isUsedInLiveOnProdCampaign = async (
  skuModel: AndroidSkuModel,
): Promise<boolean> => {
  const liveCampaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll(
    {
      where: { winbackSkuId: skuModel.id, status: AndroidModuleStatus.LIVE },
    },
  );
  if (!liveCampaignModels.length) {
    return false;
  }
  const liveOnProdCampaignModels = liveCampaignModels.filter((model) =>
    model.deployedTo.includes('prod'),
  );
  if (!liveOnProdCampaignModels.length) {
    return false;
  } else {
    return true;
  }
};

/**
 * POST /api/android/sku/:store/save?product
 * Save Android Sku module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - saveSku');
    updateSpinnerText('Saving sku module...');
    const storeModel: AndroidStoreModel = await AndroidStore.findOne({
      where: { path: req.query.store as string },
    });
    const storeId: number = storeModel.id;

    const productModel: AndroidProductModel = await AndroidProduct.findOne({
      where: { path: req.query.product as string },
    });
    const productId: number = productModel.id;

    const envModel: AndroidEnvironmentsModel = await AndroidEnvironments.findOne(
      {
        where: { code: req.query.env as string },
      },
    );
    const envId: number = envModel.id;
    let skuId: number;

    if (storeModel && productModel) {
      try {
        const skuDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          envId,
          hasChanges: false,
          name: req.body.name,
          parentSkuId: req.body.parentSkuId,
          storeSkuId: req.body.storeSkuId,
          linkId: req.body.linkId,
          status: AndroidModuleStatus.DRAFT,
          isPublished: false,
          isArchived: false,
          active: false,
          needToPromote: false,
        };
        const skuResult = await AndroidSku.create(skuDBPayload);
        skuId = skuResult.id;
        await createSkuValueModelsFromBody(skuResult, req.body);

        const currentStatus = await getCurrentModuleStatus(skuResult);
        if (currentStatus !== AndroidModuleStatus.DRAFT) {
          skuResult.set('status', currentStatus);
          await skuResult.save();
        }

        retWithSuccess(req, res, {
          message: `Android ${skuResult.name} Sku module saved in DB on ${envModel.name} environment successfully`,
          status: 201,
          data: { skuId },
        });
      } catch (err) {
        logger.error(`Android saveSku failed, ${err.message}`, err);

        // deleting incomplete records from DB
        const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);
        await skuModel.destroy({ force: true });

        return next(processOfferError(err));
      }
    } else {
      retWithSuccess(req, res, {
        message: `No such Android store or product found`,
        status: 200,
        data: null,
      });
    }
  },
);

/**
 * PUT /api/android/sku/:skuId/update
 * Update Android Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - updateSku');
    updateSpinnerText('Updating sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);

      if (skuModel) {
        if (req.query.status !== undefined) {
          skuModel.set('status', req.query.status);
        } else {
          if (req.query.country) {
            const countryModel: AndroidCountryModel = await AndroidCountry.findOne(
              {
                where: {
                  storeId: skuModel.storeId,
                  productId: skuModel.productId,
                  code: req.query.country,
                },
              },
            );
            await updateSkuValueModels(skuId, req.body, countryModel.id);
          } else {
            await updateSkuValueModels(skuId, req.body.countries, null);
            skuModel.set('name', req.body.name);
            skuModel.set('parentSkuId', req.body.parentSkuId);
            skuModel.set('storeSkuId', req.body.storeSkuId);
            skuModel.set('linkId', req.body.linkId);
          }
        }

        const currentStatus = await getCurrentModuleStatus(skuModel);
        skuModel.set('status', currentStatus);
        if (!!skuModel.promotedAt) {
          skuModel.set('needToPromote', true);
        }
        skuModel.set('updated', getCurrentDate());
        await skuModel.save();

        retWithSuccess(req, res, {
          message: `Android ${skuModel.name} Sku module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Android Sku module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android updateSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const changeSelectorConfigModule = async (
  skuModel: AndroidSkuModel,
  currentStatus: string,
) => {
  let selectorConfigStatus;
  let selectorConfigValueStatus;

  if (currentStatus === AndroidModuleStatus.DRAFT) {
    selectorConfigStatus = AndroidModuleStatus.DRAFT;
    selectorConfigValueStatus = AndroidModuleValueStatus.INCOMPLETE;
  } else if (currentStatus === AndroidModuleStatus.COMPLETE) {
    selectorConfigStatus = AndroidModuleStatus.COMPLETE;
    selectorConfigValueStatus = AndroidModuleValueStatus.SAVED;
  }

  if (selectorConfigStatus && selectorConfigValueStatus) {
    const selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
      {
        where: { skuId: skuModel.id },
      },
    );
    let skuIndexesSet = new Set<number>();
    if (selectorConfigSkuModels.length) {
      for (let selectorConfigSkuModel of selectorConfigSkuModels) {
        if (selectorConfigSkuModel.status !== AndroidModuleValueStatus.ENDED) {
          if (
            selectorConfigSkuModel.status !== AndroidModuleValueStatus.PUBLISHED
          ) {
            selectorConfigSkuModel.set('status', selectorConfigValueStatus);
            await selectorConfigSkuModel.save();
          }
          skuIndexesSet.add(selectorConfigSkuModel.skuId);
        }
      }

      for (let skuId of skuIndexesSet) {
        const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
          skuId,
        );
        if (
          selectorConfigModel &&
          selectorConfigModel.status !== AndroidModuleStatus.ENDED
        ) {
          if (
            selectorConfigModel.status === AndroidModuleStatus.LIVE &&
            !!selectorConfigModel.deployedTo
          ) {
            const envArr = selectorConfigModel.deployedTo.split('-');
            for (let env of envArr) {
              await publishSelectorConfigModule(selectorConfigModel, env, null);
            }
          } else {
            selectorConfigModel.set('status', selectorConfigStatus);
            await selectorConfigModel.save();
          }
        }
      }
    }
  }
};

/**
 * PUT /api/android/sku/:skuId/archive
 * Archive Android Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const archiveSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - archiveSku');
    updateSpinnerText('Archiving sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);

      if (skuModel) {
        if (!skuModel.active) {
          await setModelParameterNull('winbackSkuId', skuId, AndroidCampaign);
          await setModelParameterNull(
            'winbackSkuId',
            skuId,
            AndroidCampaignHistory,
          );

          skuModel.set('isArchived', !skuModel.isArchived);
          skuModel.set('updated', getCurrentDate());
          await skuModel.save();

          retWithSuccess(req, res, {
            message: `Android ${skuModel.name} Sku module ${
              !!skuModel.isArchived ? 'archived' : 'unarchived'
            } in DB successfully`,
            status: 201,
            data: null,
          });
        } else {
          throw new AppError(`Active Sku module couldn't be archived`, 500);
        }
      } else {
        retWithSuccess(req, res, {
          message: 'No such Android Sku module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android archiveSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/sku/:skuId/usage
 * Get Android Sku module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - getSkuUsage');
    updateSpinnerText('Getting sku module usage...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);

      if (skuModel) {
        const data = await getSkuModuleUsage(skuId);

        retWithSuccess(req, res, {
          message: `Android ${skuModel.name} Sku module usage data found`,
          status: 201,
          data,
        });
      } else {
        throw new AppError('Sku module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Android getSkuUsage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/android/sku/publish
 * Publish Android Sku modules list
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishSkuList = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - publishSkuList');
    updateSpinnerText('Publishing sku modules list...');
    const { data, storeId, productId, envId } = req.body;
    if (!req.body.data) {
      throw new AppError(
        'Data array is mandatory in publish request body',
        400,
      );
    }
    if (!data) {
      throw new AppError(
        'Invalid value for DATA key in publish body request',
        400,
      );
    }
    try {
      // check that Tardis connection is established
      let tardisToken = '';
      let tardisTokenExpiresAt = '';
      if (!isTokenValid(req.body)) {
        [tardisToken, tardisTokenExpiresAt] = await getAuthToken();
      }
      await checkTardisConnection(tardisToken);

      const reversedData = data.reverse();
      const publishModulesIndexesSet = new Set<number>(reversedData);
      await unpublishRestModules(
        storeId,
        productId,
        envId,
        publishModulesIndexesSet,
      );

      for (let skuId of publishModulesIndexesSet) {
        const foundSkuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);
        if (!!foundSkuModel) {
          await publishSkuModule(foundSkuModel, envId);
        }
      }
      // deploy live Sku modules list to Tardis service
      const deployData = await deployTardisSkuList(
        storeId,
        productId,
        publishModulesIndexesSet,
        envId,
        tardisToken,
      );

      retWithSuccess(req, res, {
        message: `Android Sku modules list published successfully`,
        status: 201,
        data: deployData,
      });
    } catch (err) {
      logger.error(`Android pusblishSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const unpublishRestModules = async (
  storeId: number,
  productId: number,
  envId: number,
  publishModulesIndexesSet: Set<number>,
) => {
  let restLiveModels: AndroidSkuModel[] = await AndroidSku.findAll({
    where: {
      storeId,
      productId,
      envId,
      isPublished: true,
    },
  });
  restLiveModels = restLiveModels.filter(
    (module) => !publishModulesIndexesSet.has(module.id),
  );
  for (let restLiveModel of restLiveModels) {
    // unpublish all SkuValue models of published module
    const restLiveValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
      {
        where: { skuId: restLiveModel.id },
      },
    );
    for (let restLiveValueModel of restLiveValueModels) {
      restLiveValueModel.set('status', AndroidModuleValueStatus.ENDED);
      restLiveValueModel.set('updated', getCurrentDate());
      await restLiveValueModel.save();
    }
    restLiveModel.set('isPublished', false);
    restLiveModel.set('status', AndroidModuleStatus.ENDED);
    restLiveModel.set('updated', getCurrentDate());
    await restLiveModel.save();
  }
};

export const publishSkuModule = async (
  skuModel: AndroidSkuModel,
  envId: number,
) => {
  const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  await publishSkuValueModels(skuValueModels);
  skuModel.set('status', AndroidModuleStatus.LIVE);
  skuModel.set('isPublished', true);
  skuModel.set('updated', getCurrentDate());
  await skuModel.save();
  const envModel: AndroidEnvironmentsModel = await AndroidEnvironments.findByPk(
    envId,
  );
  await setLiveCampaignParameter(
    skuModel.storeId,
    skuModel.productId,
    'sku',
    envModel.code,
    skuModel.id,
  );
};

export const publishSkuValueModels = async (
  skuValueModels: AndroidSkuValueModel[],
) => {
  for (const model of skuValueModels) {
    model.set('status', AndroidModuleValueStatus.PUBLISHED);
    model.set('updated', getCurrentDate());
    await model.save();
  }
};

/**
 * POST /api/android/sku/:skuId/promote
 * Promote Android Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const promoteSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - promoteSku');
    updateSpinnerText('Promoting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);
      const env: string = req.query.env as string;

      if (!skuModel) {
        throw new AppError('Sku module in DB not found', 404);
      }

      skuModel.set('updated', getCurrentDate());
      if (env === AndroidEnv.PROD) {
        skuModel.set('promotedAt', getCurrentDate());
        skuModel.set('needToPromote', false);
      }
      await skuModel.save();

      const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
        {
          where: { skuId },
        },
      );

      if (!skuValueModels || !skuValueModels.length) {
        throw new AppError('SkuValue modules in DB not found', 404);
      }

      let promotedSku: any = null;
      const envModel: AndroidEnvironmentsModel = await AndroidEnvironments.findOne(
        {
          where: { code: env },
        },
      );
      const foundPromotedSkuModel: AndroidSkuModel = await AndroidSku.findOne({
        where: { promotionId: skuId, envId: envModel.id },
      });

      let message = '';

      const foundStagedSkuModel: AndroidSkuModel = await getStagedSkuModel(
        skuId,
        env,
      );

      if (!!foundPromotedSkuModel) {
        const isPromotedSkuSameAsOriginalRes = await isPromotedSkuSameAsOriginal(
          skuModel,
          foundPromotedSkuModel,
        );
        message = `Android "${foundPromotedSkuModel.name}" Sku module promoted without changes`;
        if (!!foundStagedSkuModel) {
          updateAndroidSku(skuModel, foundStagedSkuModel);
          updateAndroidSkuValues(skuModel.id, foundStagedSkuModel.id);
          promotedSku = await getSkuModuleData(foundPromotedSkuModel);
        } else {
          promotedSku = await createPromotedSku(
            skuModel,
            skuValueModels,
            true,
            env,
          );
        }
        if (!isPromotedSkuSameAsOriginalRes) {
          foundPromotedSkuModel.set('hasChanges', true);
          foundPromotedSkuModel.set('updated', getCurrentDate());
          await foundPromotedSkuModel.save();
          message = `Android "${promotedSku.name}" Sku module promoted in DB successfully`;
        }
      } else {
        promotedSku = await createPromotedSku(
          skuModel,
          skuValueModels,
          false,
          env,
        );
        message = `Android "${promotedSku.name}" Sku module promoted in DB successfully`;
      }

      retWithSuccess(req, res, {
        message,
        status: 201,
        data: !!promotedSku ? { ...promotedSku } : null,
      });
    } catch (err) {
      logger.error(`Android promoteSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const getStagedSkuModel = async (stagedId: number, env: string) => {
  let stageEnvId;
  if (env === AndroidEnv.PROD) {
    const stgProdEnvModel: AndroidEnvironmentsModel = await AndroidEnvironments.findOne(
      {
        where: { code: AndroidEnv.STG_PROD },
      },
    );
    stageEnvId = stgProdEnvModel.id;
  } else {
    const stgQAEnvModel: AndroidEnvironmentsModel = await AndroidEnvironments.findOne(
      {
        where: { code: AndroidEnv.STG_QA },
      },
    );
    stageEnvId = stgQAEnvModel.id;
  }
  return await AndroidSku.findOne({
    where: { stagedId, envId: stageEnvId },
  });
};

const createPromotedSku = async (
  skuModel: AndroidSkuModel,
  skuValueModels: AndroidSkuValueModel[],
  isStg: boolean,
  env: string,
) => {
  const code = `${!isStg ? '' : 'stg-'}${env}`;
  const envModel: AndroidEnvironmentsModel = await AndroidEnvironments.findOne({
    where: { code },
  });
  const promoteSkuDBPayload = {
    created: getCurrentDate(),
    updated: getCurrentDate(),
    createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
    storeId: skuModel.storeId,
    productId: skuModel.productId,
    envId: envModel.id,
    stagedId: !isStg ? null : skuModel.id,
    promotionId: skuModel.id,
    hasChanges: false,
    name: skuModel.name,
    isPublished: false,
    active: false,
    parentSkuId: skuModel.parentSkuId,
    storeSkuId: skuModel.storeSkuId,
    linkId: skuModel.linkId,
    isArchived: skuModel.isArchived,
    status: AndroidModuleStatus.DRAFT,
    needToPromote: false,
  };
  const promoteSkuResult = await AndroidSku.create(promoteSkuDBPayload);
  createSkuValueModels(skuValueModels, promoteSkuResult);
  const currentStatus = await getCurrentModuleStatus(promoteSkuResult);
  if (currentStatus !== AndroidModuleStatus.DRAFT) {
    promoteSkuResult.set('status', currentStatus);
    await promoteSkuResult.save();
  }
  return await getSkuModuleData(promoteSkuResult);
};

const updateAndroidSkuValues = async (
  sourceSkuId: number,
  destinationSkuId: number,
) => {
  const sourceSkuValues = await AndroidSkuValue.findAll({
    where: { skuId: sourceSkuId },
  });
  const destinationSkuValues = await AndroidSkuValue.findAll({
    where: { skuId: destinationSkuId },
  });

  const destinationSkuModel = await AndroidSku.findByPk(destinationSkuId);

  if (!!sourceSkuValues) {
    for (const sourceSkuValueModel of sourceSkuValues) {
      const foundDestinationSkuValueModel = destinationSkuValues.find(
        (destinationSkuValueModel) =>
          sourceSkuValueModel.skuFieldId ===
            destinationSkuValueModel.skuFieldId &&
          sourceSkuValueModel.countryLanguageId ===
            destinationSkuValueModel.countryLanguageId,
      );
      if (!!foundDestinationSkuValueModel) {
        const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
          foundDestinationSkuValueModel.skuFieldId,
        );
        foundDestinationSkuValueModel.set(
          'value',
          getProperValue(
            sourceSkuValueModel.value,
            foundSkuFieldModel.type,
            true,
          ),
        );
        foundDestinationSkuValueModel.set('status', sourceSkuValueModel.status);
        foundDestinationSkuValueModel.set('updated', getCurrentDate());
        await foundDestinationSkuValueModel.save();
      } else {
        const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
          sourceSkuValueModel.skuFieldId,
        );
        const skuValueDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!destinationSkuModel.createdBy
            ? destinationSkuModel.createdBy
            : null,
          skuId: !!destinationSkuModel
            ? destinationSkuModel.id
            : sourceSkuValueModel.skuId,
          countryLanguageId: sourceSkuValueModel.countryLanguageId,
          skuFieldId: sourceSkuValueModel.skuFieldId,
          value: getProperValue(
            sourceSkuValueModel.value,
            foundSkuFieldModel.type,
            true,
          ),
          status: sourceSkuValueModel.status,
        };
        await AndroidSkuValue.create(skuValueDBPayload);
      }
    }
  } else {
    throw new AppError(
      'Unable to update sku, source sku values not found.',
      404,
    );
  }
};

const updateAndroidSku = async (
  oldSku: AndroidSkuModel,
  newSku: AndroidSkuModel,
) => {
  newSku.set('updated', getCurrentDate());
  newSku.set('name', oldSku.name);
  newSku.set('parentSkuId', oldSku.parentSkuId);
  newSku.set('storeSkuId', oldSku.storeSkuId);
  newSku.set('linkId', oldSku.linkId);
  const currentStatus = await getCurrentModuleStatus(oldSku);
  newSku.set('status', currentStatus);
  newSku.save();
};

/**
 * POST /api/android/sku/:skuId/pull?env&acceptChanges
 * Pull Android promotion Sku module by skuId to it's promotion module
 * @param {Request}     req
 * @param {Response}    res
 */
export const pullPromotionSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android Sku module Controller - promoteSku');
    updateSpinnerText('Promoting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const promotedSkuModel: AndroidSkuModel = await AndroidSku.findByPk(
        skuId,
      );
      const env: string = req.query.env as string;
      const acceptChanges: boolean = req.query.acceptChanges === 'true';

      if (!promotedSkuModel) {
        throw new AppError('Sku module in DB not found', 404);
      }

      const promotedSkuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
        {
          where: { skuId },
        },
      );

      if (!promotedSkuValueModels || !promotedSkuValueModels.length) {
        throw new AppError('Promoted SkuValue modules in DB not found', 404);
      }

      const foundStagedSkuModel: AndroidSkuModel = await getStagedSkuModel(
        promotedSkuModel.promotionId,
        env,
      );

      if (!foundStagedSkuModel) {
        throw new AppError('No staged sku model found', 404);
      }

      let message = `"${promotedSkuModel.name}" SKU changes from the Client Dev environment have been discarded`;
      if (!!acceptChanges) {
        message = `"${promotedSkuModel.name}" SKU changes from the Client Dev environment have been accepted`;
        const foundStagedSkuValueModels = await AndroidSkuValue.findAll({
          where: { skuId: foundStagedSkuModel.id },
        });
        for (let foundStagedSkuValueModel of foundStagedSkuValueModels) {
          const foundPromotedSkuValueModel = promotedSkuValueModels.find(
            (promotedSkuValueModel) =>
              foundStagedSkuValueModel.skuFieldId ===
                promotedSkuValueModel.skuFieldId &&
              foundStagedSkuValueModel.countryLanguageId ===
                promotedSkuValueModel.countryLanguageId,
          );
          if (!!foundPromotedSkuValueModel) {
            const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
              foundPromotedSkuValueModel.skuFieldId,
            );
            foundPromotedSkuValueModel.set(
              'value',
              getProperValue(
                foundStagedSkuValueModel.value,
                foundSkuFieldModel.type,
                true,
              ),
            );
            foundPromotedSkuValueModel.set(
              'status',
              foundStagedSkuValueModel.status,
            );
            foundPromotedSkuValueModel.set('updated', getCurrentDate());
            await foundPromotedSkuValueModel.save();
          } else {
            createSkuValueModels([foundStagedSkuValueModel], promotedSkuModel);
          }
        }
        promotedSkuModel.set('name', foundStagedSkuModel.name);
        promotedSkuModel.set('parentSkuId', foundStagedSkuModel.parentSkuId);
        promotedSkuModel.set('storeSkuId', foundStagedSkuModel.storeSkuId);
        promotedSkuModel.set('linkId', foundStagedSkuModel.linkId);
        const currentStatus = await getCurrentModuleStatus(foundStagedSkuModel);
        promotedSkuModel.set('status', currentStatus);
      }
      promotedSkuModel.set('hasChanges', false);
      promotedSkuModel.set('updated', getCurrentDate());
      await promotedSkuModel.save();

      retWithSuccess(req, res, {
        message,
        status: 201,
        data: getSkuModuleData(promotedSkuModel),
      });
    } catch (err) {
      logger.error(`Android promoteSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const deployTardisSkuList = async (
  storeId: number,
  productId: number,
  publishModulesIndexesSet: Set<number>,
  envId: number,
  tardisToken: string,
) => {
  let data: any = {};
  let countryModels: AndroidCountryModel[] = [];
  let countryIndexes = new Set<number>();
  let publishSkuModels: AndroidSkuModel[] = [];
  for (let skuId of publishModulesIndexesSet) {
    const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);
    publishSkuModels.push(skuModel);
    let countryLanguageIndexesSet = new Set<number>();
    const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
      {
        where: { skuId },
      },
    );
    for (let skuValueModel of skuValueModels) {
      countryLanguageIndexesSet.add(skuValueModel.countryLanguageId);
    }
    for (let countryLanguageId of countryLanguageIndexesSet) {
      const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
        countryLanguageId,
      );
      const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(
        countryLanguageModel.countryId,
      );
      if (!countryIndexes.has(countryModel.id)) {
        countryIndexes.add(countryModel.id);
        countryModels.push(countryModel);
      }
    }
  }
  const storeModel: AndroidStoreModel = await AndroidStore.findByPk(storeId);
  const productModel: AndroidProductModel = await AndroidProduct.findByPk(
    productId,
  );
  const envModel: AndroidEnvironmentsModel = await AndroidEnvironments.findByPk(
    envId,
  );
  data = await deploySkuData(
    storeModel,
    productModel,
    envModel,
    publishSkuModels,
    countryModels,
    tardisToken,
  );
  return data;
};

export const getSkuModuleUsage = async (skuId: number) => {
  const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll({
    where: { winbackSkuId: skuId },
  });

  let data: any[] = null;
  if (campaignModels.length) {
    data = [];
    campaignModels.forEach((model) => {
      data.push(model.name);
    });
  }
  return data;
};

export const updateSkuValueModels = async (
  skuId: number,
  body: any,
  countryId?: number,
) => {
  let skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
    where: { skuId },
  });
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll();
  const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);

  if (countryId !== null) {
    const countryLanguageIndexes = new Set<number>();
    countryLanguageModels.forEach((model) => {
      if (model.countryId === countryId) {
        countryLanguageIndexes.add(model.id);
      }
    });
    skuValueModels = skuValueModels.filter((model) => {
      return countryLanguageIndexes.has(model.countryLanguageId);
    });
  }

  const skuValueModelsSet = new Set<number>();
  skuValueModels.forEach((elem) => {
    skuValueModelsSet.add(elem.id);
  });

  const skuValueArrFromBody: any[] = await getBodySkuValueArray(
    skuModel,
    body,
    countryId !== null ? countryId : null,
  );

  skuValueArrFromBody.sort(whitespaceSort);

  for (const fieldElem of skuValueArrFromBody) {
    const foundSkuValueModel = skuValueModels.find((elem) => {
      return (
        elem.countryLanguageId === fieldElem.countryLanguageId &&
        elem.skuFieldId === fieldElem.skuFieldId
      );
    });
    const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
      fieldElem.skuFieldId,
    );

    if (foundSkuValueModel) {
      if (
        foundSkuValueModel.value !== fieldElem.value ||
        foundSkuValueModel.status !== fieldElem.status
      ) {
        foundSkuValueModel.set(
          'value',
          getProperValue(fieldElem.value, foundSkuFieldModel.type, true),
        );
        foundSkuValueModel.set('status', fieldElem.status);
        foundSkuValueModel.set('updated', getCurrentDate());
        await foundSkuValueModel.save();
      }
      skuValueModelsSet.delete(foundSkuValueModel.id);
    } else {
      const skuValueDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
        skuId: fieldElem.skuId,
        countryLanguageId: fieldElem.countryLanguageId,
        skuFieldId: fieldElem.skuFieldId,
        value: getProperValue(fieldElem.value, foundSkuFieldModel.type, true),
        status: fieldElem.status,
      };
      await AndroidSkuValue.create(skuValueDBPayload);
    }
  }

  // destroy unsent from body language fields-value
  if (skuValueModelsSet.size !== 0) {
    for (const skuValueModelsSetElem of skuValueModelsSet) {
      const foundSkuValueModel: AndroidSkuValueModel = await AndroidSkuValue.findByPk(
        skuValueModelsSetElem,
      );
      await foundSkuValueModel.destroy({ force: true });
    }
  }
};

export const createSkuValueModelsFromBody = async (
  skuModel: AndroidSkuModel,
  body: any,
) => {
  const skuValueArray = await getBodySkuValueArray(
    skuModel,
    body.countries,
    null,
  );
  await createSkuValueModels(skuValueArray, skuModel);
};

export const createSkuValueModels = async (
  arr: any,
  skuModel?: AndroidSkuModel,
) => {
  arr.sort(whitespaceSort);
  for (const elem of arr) {
    const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
      elem.skuFieldId,
    );
    const skuValueDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
      skuId: !!skuModel ? skuModel.id : elem.skuId,
      countryLanguageId: elem.countryLanguageId,
      skuFieldId: elem.skuFieldId,
      value: getProperValue(elem.value, foundSkuFieldModel.type, true),
      status: elem.status,
    };
    await AndroidSkuValue.create(skuValueDBPayload);
  }
};

export const getBodySkuValueArray = async (
  skuModel: AndroidSkuModel,
  body: any,
  countryId?: number,
) => {
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll();
  const languageModels: AndroidLanguageModel[] = await AndroidLanguage.findAll();
  const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll();
  const skuFieldModels: AndroidSkuFieldModel[] = await AndroidSkuField.findAll();
  let result: any[] = [];
  const storeId = skuModel.storeId;
  const productId = skuModel.productId;

  if (countryId !== null) {
    result = getSkuValueArrayFromCountryBody(
      body,
      skuModel.id,
      storeId,
      countryId,
      productId,
      languageModels,
      countryLanguageModels,
      skuFieldModels,
    );
  } else {
    const bodyCountryKeys = Object.keys(body);
    const bodyCountryValues = Object.values(body);
    if (bodyCountryKeys.length) {
      bodyCountryValues.forEach((bodyCountry, j) => {
        result = [
          ...result,
          ...getSkuValueArrayFromCountryBody(
            bodyCountry,
            skuModel.id,
            storeId,
            countryId !== null
              ? countryId
              : countryModels.find((elem) => {
                  return (
                    elem.code === bodyCountryKeys[j] &&
                    elem.storeId === storeId &&
                    elem.productId === productId
                  );
                }).id,
            productId,
            languageModels,
            countryLanguageModels,
            skuFieldModels,
          ),
        ];
      });
    }
  }

  return result;
};

export const getSkuValueArrayFromCountryBody = (
  bodyCountry: any,
  skuId: number,
  storeId: number,
  countryId: number,
  productId: number,
  languageModels: AndroidLanguageModel[],
  countryLanguageModels: AndroidCountryLanguageModel[],
  skuFieldModels: AndroidSkuFieldModel[],
) => {
  let resultArr: any[] = [];
  const status: string = bodyCountry.status;
  const bodyCountryNonTranslatableKeys = Object.keys(bodyCountry);
  const bodyCountryNonTranslatableValues = Object.values(bodyCountry);
  const allCurrentCountryLanguages = countryLanguageModels.filter(
    (countryLanguageModel) => {
      return countryLanguageModel.countryId === countryId;
    },
  );
  bodyCountryNonTranslatableValues.forEach((nonTranslatableValue, m) => {
    if (
      bodyCountryNonTranslatableKeys[m] !== 'status' &&
      bodyCountryNonTranslatableKeys[m] !== 'languages'
    ) {
      const foundNonTranslatableField = skuFieldModels.find((skuFieldModel) => {
        return (
          skuFieldModel.storeId === storeId &&
          skuFieldModel.name === bodyCountryNonTranslatableKeys[m] &&
          !skuFieldModel.translatable
        );
      });
      allCurrentCountryLanguages.forEach((countryLanguageModel) => {
        resultArr.push({
          skuId,
          storeId,
          productId,
          countryLanguageId: countryLanguageModel.id,
          skuFieldId: foundNonTranslatableField.id,
          value: getProperValue(
            nonTranslatableValue,
            foundNonTranslatableField.type,
            true,
          ),
          status,
        });
      });
    }
  });
  const bodyLanguageKeys = Object.keys(bodyCountry.languages);
  const bodyLanguageValues = Object.values(bodyCountry.languages);
  bodyLanguageValues.forEach((bodyLanguage, k) => {
    const bodyFieldKeys = Object.keys(bodyLanguage);
    const bodyFieldValues = Object.values(bodyLanguage);
    bodyFieldValues.forEach((bodyField, x) => {
      const languageId = languageModels.find(
        (elem) => elem.code === bodyLanguageKeys[k],
      ).id;
      const skuFieldModel = skuFieldModels.find((elem) => {
        return elem.name === bodyFieldKeys[x] && elem.storeId === storeId;
      });
      resultArr.push({
        skuId,
        storeId,
        productId,
        countryLanguageId: countryLanguageModels.find(
          (model) =>
            model.countryId === countryId && model.languageId === languageId,
        ).id,
        skuFieldId: skuFieldModels.find((elem) => {
          return elem.name === bodyFieldKeys[x] && elem.storeId === storeId;
        }).id,
        value: getProperValue(bodyField, skuFieldModel.type, true),
        status,
      });
    });
  });
  return resultArr;
};

export const getCurrentModuleStatus = async (skuModel: AndroidSkuModel) => {
  const skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll({
    where: { storeId: skuModel.storeId, productId: skuModel.productId },
  });
  const countryLanguageIndexes = new Set<number>();
  const statusSet = new Set<string>();

  for (let countryModel of countryModels) {
    const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll(
      {
        where: { countryId: countryModel.id },
      },
    );
    if (countryLanguageModels.length) {
      countryLanguageModels.forEach((model) =>
        countryLanguageIndexes.add(model.id),
      );
    }
  }
  skuValueModels.forEach((model) => {
    statusSet.add(model.status);
    countryLanguageIndexes.delete(model.countryLanguageId);
  });

  if (countryLanguageIndexes.size) {
    await setModelStatus(skuModel, AndroidModuleStatus.DRAFT);
    return AndroidModuleStatus.DRAFT;
  } else {
    if (statusSet.has(AndroidModuleValueStatus.INCOMPLETE)) {
      await setModelStatus(skuModel, AndroidModuleStatus.DRAFT);
      return AndroidModuleStatus.DRAFT;
    } else if (statusSet.has(AndroidModuleValueStatus.SAVED)) {
      await setModelStatus(skuModel, AndroidModuleStatus.COMPLETE);
      return AndroidModuleStatus.COMPLETE;
    } else if (statusSet.has(AndroidModuleValueStatus.PUBLISHED)) {
      await setModelStatus(skuModel, AndroidModuleStatus.LIVE);
      return AndroidModuleStatus.LIVE;
    }
  }
};

export const getCountryStatus = (countrySet: Set<string>) => {
  if (countrySet.has(AndroidModuleValueStatus.DFT)) {
    return AndroidModuleValueStatus.DFT;
  } else if (countrySet.has(AndroidModuleValueStatus.INCOMPLETE)) {
    return AndroidModuleValueStatus.INCOMPLETE;
  } else if (countrySet.has(AndroidModuleValueStatus.SAVED)) {
    return AndroidModuleValueStatus.SAVED;
  } else if (countrySet.has(AndroidModuleValueStatus.PUBLISHED)) {
    return AndroidModuleValueStatus.PUBLISHED;
  }
};

// ===========================================================================================================================================

export const deploySkuData = async (
  storeModel: AndroidStoreModel,
  productModel: AndroidProductModel,
  envModel: AndroidEnvironmentsModel,
  skuModels: AndroidSkuModel[],
  countryModels: AndroidCountryModel[],
  tardisToken: string,
) => {
  let results: any = {};

  // set appCopyValue models data
  for (let countryModel of countryModels) {
    const defaultCountryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findOne(
      {
        where: { countryId: countryModel.id, isDefault: true },
      },
    );
    const defaultLanguageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(
      defaultCountryLanguageModel.languageId,
    );

    const tardisRequestUrl: string = requestUrl(
      envModel.code,
      storeModel.path,
      productModel.path,
      'selector-config',
      null,
      countryModel.code,
    );
    const tardisRequestBody = await getSelectorConfigTardisData(
      skuModels,
      countryModel,
      defaultLanguageModel,
    );

    results = {
      ...results,
      [countryModel.code]: { tardisRequestUrl, tardisRequestBody },
    };
  }

  for (let elem of Object.values(results)) {
    // PUT data JSON to Tardis URL
    try {
      await axios.put(
        (elem as any).tardisRequestUrl,
        (elem as any).tardisRequestBody,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=UTF-8',
            Authorization: `Bearer ${tardisToken}`,
          },
        },
      );
    } catch (err) {
      throw new AppError(`Tardis PUT request failed: ${err.message}`, 400);
    }
  }
  return results;
};

export const getSelectorConfigTardisData = async (
  skuModels: AndroidSkuModel[],
  countryModel: AndroidCountryModel,
  defaultLanguageModel: AndroidLanguageModel,
): Promise<any> => {
  let supportedProducts: any[] = [];
  let supportedProductsObj: any = {};

  let index = 1;
  for (let skuModel of skuModels) {
    const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll(
      {
        where: { countryId: countryModel.id },
      },
    );
    const countryLanguageModelsSet = new Set<number>(
      countryLanguageModels.map((model) => model.id),
    );
    let skuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll({
      where: { skuId: skuModel.id },
    });
    skuValueModels = skuValueModels.filter((model) =>
      countryLanguageModelsSet.has(model.countryLanguageId),
    );
    supportedProductsObj = await getSelectorConfigTardisDataSupportedProducts(
      skuModel,
      skuValueModels,
      index,
    );
    supportedProducts.push(supportedProductsObj);
    ++index;
  }

  return {
    defaultLanguage: defaultLanguageModel.code,
    supportedProducts,
  };
};

export const getSelectorConfigTardisDataSupportedProducts = async (
  skuModel: AndroidSkuModel,
  countrySkuValueModels: AndroidSkuValueModel[],
  index: number,
) => {
  const skuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findOne({
    where: { storeId: skuModel.storeId, internalName: 'isDefaultInSelector' },
  });
  const isDefaultInSelectorModel = countrySkuValueModels.find((model) => {
    return model.skuFieldId === skuFieldModel.id;
  });
  const isDefaultInSelector = !!isDefaultInSelectorModel
    ? getProperValue(isDefaultInSelectorModel.value, 'boolean')
    : false;
  const isDefault = false;
  const showInSelector = false;
  const showInSettings = false;

  let priceCurrency: string = '';
  let priceAmount: string = '';
  let translations: any[] = [];
  let nonTranslatableFields: any = {};

  const nonTranslatableSkuFieldModels: AndroidSkuFieldModel[] = await AndroidSkuField.findAll(
    {
      where: { storeId: skuModel.storeId, translatable: false },
    },
  );

  for (let nonTranslatableSkuFieldModel of nonTranslatableSkuFieldModels) {
    if (nonTranslatableSkuFieldModel.name === 'currency') {
      const currencySkuValueModel = countrySkuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      if (currencySkuValueModel) {
        priceCurrency = getProperValue(
          !!currencySkuValueModel ? currencySkuValueModel.value : '',
          nonTranslatableSkuFieldModel.type,
        );
      }
    } else if (nonTranslatableSkuFieldModel.name === 'price') {
      const amountSkuValueModel = countrySkuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      if (amountSkuValueModel) {
        priceAmount = getProperValue(
          !!amountSkuValueModel ? amountSkuValueModel.value : '',
          nonTranslatableSkuFieldModel.type,
        );
      }
    } else {
      const foundSkuValueModel = countrySkuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      nonTranslatableFields = {
        ...nonTranslatableFields,
        [nonTranslatableSkuFieldModel.name]: getProperValue(
          !!foundSkuValueModel ? foundSkuValueModel.value : null,
          nonTranslatableSkuFieldModel.type,
        ),
      };
    }
  }

  const countryLanguageIndexesSet = new Set<number>(
    countrySkuValueModels.map((model) => model.countryLanguageId),
  );
  for (let countryLanguageId of countryLanguageIndexesSet) {
    let subscription: any = {};
    const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
      countryLanguageId,
    );
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(
      countryLanguageModel.languageId,
    );
    const languageSkuValueModels = countrySkuValueModels.filter(
      (model) => model.countryLanguageId === countryLanguageId,
    );

    const skuFieldIndexesSet = new Set<number>(
      languageSkuValueModels.map((model) => model.skuFieldId),
    );
    for (let skuFieldId of skuFieldIndexesSet) {
      const skuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findOne(
        {
          where: { id: skuFieldId, translatable: true },
        },
      );
      if (!!skuFieldModel) {
        const skuValue = languageSkuValueModels.find(
          (model) => model.skuFieldId === skuFieldId,
        );
        subscription = {
          ...subscription,
          [skuFieldModel.name]: getProperValue(
            skuValue.value,
            skuFieldModel.type,
          ),
        };
      }
    }
    translations.push({ lang: languageModel.code, subscription });
  }

  return {
    index,
    parentId: skuModel.parentSkuId,
    id: skuModel.storeSkuId,
    linkId: skuModel.linkId,
    isDefault,
    showInSelector,
    showInSettings,
    priceCurrency,
    priceAmount,
    translations,
    ...nonTranslatableFields,
    [skuFieldModel.name]: isDefaultInSelector,
  };
};

export const getDuplicateName = (
  name: string,
  allAppCopyNames: Set<string>,
) => {
  let newName: string = name;
  let nameIndex = 1;
  while (allAppCopyNames.has(newName)) {
    if (newName.startsWith('COPY')) {
      nameIndex++;
    }
    newName = getNewName(newName, nameIndex);
  }
  return newName;
};

export const getNewName = (name: string, index: number): string => {
  let newName: string;
  if (name.startsWith('COPY')) {
    const boldName = name.substring(name.indexOf(' - ') + 3);
    newName = `COPY ${index} - ${boldName}`;
  } else {
    newName = `COPY - ${name}`;
  }
  return newName;
};

const isPromotedSkuSameAsOriginal = async (
  originalSkuModel: AndroidSkuModel,
  promotedSkuModel: AndroidSkuModel,
): Promise<boolean> => {
  const originalSkuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
    {
      where: { skuId: originalSkuModel.id },
    },
  );
  const promotedSkuValueModels: AndroidSkuValueModel[] = await AndroidSkuValue.findAll(
    {
      where: { skuId: promotedSkuModel.id },
    },
  );
  let allSkuValueModelsAreEqual = true;
  if (
    originalSkuModel.name !== promotedSkuModel.name ||
    originalSkuModel.storeSkuId !== promotedSkuModel.storeSkuId ||
    originalSkuModel.parentSkuId !== promotedSkuModel.parentSkuId ||
    originalSkuModel.linkId !== promotedSkuModel.linkId
  ) {
    allSkuValueModelsAreEqual = false;
  } else {
    for (let promotedSkuValueModel of promotedSkuValueModels) {
      const foundSkuFieldModel: AndroidSkuFieldModel = await AndroidSkuField.findByPk(
        promotedSkuValueModel.skuFieldId,
      );
      const foundOriginalSkuValueModel = originalSkuValueModels.find(
        (model) =>
          model.skuFieldId === promotedSkuValueModel.skuFieldId &&
          model.countryLanguageId === promotedSkuValueModel.countryLanguageId,
      );
      const originalSkuValueModelValue = getProperValue(
        !!foundOriginalSkuValueModel ? foundOriginalSkuValueModel.value : null,
        foundSkuFieldModel.type,
        false,
      );
      const promotedSkuValueModelValue = getProperValue(
        promotedSkuValueModel.value,
        foundSkuFieldModel.type,
        false,
      );
      if (originalSkuValueModelValue !== promotedSkuValueModelValue) {
        allSkuValueModelsAreEqual = false;
      }
    }
  }
  return allSkuValueModelsAreEqual;
};
