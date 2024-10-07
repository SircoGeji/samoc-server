import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuCampaign,
  RokuCampaignHistory,
  RokuCountry,
  RokuCountryLanguage,
  RokuEnvironments,
  RokuLanguage,
  RokuProduct,
  RokuSelectorConfig,
  RokuSelectorConfigSku,
  RokuSku,
  RokuSkuField,
  RokuSkuValue,
  RokuStore,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuCountryModel } from 'src/models/roku/Country';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuModuleStatus, RokuModuleValueStatus } from '../../types/enum';
import { RokuSkuFieldModel } from 'src/models/roku/SkuField';
import { RokuSkuModel } from 'src/models/roku/Sku';
import { RokuSkuValueModel } from 'src/models/roku/SkuValue';
import { getCurrentDate } from '.';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { RokuSelectorConfigModel } from 'src/models/roku/SelectorConfig';
import { RokuSelectorConfigSkuModel } from 'src/models/roku/SelectorConfigSku';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import {
  isTokenValid,
  setModelParameterNull,
  setModelStatus,
} from './multiModules';
import { publishSelectorConfigModule } from './selectorConfig';
import {
  updateSpinnerText,
  getProperValue,
  whitespaceSort,
} from '../../util/utils';
import { setLiveCampaignParameter } from './campaign';
import { getAuthToken } from '../../services/GateKeeper';
import { checkTardisConnection, requestUrl } from '../../services/Tardis';
import axios from 'axios';
import { RokuEnvironmentsModel } from 'src/models/roku/RokuEnvironments';

const logger = Logger(module);

