import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuCampaign,
  RokuCountry,
  RokuCountryLanguage,
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
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuModuleStatus, RokuModuleValueStatus } from '../../types/enum';
import { RokuSelectorConfigModel } from 'src/models/roku/SelectorConfig';
import { RokuSelectorConfigSkuModel } from 'src/models/roku/SelectorConfigSku';
import { RokuSkuModel } from 'src/models/roku/Sku';
import { getCurrentDate, setModuleEnv } from '.';
import axios from 'axios';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { checkTardisConnection, requestUrl } from '../../services/Tardis';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { RokuSkuValueModel } from 'src/models/roku/SkuValue';
import { RokuSkuFieldModel } from 'src/models/roku/SkuField';
import { setLiveCampaignParameter } from './campaign';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { isTokenValid, setModelStatus } from './multiModules';
import { getAuthToken } from '../../services/GateKeeper';
import { updateSpinnerText, getProperValue } from '../../util/utils';

const logger = Logger(module);

/**
 * GET /api/roku/selector-config/
 * Get all Roku SelectorConfig modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Roku SelectorConfig module Controller - getAllSelectorConfig',
    );
    updateSpinnerText('Getting all selector config modules...');
    try {
      const selectorConfigModels: RokuSelectorConfigModel[] = await RokuSelectorConfig.findAll();

      if (selectorConfigModels) {
        let results: any = [];
        for (let model of selectorConfigModels) {
          const result = await getSelectorConfigModuleData(model);
          results.push(result);
        }
        retWithSuccess(req, res, {
          message: 'Roku SelectorConfig modules found',
          status: 200,
          data: results,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No Roku SelectorConfig modules found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku getAllSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/selector-config/:selectorConfigId
 * Get Roku SelectorConfig module by selectorConfigId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku SelectorConfig module Controller - getSelectorConfig');
    updateSpinnerText('Getting selector config module...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        const result = await getSelectorConfigModuleData(selectorConfigModel);

        retWithSuccess(req, res, {
          message: 'Roku SelectorConfig module found',
          status: 200,
          data: result,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Roku SelectorConfig module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku getSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getSelectorConfigModuleData = async (
  selectorConfigModel: RokuSelectorConfigModel,
) => {
  let countries: any = {};
  const selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  if (selectorConfigSkuModels.length) {
    const countriesIndexes = new Set<number>();
    const countryModels: RokuCountryModel[] = await RokuCountry.findAll();

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
          const skuModels: RokuSkuModel[] = await RokuSku.findAll({
            where: {
              storeId: selectorConfigModel.storeId,
              productId: selectorConfigModel.productId,
            },
          });
          const skuModel = skuModels.find(
            (model) => model.id === selectorConfigSkuModel.skuId,
          );
          if (!skuModel) {
            status = RokuModuleValueStatus.INCOMPLETE;
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
 * POST /api/roku/selector-config/save?store&product
 * Save Roku SelectorConfig module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku SelectorConfig module Controller - saveSelectorConfig');
    updateSpinnerText('Saving selector config module...');
    const storeModel: RokuStoreModel = await RokuStore.findOne({
      where: { path: req.query.store as string },
    });
    const storeId: number = storeModel.id;

    const productModel: RokuProductModel = await RokuProduct.findOne({
      where: { path: req.query.product as string },
    });
    const productId: number = productModel.id;
    let selectorConfigId: number;

    if (storeModel && productModel) {
      try {
        // Check if the module is the first in DB
        let isDefault: boolean = false;
        const selectorConfigModels: RokuSelectorConfigModel[] = await RokuSelectorConfig.findAll(
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
          status: RokuModuleStatus.DRAFT,
        };
        const selectorConfigResult = await RokuSelectorConfig.create(
          selectorConfigDBPayload,
        );
        selectorConfigId = selectorConfigResult.id;
        if (Object.keys(req.body.countries).length) {
          await createSelectorConfigSkuModels(selectorConfigResult, req.body);

          const currentStatus = await getCurrentModuleStatus(
            selectorConfigResult,
          );
          if (currentStatus !== RokuModuleStatus.DRAFT) {
            selectorConfigResult.set('status', currentStatus);
            await selectorConfigResult.save();
          }
        }

        retWithSuccess(req, res, {
          message: `Roku ${selectorConfigResult.name} SelectorConfig module saved in DB successfully`,
          status: 201,
          data: { selectorConfigId },
        });
      } catch (err) {
        logger.error(`Roku saveSelectorConfig failed, ${err.message}`, err);

        // deleting incomplete records from DB
        const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
          selectorConfigId,
        );
        await selectorConfigModel.destroy({ force: true });

        return next(processOfferError(err));
      }
    } else {
      retWithSuccess(req, res, {
        message: 'No such Roku store or product found',
        status: 200,
        data: null,
      });
    }
  },
);

/**
 * PUT /api/roku/selector-config/:selectorConfigId/update
 * Update Roku SelectorConfig module by selectorConfigId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Roku SelectorConfig module Controller - updateSelectorConfig',
    );
    updateSpinnerText('Updating selector config module...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        if (req.query.status !== undefined) {
          selectorConfigModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          selectorConfigModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (req.query.country) {
            const countryModel: RokuCountryModel = await RokuCountry.findOne({
              where: {
                storeId: selectorConfigModel.storeId,
                productId: selectorConfigModel.productId,
                code: req.query.country,
              },
            });
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
          message: `Roku ${selectorConfigModel.name} SelectorConfig module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Roku SelectorConfig module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku updateSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/selector-config/:selectorConfigId/usage
 * Get Roku SelectorConfig module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getSelectorConfigUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Roku SelectorConfig module Controller - getSelectorConfigUsage',
    );
    updateSpinnerText('Getting selector config module usage...');
    try {
      const selectorConfigId: number = Number(req.params.selectorConfigId);
      const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
        selectorConfigId,
      );

      if (selectorConfigModel) {
        const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
          where: { selectorConfigId },
        });

        if (!campaignModels.length) {
          retWithSuccess(req, res, {
            message: `Roku ${selectorConfigModel.name} SelectorConfig module usage not found`,
            status: 200,
            data: null,
          });
        }

        let data: any[] = null;
        if (campaignModels.length) {
          data = [];
          campaignModels.forEach((model) => {
            data.push(model.name);
          });
        }

        retWithSuccess(req, res, {
          message: `Roku ${selectorConfigModel.name} SelectorConfig module usage data found`,
          status: 200,
          data,
        });
      } else {
        throw new AppError('SelectorConfig module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Roku getSelectorConfigUsage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/roku/selector-config/:selectorConfigId/publish?env
 * Publish Roku SelectorConfig module by selectorConfigId and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishSelectorConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug(
      'Roku SelectorConfig module Controller - publishSelectorConfig',
    );
    updateSpinnerText('Publishing selector config module...');
    const selectorConfigId: number = Number(req.params.selectorConfigId);
    const env: string = req.query.env as string;
    try {
      const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
        selectorConfigId,
      );
      if (selectorConfigModel) {
        const data = await publishSelectorConfigModule(
          selectorConfigModel,
          env,
          req.body,
        );

        retWithSuccess(req, res, {
          message: `Roku ${
            selectorConfigModel.name
          } SelectorConfig module published on ${env.toUpperCase()} successfully`,
          status: 201,
          data,
        });
      } else {
        retWithSuccess(req, res, {
          message: `No such roku SelectorConfig module found in DB`,
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku publishSelectorConfig failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const publishSelectorConfigModule = async (
  selectorConfigModel: RokuSelectorConfigModel,
  env: string,
  body: any,
) => {
  let tardisToken = '';
  let tardisTokenExpiresAt = '';
  if (!isTokenValid(body)) {
    [tardisToken, tardisTokenExpiresAt] = await getAuthToken();
  }
  await checkTardisConnection(tardisToken);

  const selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  const skuModels: RokuSkuModel[] = await RokuSku.findAll({
    where: {
      storeId: selectorConfigModel.storeId,
      productId: selectorConfigModel.productId,
    },
  });
  await publishSelectorConfigSkuModels(skuModels, selectorConfigSkuModels);
  selectorConfigModel.set('status', RokuModuleStatus.LIVE);

  if (selectorConfigModel.status === RokuModuleStatus.LIVE) {
    let restModels: RokuSelectorConfigModel[] = await RokuSelectorConfig.findAll(
      {
        where: {
          storeId: selectorConfigModel.storeId,
          productId: selectorConfigModel.productId,
          status: RokuModuleStatus.LIVE,
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
          const restValueModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
            {
              where: { selectorConfigId: restModel.id },
            },
          );
          for (let restValueModel of restValueModels) {
            if (restValueModel.status === RokuModuleValueStatus.PUBLISHED) {
              restValueModel.set('status', RokuModuleValueStatus.ENDED);
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
  selectorConfigModel: RokuSelectorConfigModel,
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
    await RokuSelectorConfigSku.create(selectorConfigSkuDBPayload);
    await checkActiveSku(elem.skuId);
  }
};

export const getBodySelectorConfigSkuArray = async (
  selectorConfigModel: RokuSelectorConfigModel,
  body: any,
  countryId?: number,
) => {
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  let result: any = [];
  const storeId = selectorConfigModel.storeId;
  const productId = selectorConfigModel.productId;
  const skuModels: RokuSkuModel[] = await RokuSku.findAll({
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
  skuModels: RokuSkuModel[],
) => {
  let resultArr: any[] = [];
  bodyCountry.tableData.forEach((tableRow: any) => {
    let status: string;
    const skuModel = skuModels.find((model) => model.id === tableRow.skuId);
    if (!skuModel || skuModel.status === RokuModuleStatus.DRAFT) {
      status = RokuModuleValueStatus.INCOMPLETE;
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
  let selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
    {
      where: { selectorConfigId },
    },
  );
  const selectorConfigModel: RokuSelectorConfigModel = await RokuSelectorConfig.findByPk(
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
    (elem) => elem.status === RokuModuleValueStatus.INCOMPLETE,
  );
  if (
    selectorConfigModel.status === RokuModuleStatus.LIVE &&
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
      await RokuSelectorConfigSku.create(selectorConfigSkuDBPayload);
      await checkActiveSku(fieldElem.skuId);
    }
  }

  // destroy unsent from body language fields-value
  if (selectorConfigSkuModelsSet.size !== 0) {
    for (const selectorConfigSkuModelsSetElem of selectorConfigSkuModelsSet) {
      const foundSelectorConfigSkuModel: RokuSelectorConfigSkuModel = await RokuSelectorConfigSku.findByPk(
        selectorConfigSkuModelsSetElem,
      );
      await foundSelectorConfigSkuModel.destroy({ force: true });
      await checkActiveSku(foundSelectorConfigSkuModel.skuId);
    }
  }
};

export const getCurrentModuleStatus = async (
  selectorConfigModel: RokuSelectorConfigModel,
) => {
  const selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
    {
      where: { selectorConfigId: selectorConfigModel.id },
    },
  );
  let statusSet = new Set<string>();
  let draftSkusSet = new Set<string>();

  for (let selectorConfigSkuModel of selectorConfigSkuModels) {
    statusSet.add(selectorConfigSkuModel.status);

    const skuModel: RokuSkuModel = await RokuSku.findByPk(
      selectorConfigSkuModel.skuId,
    );
    draftSkusSet.add(skuModel.status);
  }

  if (!statusSet.size) {
    await setModelStatus(selectorConfigModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  } else {
    if (statusSet.has(RokuModuleValueStatus.ENDED)) {
      await setModelStatus(selectorConfigModel, RokuModuleStatus.ENDED);
      return RokuModuleStatus.ENDED;
    } else if (
      !statusSet.has(RokuModuleValueStatus.ENDED) &&
      statusSet.has(RokuModuleValueStatus.PUBLISHED)
    ) {
      await setModelStatus(selectorConfigModel, RokuModuleStatus.LIVE);
      return RokuModuleStatus.LIVE;
    } else if (
      !statusSet.has(RokuModuleValueStatus.ENDED) &&
      !statusSet.has(RokuModuleValueStatus.PUBLISHED) &&
      !draftSkusSet.has(RokuModuleStatus.DRAFT) &&
      statusSet.has(RokuModuleValueStatus.SAVED)
    ) {
      await setModelStatus(selectorConfigModel, RokuModuleStatus.COMPLETE);
      return RokuModuleStatus.COMPLETE;
    } else if (
      !statusSet.has(RokuModuleValueStatus.ENDED) &&
      !statusSet.has(RokuModuleValueStatus.PUBLISHED)
    ) {
      await setModelStatus(selectorConfigModel, RokuModuleStatus.DRAFT);
      return RokuModuleStatus.DRAFT;
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

export const publishSelectorConfigSkuModels = async (
  skuModels: RokuSkuModel[],
  selectorConfigSkuModels: RokuSelectorConfigSkuModel[],
) => {
  for (const selectorConfigSkuModel of selectorConfigSkuModels) {
    let status: string;
    const skuModel = skuModels.find(
      (model) => model.id === selectorConfigSkuModel.skuId,
    );
    if (!skuModel) {
      status = RokuModuleValueStatus.INCOMPLETE;
    } else {
      status = RokuModuleValueStatus.PUBLISHED;
    }
    selectorConfigSkuModel.set('status', status);
    selectorConfigSkuModel.set('updated', getCurrentDate());
    await selectorConfigSkuModel.save();
  }
};

export const checkActiveSku = async (skuId: number) => {
  const skuModel: RokuSkuModel = await RokuSku.findByPk(skuId);
  const selectorConfigSkuModels: RokuSelectorConfigSkuModel[] = await RokuSelectorConfigSku.findAll(
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

export const isRowEmpty = (row: any): boolean => {
  return (
    !row.isDefault &&
    !row.defaultInSelector &&
    !row.showInSettings &&
    !row.showInSelector
  );
};

// ===========================================================================================================================================

export const deploySelectorConfigData = async (
  env: string,
  selectorConfigModel: RokuSelectorConfigModel,
  selectorConfigValueModels: RokuSelectorConfigSkuModel[],
  tardisToken: string,
) => {
  let results: any[] = [];
  const storeModel: RokuStoreModel = await RokuStore.findByPk(
    selectorConfigModel.storeId,
  );
  const productModel: RokuProductModel = await RokuProduct.findByPk(
    selectorConfigModel.productId,
  );

  // set appCopyValue models data
  const countryIndexes = new Set<number>();
  selectorConfigValueModels.forEach((model) =>
    countryIndexes.add(model.countryId),
  );
  for (let countryId of countryIndexes) {
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(
      countryId,
    );
    const defaultCountryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findOne(
      {
        where: { countryId, isDefault: true },
      },
    );
    const defaultLanguageModel: RokuLanguageModel = await RokuLanguage.findByPk(
      defaultCountryLanguageModel.languageId,
    );
    const countrySelectorConfigValueModels: RokuSelectorConfigSkuModel[] = selectorConfigValueModels.filter(
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
  countrySelectorConfigValueModels: RokuSelectorConfigSkuModel[],
  defaultLanguageModel: RokuLanguageModel,
): Promise<any> => {
  let supportedProducts: any[] = [];
  let supportedProductsObj: any = {};

  for (let indexCountrySelectorConfigValueModel of countrySelectorConfigValueModels) {
    const skuModel: RokuSkuModel = await RokuSku.findByPk(
      indexCountrySelectorConfigValueModel.skuId,
    );
    const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll(
      {
        where: { countryId: indexCountrySelectorConfigValueModel.countryId },
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
  indexCountrySelectorConfigValueModel: RokuSelectorConfigSkuModel,
  skuModel: RokuSkuModel,
  skuValueModels: RokuSkuValueModel[],
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

  const nonTranslatableSkuFieldModels: RokuSkuFieldModel[] = await RokuSkuField.findAll(
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
          !!currencySkuValueModel ? currencySkuValueModel.value : '',
          nonTranslatableSkuFieldModel.type,
        );
      }
    } else if (nonTranslatableSkuFieldModel.name === 'price') {
      const amountSkuValueModel = skuValueModels.find(
        (model) => model.skuFieldId === nonTranslatableSkuFieldModel.id,
      );
      if (amountSkuValueModel) {
        priceAmount = getProperValue(
          !!amountSkuValueModel ? amountSkuValueModel.value : '',
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
    const countryLanguageModel: RokuCountryLanguageModel = await RokuCountryLanguage.findByPk(
      countryLanguageId,
    );
    const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(
      countryLanguageModel.languageId,
    );
    const languageSkuValueModels = skuValueModels.filter(
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

  return {
    index: indexCountrySelectorConfigValueModel.order,
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
