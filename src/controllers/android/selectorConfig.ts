import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidCampaign,
  AndroidCountry,
  AndroidCountryLanguage,
  AndroidLanguage,
  AndroidProduct,
  AndroidSelectorConfig,
  AndroidSelectorConfigSku,
  AndroidSku,
  AndroidSkuField,
  AndroidSkuValue,
  AndroidStore,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidCountryModel } from 'src/models/android/Country';
import { AndroidProductModel } from 'src/models/android/Product';
import {
  AndroidModuleStatus,
  AndroidModuleValueStatus,
} from '../../types/enum';
import { AndroidSelectorConfigModel } from 'src/models/android/SelectorConfig';
import { AndroidSelectorConfigSkuModel } from 'src/models/android/SelectorConfigSku';
import { AndroidSkuModel } from 'src/models/android/Sku';
import { getCurrentDate, setModuleEnv } from '.';
import axios from 'axios';
import { AndroidCountryLanguageModel } from 'src/models/android/CountryLanguage';
import { checkTardisConnection, requestUrl } from '../../services/Tardis';
import { AndroidLanguageModel } from 'src/models/android/Language';
import { AndroidSkuValueModel } from 'src/models/android/SkuValue';
import { AndroidSkuFieldModel } from 'src/models/android/SkuField';
import { setLiveCampaignParameter } from './campaign';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import { isTokenValid, setModelStatus } from './multiModules';
import { getAuthToken } from '../../services/GateKeeper';
import { updateSpinnerText, getProperValue } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/android/selector-config/
 * Get all Android SelectorConfig modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - getAllSelectorConfig',
    );
    updateSpinnerText('Getting all selector config modules...');
    try {
      const selectorConfigModels: AndroidSelectorConfigModel[] = await AndroidSelectorConfig.findAll();

      if (selectorConfigModels) {
        let results: any = [];
        for (let model of selectorConfigModels) {
          const result = await getSelectorConfigModuleData(model);
          results.push(result);
        }
        retWithSuccess(req, res, {
          message: 'Android SelectorConfig modules found',
          status: 200,
          data: results,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No Android SelectorConfig modules found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android getAllSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/selector-config/:selectorConfigId
 * Get Android SelectorConfig module by selectorConfigId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - getSelectorConfig',
    );
    updateSpinnerText('Getting selector config module...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        const result = await getSelectorConfigModuleData(selectorConfigModel);

        retWithSuccess(req, res, {
          message: 'Android SelectorConfig module found',
          status: 200,
          data: result,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Android SelectorConfig module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android getSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getSelectorConfigModuleData = async (
  selectorConfigModel: AndroidSelectorConfigModel,
) => {
  let countries: any = {};
  const selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  if (selectorConfigSkuModels.length) {
    const countriesIndexes = new Set<number>();
    const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll();

    selectorConfigSkuModels.forEach((elem) => {
      const countryId: number = countryModels.find(
        (el) => el.id === elem.countryId,
      ).id;
      countriesIndexes.add(countryId);
    });
    for (let countryId of countriesIndexes) {
      let tableData: any = [];
      const filteredSelectorConfigSkuModels = selectorConfigSkuModels.filter(
        (elem) => elem.countryId === countryId,
      );
      const countryCode: string = countryModels.find(
        (el) => el.id === countryId,
      ).code;
      let status: string;
      if (filteredSelectorConfigSkuModels.length) {
        for (let selectorConfigSkuModel of filteredSelectorConfigSkuModels) {
          const skuModels: AndroidSkuModel[] = await AndroidSku.findAll({
            where: {
              storeId: selectorConfigModel.storeId,
              productId: selectorConfigModel.productId,
            },
          });
          const skuModel = skuModels.find(
            (model) => model.id === selectorConfigSkuModel.skuId,
          );
          if (!skuModel) {
            status = AndroidModuleValueStatus.INCOMPLETE;
            selectorConfigSkuModel.set('status', status);
            selectorConfigSkuModel.set('updated', getCurrentDate());
            await selectorConfigSkuModel.save();
          } else {
            status = selectorConfigSkuModel.status;
          }
          tableData.push({
            skuId: selectorConfigSkuModel.skuId,
            countryId: selectorConfigSkuModel.countryId,
            isDefault: selectorConfigSkuModel.isDefault,
            defaultInSelector: selectorConfigSkuModel.defaultInSelector,
            showInSettings: selectorConfigSkuModel.showInSettings,
            showInSelector: selectorConfigSkuModel.showInSelector,
            order: selectorConfigSkuModel.order,
          });
        }

        countries = {
          ...countries,
          [countryCode]: {
            status,
            tableData,
          },
        };
      }
    }

    const currentStatus = await getCurrentModuleStatus(selectorConfigModel);
    selectorConfigModel.set('status', currentStatus);
    selectorConfigModel.set('updated', getCurrentDate());
    await selectorConfigModel.save();
  }
  return {
    selectorConfigId: selectorConfigModel.id,
    created: selectorConfigModel.created,
    updated: selectorConfigModel.updated,
    storeId: selectorConfigModel.storeId,
    productId: selectorConfigModel.productId,
    name: selectorConfigModel.name,
    isDefault: selectorConfigModel.isDefault,
    status: selectorConfigModel.status,
    deployedTo: selectorConfigModel.deployedTo,
    endedOn: selectorConfigModel.endedOn,
    countries,
  };
};

/**
 * POST /api/android/selector-config/save?store&product
 * Save Android SelectorConfig module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - saveSelectorConfig',
    );
    updateSpinnerText('Saving selector config module...');
    const storeModel: AndroidStoreModel = await AndroidStore.findOne({
      where: { path: req.query.store as string },
    });
    const storeId: number = storeModel.id;

    const productModel: AndroidProductModel = await AndroidProduct.findOne({
      where: { path: req.query.product as string },
    });
    const productId: number = productModel.id;
    let selectorConfigId: number;

    if (storeModel && productModel) {
      try {
        // Check if the module is the first in DB
        let isDefault: boolean = false;
        const selectorConfigModels: AndroidSelectorConfigModel[] = await AndroidSelectorConfig.findAll(
          {
            where: { storeId, productId },
          },
        );
        if (!selectorConfigModels.length) {
          isDefault = true;
        }

        const selectorConfigDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          name: req.body.name,
          isDefault,
          status: AndroidModuleStatus.DRAFT,
        };
        const selectorConfigResult = await AndroidSelectorConfig.create(
          selectorConfigDBPayload,
        );
        selectorConfigId = selectorConfigResult.id;
        if (Object.keys(req.body.countries).length) {
          await createSelectorConfigSkuModels(selectorConfigResult, req.body);

          const currentStatus = await getCurrentModuleStatus(
            selectorConfigResult,
          );
          if (currentStatus !== AndroidModuleStatus.DRAFT) {
            selectorConfigResult.set('status', currentStatus);
            await selectorConfigResult.save();
          }
        }

        retWithSuccess(req, res, {
          message: `Android ${selectorConfigResult.name} SelectorConfig module saved in DB successfully`,
          status: 201,
          data: { selectorConfigId },
        });
      } catch (err) {
        logger.error(`Android saveSelectorConfig failed, ${err.message}`, err);

        // deleting incomplete records from DB
        const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
          selectorConfigId,
        );
        await selectorConfigModel.destroy({ force: true });

        return next(processOfferError(err));
      }
    } else {
      retWithSuccess(req, res, {
        message: 'No such Android store or product found',
        status: 200,
        data: null,
      });
    }
  },
);

/**
 * PUT /api/android/selector-config/:selectorConfigId/update
 * Update Android SelectorConfig module by selectorConfigId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - updateSelectorConfig',
    );
    updateSpinnerText('Updating selector config module...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        if (req.query.status !== undefined) {
          selectorConfigModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          selectorConfigModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (req.query.country) {
            const countryModel: AndroidCountryModel = await AndroidCountry.findOne(
              {
                where: {
                  storeId: selectorConfigModel.storeId,
                  productId: selectorConfigModel.productId,
                  code: req.query.country,
                },
              },
            );
            await updateSelectorConfigSkuModels(
              selectorConfigId,
              req.body,
              countryModel.id,
            );
          } else {
            await updateSelectorConfigSkuModels(
              selectorConfigId,
              req.body.countries,
              null,
            );
            selectorConfigModel.set('name', req.body.name);
          }
        }

        const currentStatus = await getCurrentModuleStatus(selectorConfigModel);
        selectorConfigModel.set('status', currentStatus);
        selectorConfigModel.set('updated', getCurrentDate());
        await selectorConfigModel.save();

        retWithSuccess(req, res, {
          message: `Android ${selectorConfigModel.name} SelectorConfig module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Android SelectorConfig module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android updateSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/selector-config/:selectorConfigId/usage
 * Get Android SelectorConfig module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSelectorConfigUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - getSelectorConfigUsage',
    );
    updateSpinnerText('Getting selector config module usage...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll(
          {
            where: { selectorConfigId },
          },
        );

        let data: any[] = null;
        if (campaignModels.length) {
          data = [];
          campaignModels.forEach((model) => {
            data.push(model.name);
          });
        }

        retWithSuccess(req, res, {
          message: `Android ${selectorConfigModel.name} SelectorConfig module usage data found`,
          status: 201,
          data,
        });
      } else {
        throw new AppError('SelectorConfig module in DB not found', 404);
      }
    } catch (err) {
      logger.error(
        `Android getSelectorConfigUsage failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/android/selector-config/:selectorConfigId/publish?env
 * Publish Android SelectorConfig module by selectorConfigId and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Android SelectorConfig module Controller - publishSelectorConfig',
    );
    updateSpinnerText('Publishing selector config module...');
    const selectorConfigId: number = Number(req.params.selectorConfigId);
    const env: string = req.query.env as string;
    try {
      const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
        selectorConfigId,
      );
      if (selectorConfigModel) {
        const data = await publishSelectorConfigModule(
          selectorConfigModel,
          env,
          req.body,
        );

        retWithSuccess(req, res, {
          message: `Android ${
            selectorConfigModel.name
          } SelectorConfig module published on ${env.toUpperCase()} successfully`,
          status: 201,
          data,
        });
      } else {
        retWithSuccess(req, res, {
          message: `No such android SelectorConfig module found in DB`,
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Android publishSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const publishSelectorConfigModule = async (
  selectorConfigModel: AndroidSelectorConfigModel,
  env: string,
  body: any,
) => {
  let tardisToken = '';
  let tardisTokenExpiresAt = '';
  if (!isTokenValid(body)) {
    [tardisToken, tardisTokenExpiresAt] = await getAuthToken();
  }
  await checkTardisConnection(tardisToken);

  const selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  const skuModels: AndroidSkuModel[] = await AndroidSku.findAll({
    where: {
      storeId: selectorConfigModel.storeId,
      productId: selectorConfigModel.productId,
    },
  });
  await publishSelectorConfigSkuModels(skuModels, selectorConfigSkuModels);
  selectorConfigModel.set('status', AndroidModuleStatus.LIVE);

  if (selectorConfigModel.status === AndroidModuleStatus.LIVE) {
    let restModels: AndroidSelectorConfigModel[] = await AndroidSelectorConfig.findAll(
      {
        where: {
          storeId: selectorConfigModel.storeId,
          productId: selectorConfigModel.productId,
          status: AndroidModuleStatus.LIVE,
        },
      },
    );
    restModels = restModels.filter((elem) => {
      return (
        elem.id !== selectorConfigModel.id && elem.deployedTo.includes(env)
      );
    });
    if (restModels.length) {
      for (let restModel of restModels) {
        if (restModel.deployedTo === env) {
          const restValueModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
            {
              where: { selectorConfigId: restModel.id },
            },
          );
          for (let restValueModel of restValueModels) {
            if (restValueModel.status === AndroidModuleValueStatus.PUBLISHED) {
              restValueModel.set('status', AndroidModuleValueStatus.ENDED);
              restValueModel.set('updated', getCurrentDate());
              await restValueModel.save();
            }
          }
          restModel.set('deployedTo', null);
          setModuleEnv(restModel, env, 'endedOn');
        } else {
          let newDeployedTo: string = restModel.deployedTo.replace(env, '');
          newDeployedTo = newDeployedTo.replace('-', '');
          restModel.set('deployedTo', newDeployedTo);
          setModuleEnv(restModel, env, 'endedOn');
        }
        const currentStatus = await getCurrentModuleStatus(restModel);
        restModel.set('status', currentStatus);
        restModel.set('updated', getCurrentDate());
        await restModel.save();
      }
    }
    setModuleEnv(selectorConfigModel, env, 'deployedTo');
    if (env === selectorConfigModel.endedOn) {
      selectorConfigModel.set('endedOn', null);
    }
  }

  selectorConfigModel.set('updated', getCurrentDate());
  await selectorConfigModel.save();

  await setLiveCampaignParameter(
    selectorConfigModel.storeId,
    selectorConfigModel.productId,
    'selector-config',
    env,
    selectorConfigModel.id,
  );

  let data: any = {};
  updateSpinnerText('Deploying new selector config JSON...');
  data.tardisData = await deploySelectorConfigData(
    env,
    selectorConfigModel,
    selectorConfigSkuModels,
    tardisToken,
  );
  data.tardisToken = tardisToken;
  data.tardisTokenExpiresAt = tardisTokenExpiresAt;
  return data;
};

export const createSelectorConfigSkuModels = async (
  selectorConfigModel: AndroidSelectorConfigModel,
  body: any,
) => {
  const selectorConfigSkuArray = await getBodySelectorConfigSkuArray(
    selectorConfigModel,
    body.countries,
    null,
  );
  for (const elem of selectorConfigSkuArray) {
    const selectorConfigSkuDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!selectorConfigModel.createdBy
        ? selectorConfigModel.createdBy
        : null,
      selectorConfigId: selectorConfigModel.id,
      skuId: elem.skuId,
      countryId: elem.countryId,
      isDefault: elem.isDefault,
      defaultInSelector: elem.defaultInSelector,
      showInSelector: elem.showInSelector,
      showInSettings: elem.showInSettings,
      order: elem.order,
      status: elem.status,
    };
    await AndroidSelectorConfigSku.create(selectorConfigSkuDBPayload);
    await checkActiveSku(elem.skuId);
  }
};

export const getBodySelectorConfigSkuArray = async (
  selectorConfigModel: AndroidSelectorConfigModel,
  body: any,
  countryId?: number,
) => {
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll();
  let result: any = [];
  const storeId = selectorConfigModel.storeId;
  const productId = selectorConfigModel.productId;
  const skuModels: AndroidSkuModel[] = await AndroidSku.findAll({
    where: { storeId, productId },
  });

  if (countryId !== null) {
    result = getSelectorConfigSkuArrayFromCountryBody(
      body,
      selectorConfigModel.id,
      countryId,
      skuModels,
    );
  } else {
    const bodyCountryKeys = Object.keys(body);
    const bodyCountryValues = Object.values(body);
    bodyCountryValues.forEach((bodyCountry, i) => {
      result = [
        ...result,
        ...getSelectorConfigSkuArrayFromCountryBody(
          bodyCountry,
          selectorConfigModel.id,
          countryModels.find((elem) => {
            return (
              elem.code === bodyCountryKeys[i] &&
              elem.storeId === storeId &&
              elem.productId === productId
            );
          }).id,
          skuModels,
        ),
      ];
    });
  }

  return result;
};

export const getSelectorConfigSkuArrayFromCountryBody = (
  bodyCountry: any,
  selectorConfigId: number,
  countryId: number,
  skuModels: AndroidSkuModel[],
) => {
  let resultArr: any[] = [];
  bodyCountry.tableData.forEach((tableRow: any) => {
    let status: string;
    const skuModel = skuModels.find((model) => model.id === tableRow.skuId);
    if (!skuModel || skuModel.status === AndroidModuleStatus.DRAFT) {
      status = AndroidModuleValueStatus.INCOMPLETE;
    } else {
      status = bodyCountry.status;
    }
    const result = {
      selectorConfigId,
      skuId: tableRow.skuId,
      countryId,
      isDefault: !!tableRow.isDefault,
      defaultInSelector: !!tableRow.defaultInSelector,
      showInSelector: !!tableRow.showInSelector,
      showInSettings: !!tableRow.showInSettings,
      order: tableRow.order,
      status,
      active: false,
    };
    if (
      result.isDefault ||
      result.defaultInSelector ||
      result.showInSelector ||
      result.showInSettings
    ) {
      result.active = true;
    }
    resultArr.push(result);
  });
  return resultArr;
};

export const updateSelectorConfigSkuModels = async (
  selectorConfigId: number,
  body: any,
  countryId?: number,
) => {
  let selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
    {
      where: { selectorConfigId },
    },
  );
  const selectorConfigModel: AndroidSelectorConfigModel = await AndroidSelectorConfig.findByPk(
    selectorConfigId,
  );

  if (countryId !== null) {
    selectorConfigSkuModels = selectorConfigSkuModels.filter((model) => {
      return model.countryId === countryId;
    });
  }

  const selectorConfigSkuModelsSet = new Set<number>();
  selectorConfigSkuModels.forEach((elem) => {
    selectorConfigSkuModelsSet.add(elem.id);
  });

  const selectorConfigSkuArrFromBody: any[] = await getBodySelectorConfigSkuArray(
    selectorConfigModel,
    body,
    countryId !== null ? countryId : null,
  );

  const incompleteBodyValues = selectorConfigSkuArrFromBody.some(
    (elem) => elem.status === AndroidModuleValueStatus.INCOMPLETE,
  );
  if (
    selectorConfigModel.status === AndroidModuleStatus.LIVE &&
    incompleteBodyValues
  ) {
    throw new AppError(
      'Live SelectorConfig could not have incomplete values',
      404,
    );
  }

  for (const fieldElem of selectorConfigSkuArrFromBody) {
    const foundSelectorConfigSkuModel = selectorConfigSkuModels.find((elem) => {
      return (
        elem.countryId === fieldElem.countryId && elem.order === fieldElem.order
      );
    });

    if (foundSelectorConfigSkuModel) {
      const previousSkuId = foundSelectorConfigSkuModel.skuId;
      foundSelectorConfigSkuModel.set('skuId', fieldElem.skuId);
      foundSelectorConfigSkuModel.set('isDefault', fieldElem.isDefault);
      foundSelectorConfigSkuModel.set(
        'defaultInSelector',
        fieldElem.defaultInSelector,
      );
      foundSelectorConfigSkuModel.set(
        'showInSelector',
        fieldElem.showInSelector,
      );
      foundSelectorConfigSkuModel.set(
        'showInSettings',
        fieldElem.showInSettings,
      );
      foundSelectorConfigSkuModel.set('order', fieldElem.order);
      foundSelectorConfigSkuModel.set('updated', getCurrentDate());
      await foundSelectorConfigSkuModel.save();
      await checkActiveSku(foundSelectorConfigSkuModel.skuId);
      await checkActiveSku(previousSkuId);
      selectorConfigSkuModelsSet.delete(foundSelectorConfigSkuModel.id);
    } else {
      const selectorConfigSkuDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!selectorConfigModel.createdBy
          ? selectorConfigModel.createdBy
          : null,
        selectorConfigId: selectorConfigModel.id,
        skuId: fieldElem.skuId,
        countryId: fieldElem.countryId,
        isDefault: fieldElem.isDefault,
        defaultInSelector: fieldElem.defaultInSelector,
        showInSelector: fieldElem.showInSelector,
        showInSettings: fieldElem.showInSettings,
        order: fieldElem.order,
        status: fieldElem.status,
      };
      await AndroidSelectorConfigSku.create(selectorConfigSkuDBPayload);
      await checkActiveSku(fieldElem.skuId);
    }
  }

  // destroy unsent from body language fields-value
  if (selectorConfigSkuModelsSet.size !== 0) {
    for (const selectorConfigSkuModelsSetElem of selectorConfigSkuModelsSet) {
      const foundSelectorConfigSkuModel: AndroidSelectorConfigSkuModel = await AndroidSelectorConfigSku.findByPk(
        selectorConfigSkuModelsSetElem,
      );
      await foundSelectorConfigSkuModel.destroy({ force: true });
      await checkActiveSku(foundSelectorConfigSkuModel.skuId);
    }
  }
};

export const getCurrentModuleStatus = async (
  selectorConfigModel: AndroidSelectorConfigModel,
) => {
  const selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  let statusSet = new Set<string>();
  let draftSkusSet = new Set<string>();

  for (let selectorConfigSkuModel of selectorConfigSkuModels) {
    statusSet.add(selectorConfigSkuModel.status);

    const skuModel: AndroidSkuModel = await AndroidSku.findByPk(
      selectorConfigSkuModel.skuId,
    );
    draftSkusSet.add(skuModel.status);
  }

  if (!statusSet.size) {
    await setModelStatus(selectorConfigModel, AndroidModuleStatus.DRAFT);
    return AndroidModuleStatus.DRAFT;
  } else {
    if (statusSet.has(AndroidModuleValueStatus.ENDED)) {
      await setModelStatus(selectorConfigModel, AndroidModuleStatus.ENDED);
      return AndroidModuleStatus.ENDED;
    } else if (
      !statusSet.has(AndroidModuleValueStatus.ENDED) &&
      statusSet.has(AndroidModuleValueStatus.PUBLISHED)
    ) {
      await setModelStatus(selectorConfigModel, AndroidModuleStatus.LIVE);
      return AndroidModuleStatus.LIVE;
    } else if (
      !statusSet.has(AndroidModuleValueStatus.ENDED) &&
      !statusSet.has(AndroidModuleValueStatus.PUBLISHED) &&
      !draftSkusSet.has(AndroidModuleStatus.DRAFT) &&
      statusSet.has(AndroidModuleValueStatus.SAVED)
    ) {
      await setModelStatus(selectorConfigModel, AndroidModuleStatus.COMPLETE);
      return AndroidModuleStatus.COMPLETE;
    } else if (
      !statusSet.has(AndroidModuleValueStatus.ENDED) &&
      !statusSet.has(AndroidModuleValueStatus.PUBLISHED)
    ) {
      await setModelStatus(selectorConfigModel, AndroidModuleStatus.DRAFT);
      return AndroidModuleStatus.DRAFT;
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

export const publishSelectorConfigSkuModels = async (
  skuModels: AndroidSkuModel[],
  selectorConfigSkuModels: AndroidSelectorConfigSkuModel[],
) => {
  for (const selectorConfigSkuModel of selectorConfigSkuModels) {
    let status: string;
    const skuModel = skuModels.find(
      (model) => model.id === selectorConfigSkuModel.skuId,
    );
    if (!skuModel) {
      status = AndroidModuleValueStatus.INCOMPLETE;
    } else {
      status = AndroidModuleValueStatus.PUBLISHED;
    }
    selectorConfigSkuModel.set('status', status);
    selectorConfigSkuModel.set('updated', getCurrentDate());
    await selectorConfigSkuModel.save();
  }
};

export const checkActiveSku = async (skuId: number) => {
  const skuModel: AndroidSkuModel = await AndroidSku.findByPk(skuId);
  const selectorConfigSkuModels: AndroidSelectorConfigSkuModel[] = await AndroidSelectorConfigSku.findAll(
    {
      where: { skuId },
    },
  );
  let active: boolean = false;
  if (selectorConfigSkuModels.length) {
    for (let selectorConfigSkuModel of selectorConfigSkuModels) {
      if (
        !selectorConfigSkuModel.isDefault &&
        !selectorConfigSkuModel.defaultInSelector &&
        !selectorConfigSkuModel.showInSelector &&
        !selectorConfigSkuModel.showInSettings
      ) {
        active = false;
      } else {
        active = true;
      }
    }
  } else {
    active = false;
  }

  skuModel.set('active', active);
  skuModel.set('updated', getCurrentDate());
  await skuModel.save();
};

// ===========================================================================================================================================

export const deploySelectorConfigData = async (
  env: string,
  selectorConfigModel: AndroidSelectorConfigModel,
  selectorConfigValueModels: AndroidSelectorConfigSkuModel[],
  tardisToken: string,
) => {
  let results: any[] = [];
  const storeModel: AndroidStoreModel = await AndroidStore.findByPk(
    selectorConfigModel.storeId,
  );
  const productModel: AndroidProductModel = await AndroidProduct.findByPk(
    selectorConfigModel.productId,
  );

  // set appCopyValue models data
  const countryIndexes = new Set<number>();
  selectorConfigValueModels.forEach((model) =>
    countryIndexes.add(model.countryId),
  );
  for (let countryId of countryIndexes) {
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(
      countryId,
    );
    const defaultCountryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findOne(
      {
        where: { countryId, isDefault: true },
      },
    );
    const defaultLanguageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(
      defaultCountryLanguageModel.languageId,
    );
    const countrySelectorConfigValueModels: AndroidSelectorConfigSkuModel[] = selectorConfigValueModels.filter(
      (model) => {
        return model.countryId === countryId;
      },
    );

    const tardisRequestUrl: string = requestUrl(
      env,
      storeModel.path,
      productModel.path,
      'selector-config',
      null,
      countryModel.code,
    );
    const tardisRequestBody = await getSelectorConfigTardisData(
      countrySelectorConfigValueModels,
      defaultLanguageModel,
    );

    results.push({ tardisRequestUrl, tardisRequestBody });
  }

  for (let elem of results) {
    await axios.put(elem.tardisRequestUrl, elem.tardisRequestBody, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: `Bearer ${tardisToken}`,
      },
    });
  }
  return results;
};

export const getSelectorConfigTardisData = async (
  countrySelectorConfigValueModels: AndroidSelectorConfigSkuModel[],
  defaultLanguageModel: AndroidLanguageModel,
): Promise<any> => {
  let supportedProducts: any[] = [];
  let supportedProductsObj: any = {};

  for (let indexCountrySelectorConfigValueModel of countrySelectorConfigValueModels) {
    const skuModel: AndroidSkuModel = await AndroidSku.findByPk(
      indexCountrySelectorConfigValueModel.skuId,
    );
    const countryLanguageModels: AndroidCountryLanguageModel[] = await AndroidCountryLanguage.findAll(
      {
        where: { countryId: indexCountrySelectorConfigValueModel.countryId },
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
      indexCountrySelectorConfigValueModel,
      skuModel,
      skuValueModels,
    );
    supportedProducts.push(supportedProductsObj);
  }

  return {
    defaultLanguage: defaultLanguageModel.code,
    supportedProducts,
  };
};

export const getSelectorConfigTardisDataSupportedProducts = async (
  indexCountrySelectorConfigValueModel: AndroidSelectorConfigSkuModel,
  skuModel: AndroidSkuModel,
  skuValueModels: AndroidSkuValueModel[],
) => {
  const isDefault = getProperValue(
    indexCountrySelectorConfigValueModel.isDefault,
    'boolean',
  );
  const defaultInSelector = getProperValue(
    indexCountrySelectorConfigValueModel.defaultInSelector,
    'boolean',
  );
  const showInSelector = getProperValue(
    indexCountrySelectorConfigValueModel.showInSelector,
    'boolean',
  );
  const showInSettings = getProperValue(
    indexCountrySelectorConfigValueModel.showInSettings,
    'boolean',
  );

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
      const currencySkuValueModel = skuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      if (currencySkuValueModel) {
        priceCurrency = getProperValue(
          currencySkuValueModel.value,
          nonTranslatableSkuFieldModel.type,
        );
      }
    } else if (nonTranslatableSkuFieldModel.name === 'price') {
      const amountSkuValueModel = skuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      if (amountSkuValueModel) {
        priceAmount = getProperValue(
          amountSkuValueModel.value,
          nonTranslatableSkuFieldModel.type,
        );
      }
    } else {
      const foundSkuValueModel = skuValueModels.find(
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
    skuValueModels.map((model) => model.countryLanguageId),
  );
  for (let countryLanguageId of countryLanguageIndexesSet) {
    let subscription: any = {};
    const countryLanguageModel: AndroidCountryLanguageModel = await AndroidCountryLanguage.findByPk(
      countryLanguageId,
    );
    const languageModel: AndroidLanguageModel = await AndroidLanguage.findByPk(
      countryLanguageModel.languageId,
    );
    const languageSkuValueModels = skuValueModels.filter(
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
    index: indexCountrySelectorConfigValueModel.order,
    parentId: skuModel.parentSkuId,
    id: skuModel.storeSkuId,
    linkId: skuModel.linkId,
    isDefault,
    defaultInSelector,
    showInSelector,
    showInSettings,
    priceCurrency,
    priceAmount,
    translations,
    ...nonTranslatableFields,
  };
};