/**
 * GET /api/roku/sku/fields?store
 * Get Roku SKU fields list by store
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuFields = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku SKU fields Controller - getSkuFields');
    updateSpinnerText('Getting sku module fields...');
    try {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        const skuFieldModels: RokuSkuFieldModel[] = await RokuSkuField.findAll({
          where: { storeId },
        });

        let message = `No Roku Sku fields found`;
        if (skuFieldModels) {
          message = `Roku Sku fields found`;
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
      logger.error(`Roku getSkuFields failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/sku/preview?product
 * Get Roku SKU preview images list by product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuSelectPreviewImages = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku SKU module Controller - getSkuSelectPreviewImages');
    updateSpinnerText('Getting sku preview images...');
    try {
      const productModel: RokuProductModel = await RokuProduct.findOne({
        where: { path: req.query.product },
      });
      if (productModel) {
        const baseUrl = process.env.ROKU_PREVIEW_IMAGE_BASE_URL;
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
          message: 'Roku Sku module select preview images found',
          status: 200,
          data: result,
        });
      } else {
        throw new AppError(`Such product model not found`, 404);
      }
    } catch (err) {
      logger.error(
        `Roku getSkuSelectPreviewImages failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/sku/
 * Get all Roku Sku modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - getAllSku');
    updateSpinnerText('Getting all sku modules...');
    try {
      const skuModels: RokuSkuModel[] = await RokuSku.findAll();

      let message = `No Roku Sku modules found`;
      if (skuModels) {
        message = `Roku Sku modules found`;
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
      logger.error(`Roku getAllSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/sku/:skuId
 * Get Roku Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - getSku');
    updateSpinnerText('Getting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

      let message = `No such Roku Sku module found`;
      if (skuModel) {
        message = `Roku Sku module found`;
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
      logger.error(`Roku getSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getSkuModuleData = async (skuModel: RokuSkuModel) => {
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();
  const skuFieldModels: RokuSkuFieldModel[] = await RokuSkuField.findAll();

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
    const countryValueData: RokuSkuValueModel[] = skuValueModels.filter(
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
      const languageValueData: RokuSkuValueModel[] = countryValueData.filter(
        (elem) => {
          return elem.countryLanguageId === countryLanguageModel.id;
        },
      );

      let fieldsValues: any;
      languageValueData.forEach((elem) => {
        const skuFieldModel: RokuSkuFieldModel = skuFieldModels.find(
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
    const campaignModel: RokuCampaignModel = await RokuCampaign.findOne({
      where: { name: usedCampaignName },
    });
    if (campaignModel.status === RokuModuleStatus.LIVE) {
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
  skuModel: RokuSkuModel,
): Promise<boolean> => {
  const liveCampaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
    where: { winbackSkuId: skuModel.id, status: RokuModuleStatus.LIVE },
  });
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
 * POST /api/roku/sku/:store/save?product
 * Save Roku Sku module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - saveSku');
    updateSpinnerText('Saving sku module...');
    const storeModel: RokuStoreModel = await RokuStore.findOne({
      where: { path: req.query.store as string },
    });
    const storeId: number = storeModel.id;

    const productModel: RokuProductModel = await RokuProduct.findOne({
      where: { path: req.query.product as string },
    });
    const productId: number = productModel.id;
    let skuId: number;

    if (storeModel && productModel) {
      const devEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
        {
          where: { code: 'dev' },
        },
      );
      try {
        const skuDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          envId: devEnvModel.id,
          hasChanges: false,
          name: req.body.name,
          storeSkuId: req.body.storeSkuId,
          linkId: req.body.linkId,
          status: RokuModuleStatus.DRAFT,
          isPublished: false,
          isArchived: false,
          active: false,
          needToPromote: false,
        };
        const skuResult = await RokuSku.create(skuDBPayload);
        skuId = skuResult.id;
        await createSkuValueModelsFromBody(skuResult, req.body);

        const currentStatus = await getCurrentModuleStatus(skuResult);
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          skuResult.set('status', currentStatus);
          await skuResult.save();
        }

        retWithSuccess(req, res, {
          message: `Roku ${skuResult.name} Sku module saved in DB successfully`,
          status: 201,
          data: { skuId },
        });
      } catch (err) {
        logger.error(`Roku saveSku failed, ${err.message}`, err);

        // deleting incomplete records from DB
        const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);
        await skuModel.destroy({ force: true });

        return next(processOfferError(err));
      }
    } else {
      retWithSuccess(req, res, {
        message: `No such Roku store or product found`,
        status: 200,
        data: null,
      });
    }
  },
);

/**
 * PUT /api/roku/sku/:skuId/update
 * Update Roku Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - updateSku');
    updateSpinnerText('Updating sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

      if (skuModel) {
        if (req.query.status !== undefined) {
          skuModel.set('status', req.query.status);
        } else {
          if (req.query.country) {
            const countryModel: RokuCountryModel = await RokuCountry.findOne({
              where: {
                storeId: skuModel.storeId,
                productId: skuModel.productId,
                code: req.query.country,
              },
            });
            await updateSkuValueModels(skuId, req.body, countryModel.id);
          } else {
            await updateSkuValueModels(skuId, req.body.countries, null);
            skuModel.set('name', req.body.name);
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
          message: `Roku ${skuModel.name} Sku module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Roku Sku module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku updateSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const changeSelectorConfigModule = async (
  skuModel: RokuSkuModel,
  currentStatus: string,
) => {
  let selectorConfigStatus;
  let selectorConfigValueStatus;

  if (currentStatus === RokuModuleStatus.DRAFT) {
    selectorConfigStatus = RokuModuleStatus.DRAFT;
    selectorConfigValueStatus = RokuModuleValueStatus.INCOMPLETE;
  } else if (currentStatus === RokuModuleStatus.COMPLETE) {
    selectorConfigStatus = RokuModuleStatus.COMPLETE;
    selectorConfigValueStatus = RokuModuleValueStatus.SAVED;
  }

  if (selectorConfigStatus && selectorConfigValueStatus) {
    const selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
      {
        where: { skuId: skuModel.id },
      },
    );
    let skuIndexesSet = new Set<number>();
    if (selectorConfigSkuModels.length) {
      for (let selectorConfigSkuModel of selectorConfigSkuModels) {
        if (selectorConfigSkuModel.status !== RokuModuleValueStatus.ENDED) {
          if (
            selectorConfigSkuModel.status !== RokuModuleValueStatus.PUBLISHED
          ) {
            selectorConfigSkuModel.set('status', selectorConfigValueStatus);
            await selectorConfigSkuModel.save();
          }
          skuIndexesSet.add(selectorConfigSkuModel.skuId);
        }
      }

      for (let skuId of skuIndexesSet) {
        const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
          skuId,
        );
        if (
          selectorConfigModel &&
          selectorConfigModel.status !== RokuModuleStatus.ENDED
        ) {
          if (
            selectorConfigModel.status === RokuModuleStatus.LIVE &&
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
 * PUT /api/roku/sku/:skuId/archive
 * Archive Roku Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const archiveSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - archiveSku');
    updateSpinnerText('Archiving sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

      if (skuModel) {
        if (!skuModel.active) {
          await setModelParameterNull('winbackSkuId', skuId, RokuCampaign);
          await setModelParameterNull(
            'winbackSkuId',
            skuId,
            RokuCampaignHistory,
          );

          skuModel.set('isArchived', !skuModel.isArchived);
          skuModel.set('updated', getCurrentDate());
          await skuModel.save();

          retWithSuccess(req, res, {
            message: `Roku ${skuModel.name} Sku module ${
              !!skuModel.isArchived ? 'archived' : 'unarchived'
            }  in DB successfully`,
            status: 201,
            data: null,
          });
        } else {
          throw new AppError(`Active Sku module couldn't be archived`, 500);
        }
      } else {
        retWithSuccess(req, res, {
          message: 'No such Roku Sku module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku archiveSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/sku/:skuId/usage
 * Get Roku Sku module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSkuUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - getSkuUsage');
    updateSpinnerText('Getting sku module usage...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

      if (skuModel) {
        const data = await getSkuModuleUsage(skuId);

        retWithSuccess(req, res, {
          message: `Roku ${skuModel.name} Sku module usage data found`,
          status: 201,
          data,
        });
      } else {
        throw new AppError('Sku module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Roku getSkuUsage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/roku/sku/publish
 * Publish Roku Sku modules list
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishSkuList = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - publishSkuList');
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
        const foundSkuModel: RokuSkuModel = await RokuSku.findByPk(skuId);
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
        message: `Roku Sku modules list published successfully`,
        status: 201,
        data: deployData,
      });
    } catch (err) {
      logger.error(`Roku pusblishSku failed, ${err.message}`, err);
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
  let restLiveModels: RokuSkuModel[] = await RokuSku.findAll({
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
    const restLiveValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll(
      {
        where: { skuId: restLiveModel.id },
      },
    );
    for (let restLiveValueModel of restLiveValueModels) {
      restLiveValueModel.set('status', RokuModuleValueStatus.ENDED);
      restLiveValueModel.set('updated', getCurrentDate());
      await restLiveValueModel.save();
    }
    restLiveModel.set('isPublished', false);
    restLiveModel.set('status', RokuModuleStatus.ENDED);
    restLiveModel.set('updated', getCurrentDate());
    await restLiveModel.save();
  }
};

export const publishSkuModule = async (
  skuModel: RokuSkuModel,
  envId: number,
) => {
  const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  await publishSkuValueModels(skuValueModels);
  skuModel.set('status', RokuModuleStatus.LIVE);
  skuModel.set('isPublished', true);
  skuModel.set('updated', getCurrentDate());
  await skuModel.save();
  const envModel: RokuEnvironmentsModel = await RokuEnvironments.findByPk(
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
  skuValueModels: RokuSkuValueModel[],
) => {
  for (const model of skuValueModels) {
    model.set('status', RokuModuleValueStatus.PUBLISHED);
    model.set('updated', getCurrentDate());
    await model.save();
  }
};

/**
 * POST /api/roku/sku/:skuId/promote
 * Promote Roku Sku module by skuId
 * @param {Request}     req
 * @param {Response}    res
 */
export const promoteSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - promoteSku');
    updateSpinnerText('Promoting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

      if (!skuModel) {
        throw new AppError('Sku module in DB not found', 404);
      }

      skuModel.set('updated', getCurrentDate());
      skuModel.set('promotedAt', getCurrentDate());
      skuModel.set('needToPromote', false);
      await skuModel.save();

      const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
        where: { skuId },
      });

      if (!skuValueModels || !skuValueModels.length) {
        throw new AppError('SkuValue modules in DB not found', 404);
      }

      let promotedSku: any = null;
      const foundPromotedSkuModel: RokuSkuModel = await RokuSku.findOne({
        where: { promotionId: skuId },
      });
      let message = '';

      if (!!foundPromotedSkuModel) {
        const isPromotedSkuSameAsOriginalRes = await isPromotedSkuSameAsOriginal(
          skuModel,
          foundPromotedSkuModel,
        );
        message = `Roku "${foundPromotedSkuModel.name}" Sku module promoted without changes`;
        const foundStagedSkuModel: RokuSkuModel = await RokuSku.findOne({
          where: { stagedId: skuId },
        });
        if (!!foundStagedSkuModel) {
          updateRokuSku(skuModel, foundStagedSkuModel);
          updateRokuSkuValues(skuModel.id, foundStagedSkuModel.id);
          promotedSku = await getSkuModuleData(foundPromotedSkuModel);
        } else {
          const stgEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
            {
              where: { code: 'stg' },
            },
          );
          const stagedSkuDBPayload = {
            created: getCurrentDate(),
            updated: getCurrentDate(),
            createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
            storeId: skuModel.storeId,
            productId: skuModel.productId,
            envId: stgEnvModel.id,
            stagedId: skuModel.id,
            hasChanges: false,
            name: skuModel.name,
            isPublished: false,
            active: false,
            storeSkuId: skuModel.storeSkuId,
            linkId: skuModel.linkId,
            isArchived: skuModel.isArchived,
            status: RokuModuleStatus.DRAFT,
            needToPromote: false,
          };
          const stagedSkuResult = await RokuSku.create(stagedSkuDBPayload);
          createSkuValueModels(skuValueModels, stagedSkuResult);
          const currentStatus = await getCurrentModuleStatus(stagedSkuResult);
          if (currentStatus !== RokuModuleStatus.DRAFT) {
            stagedSkuResult.set('status', currentStatus);
            await stagedSkuResult.save();
          }
          promotedSku = await getSkuModuleData(stagedSkuResult);
        }
        if (!isPromotedSkuSameAsOriginalRes) {
          foundPromotedSkuModel.set('hasChanges', true);
          foundPromotedSkuModel.set('updated', getCurrentDate());
          await foundPromotedSkuModel.save();
          message = `Roku "${promotedSku.name}" Sku module promoted in DB successfully`;
        }
      } else {
        const prodEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
          {
            where: { code: 'prod' },
          },
        );
        const promoteSkuDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
          storeId: skuModel.storeId,
          productId: skuModel.productId,
          envId: prodEnvModel.id,
          promotionId: skuModel.id,
          hasChanges: false,
          name: skuModel.name,
          isPublished: false,
          active: false,
          storeSkuId: skuModel.storeSkuId,
          linkId: skuModel.linkId,
          isArchived: skuModel.isArchived,
          status: RokuModuleStatus.DRAFT,
          needToPromote: false,
        };
        const promoteSkuResult = await RokuSku.create(promoteSkuDBPayload);
        createSkuValueModels(skuValueModels, promoteSkuResult);
        const currentStatus = await getCurrentModuleStatus(promoteSkuResult);
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          promoteSkuResult.set('status', currentStatus);
          await promoteSkuResult.save();
        }
        promotedSku = await getSkuModuleData(promoteSkuResult);
        message = `Roku "${promotedSku.name}" Sku module promoted in DB successfully`;
      }

      retWithSuccess(req, res, {
        message,
        status: 201,
        data: !!promotedSku ? { ...promotedSku } : null,
      });
    } catch (err) {
      logger.error(`Roku promoteSku failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const updateRokuSkuValues = async (
  sourceSkuId: number,
  destinationSkuId: number,
) => {
  const sourceSkuValues = await RokuSkuValue.findAll({
    where: { skuId: sourceSkuId },
  });
  const destinationSkuValues = await RokuSkuValue.findAll({
    where: { skuId: destinationSkuId },
  });

  const destinationSkuModel = await RokuSku.findByPk(destinationSkuId);

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
        const foundSkuFieldModel: RokuSkuFieldModel = await RokuSkuField.findByPk(
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
        const foundSkuFieldModel: RokuSkuFieldModel = await RokuSkuField.findByPk(
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
        await RokuSkuValue.create(skuValueDBPayload);
      }
    }
  } else {
    throw new AppError(
      'Unable to update sku, source sku values not found.',
      404,
    );
  }
};

const updateRokuSku = async (oldSku: RokuSkuModel, newSku: RokuSkuModel) => {
  newSku.set('updated', getCurrentDate());
  newSku.set('name', oldSku.name);
  newSku.set('storeSkuId', oldSku.storeSkuId);
  newSku.set('linkId', oldSku.linkId);
  const currentStatus = await getCurrentModuleStatus(oldSku);
  newSku.set('status', currentStatus);
  newSku.save();
};

/**
 * POST /api/roku/sku/:skuId/pull?acceptChanges
 * Pull Roku promotion Sku module by skuId to it's promotion module
 * @param {Request}     req
 * @param {Response}    res
 */
export const pullPromotionSku = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku Sku module Controller - promoteSku');
    updateSpinnerText('Promoting sku module...');
    try {
      const skuId: number = Number(req.params.skuId);
      const promotedSkuModel: RokuSkuModel = await RokuSku.findByPk(skuId);
      const acceptChanges: boolean = req.query.acceptChanges === 'true';

      if (!promotedSkuModel) {
        throw new AppError('Sku module in DB not found', 404);
      }

      const promotedSkuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll(
        {
          where: { skuId },
        },
      );

      if (!promotedSkuValueModels || !promotedSkuValueModels.length) {
        throw new AppError('Promoted SkuValue modules in DB not found', 404);
      }

      const foundStagedSkuModel: RokuSkuModel = await RokuSku.findOne({
        where: { stagedId: promotedSkuModel.promotionId },
      });

      if (!foundStagedSkuModel) {
        throw new AppError('No staged sku model found', 404);
      }

      let message = `"${promotedSkuModel.name}" SKU changes from the Client Dev environment have been discarded`;
      if (!!acceptChanges) {
        message = `"${promotedSkuModel.name}" SKU changes from the Client Dev environment have been accepted`;
        const foundStagedSkuValueModels = await RokuSkuValue.findAll({
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
            const foundSkuFieldModel: RokuSkuFieldModel = await RokuSkuField.findByPk(
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
      logger.error(`Roku promoteSku failed, ${err.message}`, err);
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
  let countryModels: RokuCountryModel[] = [];
  let countryIndexes = new Set<number>();
  let publishSkuModels: RokuSkuModel[] = [];
  for (let skuId of publishModulesIndexesSet) {
    const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);
    publishSkuModels.push(skuModel);
    let countryLanguageIndexesSet = new Set<number>();
    const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
      where: { skuId },
    });
    for (let skuValueModel of skuValueModels) {
      countryLanguageIndexesSet.add(skuValueModel.countryLanguageId);
    }
    for (let countryLanguageId of countryLanguageIndexesSet) {
      const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
        countryLanguageId,
      );
      const countryModel: RokuCountryModel = await RokuCountry.findByPk(
        countryLanguageModel.countryId,
      );
      if (!countryIndexes.has(countryModel.id)) {
        countryIndexes.add(countryModel.id);
        countryModels.push(countryModel);
      }
    }
  }
  const storeModel: RokuStoreModel = await RokuStore.findByPk(storeId);
  const productModel: RokuProductModel = await RokuProduct.findByPk(productId);
  const envModel: RokuEnvironmentsModel = await RokuEnvironments.findByPk(
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
  const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
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
  let skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
    where: { skuId },
  });
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();
  const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);

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

    if (foundSkuValueModel) {
      if (
        foundSkuValueModel.value !== fieldElem.value ||
        foundSkuValueModel.status !== fieldElem.status
      ) {
        foundSkuValueModel.set('value', fieldElem.value);
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
        value: fieldElem.value,
        status: fieldElem.status,
      };
      await RokuSkuValue.create(skuValueDBPayload);
    }
  }

  // destroy unsent from body language fields-value
  if (skuValueModelsSet.size !== 0) {
    for (const skuValueModelsSetElem of skuValueModelsSet) {
      const foundSkuValueModel: RokuSkuValueModel = await RokuSkuValue.findByPk(
        skuValueModelsSetElem,
      );
      await foundSkuValueModel.destroy({ force: true });
    }
  }
};

export const createSkuValueModelsFromBody = async (
  skuModel: RokuSkuModel,
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
  skuModel?: RokuSkuModel,
) => {
  arr.sort(whitespaceSort);
  for (const elem of arr) {
    const skuValueDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!skuModel.createdBy ? skuModel.createdBy : null,
      skuId: !!skuModel ? skuModel.id : elem.skuId,
      countryLanguageId: elem.countryLanguageId,
      skuFieldId: elem.skuFieldId,
      value: elem.value,
      status: elem.status,
    };
    await RokuSkuValue.create(skuValueDBPayload);
  }
};

export const getBodySkuValueArray = async (
  skuModel: RokuSkuModel,
  body: any,
  countryId?: number,
) => {
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();
  const skuFieldModels: RokuSkuFieldModel[] = await RokuSkuField.findAll();
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
  languageModels: RokuLanguageModel[],
  countryLanguageModels: RokuCountryLanguageModel[],
  skuFieldModels: RokuSkuFieldModel[],
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

export const getCurrentModuleStatus = async (skuModel: RokuSkuModel) => {
  const skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
    where: { skuId: skuModel.id },
  });
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll({
    where: { storeId: skuModel.storeId, productId: skuModel.productId },
  });
  const countryLanguageIndexes = new Set<number>();
  const statusSet = new Set<string>();

  for (let countryModel of countryModels) {
    const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll(
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
    await setModelStatus(skuModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  } else {
    if (statusSet.has(RokuModuleValueStatus.INCOMPLETE)) {
      await setModelStatus(skuModel, RokuModuleStatus.DRAFT);
      return RokuModuleStatus.DRAFT;
    } else if (statusSet.has(RokuModuleValueStatus.SAVED)) {
      await setModelStatus(skuModel, RokuModuleStatus.COMPLETE);
      return RokuModuleStatus.COMPLETE;
    } else if (statusSet.has(RokuModuleValueStatus.PUBLISHED)) {
      await setModelStatus(skuModel, RokuModuleStatus.LIVE);
      return RokuModuleStatus.LIVE;
    }
  }
};

export const getCountryStatus = (countrySet: Set<string>) => {
  if (countrySet.has(RokuModuleValueStatus.DFT)) {
    return RokuModuleValueStatus.DFT;
  } else if (countrySet.has(RokuModuleValueStatus.INCOMPLETE)) {
    return RokuModuleValueStatus.INCOMPLETE;
  } else if (countrySet.has(RokuModuleValueStatus.SAVED)) {
    return RokuModuleValueStatus.SAVED;
  } else if (countrySet.has(RokuModuleValueStatus.PUBLISHED)) {
    return RokuModuleValueStatus.PUBLISHED;
  }
};

// ===========================================================================================================================================

export const deploySkuData = async (
  storeModel: RokuStoreModel,
  productModel: RokuProductModel,
  envModel: RokuEnvironmentsModel,
  skuModels: RokuSkuModel[],
  countryModels: RokuCountryModel[],
  tardisToken: string,
) => {
  let results: any = {};

  // set appCopyValue models data
  for (let countryModel of countryModels) {
    const defaultCountryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findOne(
      {
        where: { countryId: countryModel.id, isDefault: true },
      },
    );
    const defaultLanguageModel: RokuLanguageModel = await RokuLanguage.findByPk(
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
  skuModels: RokuSkuModel[],
  countryModel: RokuCountryModel,
  defaultLanguageModel: RokuLanguageModel,
): Promise<any> => {
  let supportedProducts: any[] = [];
  let supportedProductsObj: any = {};

  let index = 1;
  for (let skuModel of skuModels) {
    const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll(
      {
        where: { countryId: countryModel.id },
      },
    );
    const countryLanguageModelsSet = new Set<number>(
      countryLanguageModels.map((model) => model.id),
    );
    let skuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll({
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
  skuModel: RokuSkuModel,
  countrySkuValueModels: RokuSkuValueModel[],
  index: number,
) => {
  const isDefaultInSelectorSkuFieldModel: RokuSkuFieldModel = await RokuSkuField.findOne(
    {
      where: {
        storeId: skuModel.storeId,
        internalName: 'isDefaultInSelector',
        translatable: false,
      },
    },
  );
  let isDefaultInSelectorModel = null;
  let isDefaultInSelector = false;
  if (!!isDefaultInSelectorSkuFieldModel) {
    isDefaultInSelectorModel = countrySkuValueModels.find((model) => {
      return model.skuFieldId === isDefaultInSelectorSkuFieldModel.id;
    });
    isDefaultInSelector = !!isDefaultInSelectorModel
      ? getProperValue(isDefaultInSelectorModel.value, 'boolean')
      : false;
  }
  const isDefault = false;
  const showInSelector = false;
  const showInSettings = false;

  let priceCurrency: string = '';
  let priceAmount: string = '';
  let translations: any[] = [];
  let nonTranslatableFields: any = {};

  const nonTranslatableSkuFieldModels: RokuSkuFieldModel[] = await RokuSkuField.findAll(
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
    const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
      countryLanguageId,
    );
    const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(
      countryLanguageModel.languageId,
    );
    const languageSkuValueModels = countrySkuValueModels.filter(
      (model) => model.countryLanguageId === countryLanguageId,
    );

    const skuFieldIndexesSet = new Set<number>(
      languageSkuValueModels.map((model) => model.skuFieldId),
    );
    for (let skuFieldId of skuFieldIndexesSet) {
      const skuFieldModel: RokuSkuFieldModel = await RokuSkuField.findOne({
        where: { id: skuFieldId, translatable: true },
      });
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

  let result = {
    index,
    id: skuModel.storeSkuId,
    linkId: skuModel.linkId,
    isDefault,
    showInSelector,
    showInSettings,
    priceCurrency,
    priceAmount,
    translations,
    ...nonTranslatableFields,
  };
  if (!!isDefaultInSelectorSkuFieldModel && !!isDefaultInSelectorModel) {
    result[isDefaultInSelectorSkuFieldModel.name] = isDefaultInSelector;
  }

  return result;
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
  originalSkuModel: RokuSkuModel,
  promotedSkuModel: RokuSkuModel,
): Promise<boolean> => {
  const originalSkuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll(
    {
      where: { skuId: originalSkuModel.id },
    },
  );
  const promotedSkuValueModels: RokuSkuValueModel[] = await RokuSkuValue.findAll(
    {
      where: { skuId: promotedSkuModel.id },
    },
  );
  let allSkuValueModelsAreEqual = true;
  if (
    originalSkuModel.name !== promotedSkuModel.name ||
    originalSkuModel.storeSkuId !== promotedSkuModel.storeSkuId ||
    originalSkuModel.linkId !== promotedSkuModel.linkId
  ) {
    allSkuValueModelsAreEqual = false;
  } else {
    for (let promotedSkuValueModel of promotedSkuValueModels) {
      const foundSkuFieldModel: RokuSkuFieldModel = await RokuSkuField.findByPk(
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
