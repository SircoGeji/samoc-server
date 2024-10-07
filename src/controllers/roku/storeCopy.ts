import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuCampaign,
  RokuLanguage,
  RokuProduct,
  RokuStore,
  RokuStoreCopy,
  RokuStoreCopyField,
  RokuStoreCopyValue,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuModuleStatus, RokuModuleValueStatus } from '../../types/enum';
import { RokuStoreCopyModel } from 'src/models/roku/StoreCopy';
import { RokuStoreCopyFieldModel } from 'src/models/roku/StoreCopyField';
import { RokuStoreCopyValueModel } from 'src/models/roku/StoreCopyValue';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { getCurrentDate, setModuleEnv } from '.';
import { setLiveCampaignParameter } from './campaign';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { updateSpinnerText, getProperValue } from '../../util/utils';
import { setModelStatus } from './multiModules';

const logger = Logger(module);

/**
 * GET /api/roku/store-copy/fields?store&product
 * Get Roku StoreCopy module fields by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getStoreCopyFields = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - getStoreCopyFields');
  updateSpinnerText('Getting store copy module fields...');
  try {
    const storeModel: RokuStoreModel = await RokuStore.findOne({
      where: { path: req.query.store },
    });

    if (storeModel) {
      const storeId: number = storeModel.id;
      const storeCopyFields: RokuStoreCopyFieldModel[] = await RokuStoreCopyField.findAll({
        where: { storeId },
      });
      if (storeCopyFields.length) {
        const results = storeCopyFields.map((model) => {
          return {
            fieldName: model.name,
            dataType: model.type,
            maxLength: model.charLimit,
            required: model.required,
            order: model.order,
          };
        });
        retWithSuccess(req, res, {
          message: 'Roku StoreCopy module fields found',
          status: 200,
          data: results,
        });
      } else {
        throw new AppError('Roku StoreCopy module fields not found', 404);
      }
    } else {
      throw new AppError('Such Roku Store module not found', 404);
    }
  } catch (err) {
    logger.error(`Roku getStoreCopyFields failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/store-copy/
 * Get all Roku StoreCopy modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStoreCopy = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - getAllStoreCopy');
  updateSpinnerText('Getting all store copy modules...');
  try {
    let storeCopyModels: RokuStoreCopyModel[] = [];
    if (req.query.store && req.query.product) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store as string },
      });
      const productModel: RokuProductModel = await RokuProduct.findOne({
        where: { path: req.query.product as string },
      });
      if (storeModel && productModel) {
        const storeId: number = storeModel.id;
        const productId: number = productModel.id;

        storeCopyModels = await RokuStoreCopy.findAll({
          where: { storeId, productId },
        });
      } else {
        throw new AppError('Such Roku Store and Product modules not found', 404);
      }
    } else {
      storeCopyModels = await RokuStoreCopy.findAll();
    }

    if (storeCopyModels.length) {
      let results: any = [];

      for (let model of storeCopyModels) {
        const result = await getStoreCopyModuleData(model);
        results.push(result);
      }

      retWithSuccess(req, res, {
        message: 'Roku StoreCopy modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku StoreCopy modules not found',
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Roku getAllStoreCopy failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/store-copy/:campaignId
 * Get Roku StoreCopy module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getStoreCopy = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - getStoreCopy');
  updateSpinnerText('Getting store copy module...');
  try {
    const storeCopyId: number = Number(req.params.storeCopyId);
    if (storeCopyId !== null || storeCopyId !== undefined) {
      const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);
      if (storeCopyModel) {
        const result = await getStoreCopyModuleData(storeCopyModel);
        if (result) {
          retWithSuccess(req, res, {
            message: 'Roku StoreCopy module found',
            status: 200,
            data: result,
          });
        } else {
          retWithSuccess(req, res, {
            message: 'Roku StoreCopy module not found',
            status: 200,
            data: null,
          });
        }
      } else {
        throw new AppError('Such Roku StoreCopy module not found', 404);
      }
    } else {
      throw new AppError('Invalid storeCopyId value', 404);
    }
  } catch (err) {
    logger.error(`Roku getAllStoreCopy failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getStoreCopyModuleData = async (storeCopyModel: RokuStoreCopyModel) => {
  const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
    where: { storeCopyId: storeCopyModel.id },
  });
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
  const storeCopyFieldModels: RokuStoreCopyFieldModel[] = await RokuStoreCopyField.findAll();
  let languages: any = {};
  if (storeCopyFieldModels.length) {
    const languagesIdSet = new Set<number>();
    storeCopyValueModels.forEach((model) => languagesIdSet.add(model.languageId));
    languagesIdSet.forEach((languageId) => {
      const languageStoreCopyValueModels = storeCopyValueModels.filter((model) => model.languageId === languageId);
      if (languageStoreCopyValueModels.length) {
        const languageModel = languageModels.find((model) => model.id === languageId);
        if (languageModel) {
          const fieldsIdSet = new Set<number>();
          languageStoreCopyValueModels.forEach((model) => fieldsIdSet.add(model.storeCopyFieldId));
          let statusSet = new Set<string>();
          let tableData: any = {};
          fieldsIdSet.forEach((storeCopyFieldId) => {
            const fieldStoreCopyValueModel = languageStoreCopyValueModels.find(
              (model) => model.storeCopyFieldId === storeCopyFieldId,
            );
            if (fieldStoreCopyValueModel) {
              const foundFieldModel = storeCopyFieldModels.find((model) => model.id === storeCopyFieldId);
              if (foundFieldModel) {
                const value = getProperValue(fieldStoreCopyValueModel.value, foundFieldModel.type);
                tableData = { ...tableData, [foundFieldModel.name]: value };
                statusSet.add(fieldStoreCopyValueModel.status);
              }
            }
          });
          languages = {
            ...languages,
            [languageModel.code]: {
              status: Array.from(statusSet)[0] || RokuModuleValueStatus.INCOMPLETE,
              tableData,
            },
          };
        }
      }
    });
  }
  const status = await getCurrentModuleStatus(storeCopyModel);
  return {
    storeCopyId: storeCopyModel.id,
    created: storeCopyModel.created,
    updated: storeCopyModel.updated,
    storeId: storeCopyModel.storeId,
    productId: storeCopyModel.productId,
    name: storeCopyModel.name,
    isDefault: storeCopyModel.isDefault,
    status,
    deployedTo: storeCopyModel.deployedTo,
    endedOn: storeCopyModel.endedOn,
    languages,
  };
};

/**
 * POST /api/roku/store-copy/save?store&product
 * Save Roku StoreCopy module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveStoreCopy = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - saveStoreCopy');
  updateSpinnerText('Saving store copy module...');
  let storeCopyId: number;
  try {
    if (req.query.store && req.query.product) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store as string },
      });
      const productModel: RokuProductModel = await RokuProduct.findOne({
        where: { path: req.query.product as string },
      });
      if (storeModel && productModel) {
        const storeId: number = storeModel.id;
        const productId: number = productModel.id;

        // Check if the module is the first in DB
        let isDefault: boolean = false;
        const storeCopyModels: RokuStoreCopyModel[] = await RokuStoreCopy.findAll({
          where: { storeId, productId },
        });
        if (!storeCopyModels.length) {
          isDefault = true;
        }

        const storeCopyDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          name: req.body.name,
          isDefault,
          status: RokuModuleStatus.DRAFT,
        };
        const storeCopyResult = await RokuStoreCopy.create(storeCopyDBPayload);
        storeCopyId = storeCopyResult.id;
        await createStoreCopyValueModels(storeCopyResult, req.body.languages);

        const currentStatus = await getCurrentModuleStatus(storeCopyResult);
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          storeCopyResult.set('status', currentStatus);
          await storeCopyResult.save();
        }

        retWithSuccess(req, res, {
          message: `Roku ${storeCopyResult.name} StoreCopy module saved in DB successfully`,
          status: 201,
          data: { storeCopyId },
        });
      } else {
        throw new AppError('Such Roku Store and Product modules not found', 404);
      }
    } else {
      throw new AppError('Store and product values not found', 404);
    }
  } catch (err) {
    logger.error(`Roku saveStoreCopy failed, ${err.message}`, err);

    // deleting incomplete records from DB
    const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);
    await storeCopyModel.destroy({ force: true });

    return next(processOfferError(err));
  }
});

/**
 * PUT /api/roku/store-copy/:campaignId/update
 * Update Roku StoreCopy module by campaignId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateStoreCopy = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - updateStoreCopy');
  updateSpinnerText('Updating store copy module...');
  try {
    const storeCopyId: number = Number(req.params.storeCopyId);
    if (storeCopyId !== null || storeCopyId !== undefined) {
      const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);
      if (storeCopyModel) {
        if (req.query.status !== undefined) {
          storeCopyModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          storeCopyModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (req.query.language) {
            const languageModel: RokuLanguageModel = await RokuLanguage.findOne({
              where: { code: req.query.language },
            });
            await updateStoreCopyValueModels(storeCopyId, req.body, languageModel.id);
          } else {
            await updateStoreCopyValueModels(storeCopyId, req.body.languages, null);
            storeCopyModel.set('name', req.body.name);
          }
        }

        await recheckDefaultLanguages(storeCopyModel);

        const currentStatus = await getCurrentModuleStatus(storeCopyModel);
        storeCopyModel.set('status', currentStatus);
        storeCopyModel.set('updated', getCurrentDate());
        await storeCopyModel.save();

        retWithSuccess(req, res, {
          message: `Roku ${storeCopyModel.name} StoreCopy module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        throw new AppError('Such Roku StoreCopy module not found', 404);
      }
    } else {
      throw new AppError('Invalid storeCopyId value', 404);
    }
  } catch (err) {
    logger.error(`Roku updateStoreCopy failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

const updateStoreCopyValueModels = async (storeCopyId: number, body: any, languageId?: number) => {
  let storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
    where: { storeCopyId },
  });
  const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);

  if (!!languageId) {
    storeCopyValueModels = storeCopyValueModels.filter((model) => {
      return model.languageId === languageId;
    });
  }

  const storeCopyValueModelsSet = new Set<number>();
  storeCopyValueModels.forEach((elem) => {
    storeCopyValueModelsSet.add(elem.id);
  });

  const storeCopyValueArrFromBody: any[] = await getBodyStoreCopyValueArray(
    storeCopyModel,
    body,
    languageId !== null ? languageId : null,
  );

  for (const fieldElem of storeCopyValueArrFromBody) {
    const foundStoreCopyValueModel = storeCopyValueModels.find((elem) => {
      return elem.languageId === fieldElem.languageId && elem.storeCopyFieldId === fieldElem.storeCopyFieldId;
    });

    if (foundStoreCopyValueModel) {
      foundStoreCopyValueModel.set('value', fieldElem.value);
      foundStoreCopyValueModel.set('status', fieldElem.status);
      foundStoreCopyValueModel.set('updated', getCurrentDate());
      await foundStoreCopyValueModel.save();
      storeCopyValueModelsSet.delete(foundStoreCopyValueModel.id);
    } else {
      const storeCopyValueDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!storeCopyModel.createdBy ? storeCopyModel.createdBy : null,
        storeCopyId: fieldElem.storeCopyId,
        languageId: fieldElem.languageId,
        storeCopyFieldId: fieldElem.storeCopyFieldId,
        value: fieldElem.value,
        status: fieldElem.status,
      };
      await RokuStoreCopyValue.create(storeCopyValueDBPayload);
    }
  }

  // destroy unsent from body language fields-value
  if (storeCopyValueModelsSet.size !== 0) {
    for (const storeCopyValueModelsSetElem of storeCopyValueModelsSet) {
      const foundStoreCopyValueModel: RokuStoreCopyValueModel = await RokuStoreCopyValue.findByPk(
        storeCopyValueModelsSetElem,
      );
      if (foundStoreCopyValueModel) {
        await foundStoreCopyValueModel.destroy({ force: true });
      }
    }
  }
};

/**
 * GET /api/roku/store-copy/:storeCopyId/usage
 * Get Roku StoreCopy module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getStoreCopyUsage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - getStoreCopyUsage');
  updateSpinnerText('Getting store copy module usage...');
  try {
    const storeCopyId: number = Number(req.params.storeCopyId);
    const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);

    if (storeCopyModel) {
      const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
        where: { storeCopyId },
      });

      if (!campaignModels.length) {
        retWithSuccess(req, res, {
          message: `Roku ${storeCopyModel.name} StoreCopy module usage not found`,
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
        message: `Roku ${storeCopyModel.name} StoreCopy module usage data found`,
        status: 201,
        data,
      });
    } else {
      throw new AppError('StoreCopy module in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Roku getStoreCopyUsage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/store-copy/:campaignId/publish?env
 * Publish Roku StoreCopy module by campaignId and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishStoreCopy = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku StoreCopy module Controller - publishStoreCopy');
  updateSpinnerText('Publishing store copy module...');
  try {
    const storeCopyId: number = Number(req.params.storeCopyId);
    const env: string = req.query.env as string;
    if (storeCopyId !== null || storeCopyId !== undefined) {
      const storeCopyModel: RokuStoreCopyModel = await RokuStoreCopy.findByPk(storeCopyId);
      if (storeCopyModel) {
        await publishStoreCopyModule(storeCopyModel, env);

        retWithSuccess(req, res, {
          message: `Roku ${storeCopyModel.name} StoreCopy module published on ${env.toUpperCase()} successfully`,
          status: 201,
          // data: { tardisData },
          data: null,
        });
      } else {
        throw new AppError('Such Roku StoreCopy module not found', 404);
      }
    } else {
      throw new AppError('Invalid storeCopyId value', 404);
    }
  } catch (err) {
    logger.error(`Roku publishStoreCopy failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const publishStoreCopyModule = async (storeCopyModel: RokuStoreCopyModel, env: string) => {
  const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
    where: { storeCopyId: storeCopyModel.id },
  });
  await publishStoreCopyValueModels(storeCopyValueModels);
  const status = await getCurrentModuleStatus(storeCopyModel);
  storeCopyModel.set('status', status);

  if (storeCopyModel.status === RokuModuleStatus.LIVE) {
    let restModels: RokuStoreCopyModel[] = await RokuStoreCopy.findAll({
      where: {
        storeId: storeCopyModel.storeId,
        productId: storeCopyModel.productId,
        status: RokuModuleStatus.LIVE,
      },
    });
    restModels = restModels.filter((elem) => {
      return elem.id !== storeCopyModel.id && elem.deployedTo.includes(env);
    });
    if (restModels.length) {
      for (let restModel of restModels) {
        if (restModel.deployedTo === env) {
          const restValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
            where: { storeCopyId: restModel.id },
          });
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
    setModuleEnv(storeCopyModel, env, 'deployedTo');
    if (env === storeCopyModel.endedOn) {
      storeCopyModel.set('endedOn', null);
    }
  }

  storeCopyModel.set('updated', getCurrentDate());
  await storeCopyModel.save();

  await setLiveCampaignParameter(
    storeCopyModel.storeId,
    storeCopyModel.productId,
    'store-copy',
    env,
    storeCopyModel.id,
  );

  // const data = await deployModuleData(
  //     env,
  //     storeCopyModel,
  //     storeCopyValueModels,
  //     'store-copy',
  // );
  // return data;
};

const publishStoreCopyValueModels = async (storeCopyValueModels: RokuStoreCopyValueModel[]) => {
  for (const model of storeCopyValueModels) {
    model.set('status', RokuModuleValueStatus.PUBLISHED);
    model.set('updated', getCurrentDate());
    await model.save();
  }
};

const createStoreCopyValueModels = async (storeCopyModel: RokuStoreCopyModel, body: any) => {
  const storeCopyValueArray = await getBodyStoreCopyValueArray(storeCopyModel, body, null);
  for (const elem of storeCopyValueArray) {
    const storeCopyValueDBPayload = {
      created: getCurrentDate(),
      updatd: getCurrentDate(),
      createdBy: !!storeCopyModel.createdBy ? storeCopyModel.createdBy : null,
      storeCopyId: elem.storeCopyId,
      languageId: elem.languageId,
      storeCopyFieldId: elem.storeCopyFieldId,
      value: elem.value,
      status: elem.status,
    };
    await RokuStoreCopyValue.create(storeCopyValueDBPayload);
  }
};

const getBodyStoreCopyValueArray = async (
  storeCopyModel: RokuStoreCopyModel,
  body: any,
  receivedLanguageId?: number,
) => {
  const storeCopyFieldsModels: RokuStoreCopyFieldModel[] = await RokuStoreCopyField.findAll();
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();

  const storeCopyId = storeCopyModel.id;
  const storeId = storeCopyModel.storeId;
  const productId = storeCopyModel.productId;
  let result: any[] = [];
  let languageId: number = null;

  if (!!receivedLanguageId) {
    languageId = receivedLanguageId;
    result = getStoreCopyValueArrayFromLanguageBody(
      body,
      storeCopyId,
      storeId,
      productId,
      storeCopyFieldsModels,
      languageId,
    );
  } else {
    result = getStoreCopyValueArrayFromModuleBody(
      body,
      storeCopyId,
      storeId,
      productId,
      storeCopyFieldsModels,
      languageModels,
      languageId !== null ? languageId : null,
    );
  }
  return result;
};

const getStoreCopyValueArrayFromModuleBody = (
  body: any,
  storeCopyId: number,
  storeId: number,
  productId: number,
  storeCopyFieldsModels: RokuStoreCopyFieldModel[],
  languageModels: RokuLanguageModel[],
  languageId?: number,
): any[] => {
  let result: any = [];
  const bodyLanguageKeys = Object.keys(body);
  const bodyLanguageValues = Object.values(body);
  if (bodyLanguageKeys.length) {
    bodyLanguageValues.forEach((bodyLanguage, i) => {
      result = [
        ...result,
        ...getStoreCopyValueArrayFromLanguageBody(
          bodyLanguage,
          storeCopyId,
          storeId,
          productId,
          storeCopyFieldsModels,
          languageId !== null ? languageId : languageModels.find((elem) => elem.code === bodyLanguageKeys[i]).id,
        ),
      ];
    });
  }
  return result;
};

const getStoreCopyValueArrayFromLanguageBody = (
  bodyLanguage: any,
  storeCopyId: number,
  storeId: number,
  productId: number,
  storeCopyFieldsModels: RokuStoreCopyFieldModel[],
  languageId: number,
): any[] => {
  let resultArr: any[] = [];
  // const status: string = bodyLanguage.status;
  const bodyFieldKeys = Object.keys(bodyLanguage.tableData);
  const bodyFieldValues = Object.values(bodyLanguage.tableData);
  if (bodyFieldKeys.length && bodyFieldValues.length) {
    bodyFieldValues.forEach((bodyField, i) => {
      const storreCopyFieldModel = storeCopyFieldsModels.find((elem) => {
        return elem.name === bodyFieldKeys[i] && elem.storeId === storeId;
      });
      resultArr.push({
        storeCopyId,
        storeId,
        productId,
        languageId,
        storeCopyFieldId: storreCopyFieldModel.id,
        value: bodyField,
        status: getFieldStatus(storreCopyFieldModel, bodyField),
      });
    });
  } else {
    resultArr.push({
      storeCopyId,
      storeId,
      productId,
      languageId,
      storeCopyFieldId: null,
      value: null,
      status: RokuModuleValueStatus.INCOMPLETE,
    });
  }
  return resultArr;
};

const getCurrentModuleStatus = async (storeCopyModel: RokuStoreCopyModel) => {
  const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
    where: { storeCopyId: storeCopyModel.id },
  });
  let languageIndexes = new Set<number>();
  const statusSet = new Set<string>();
  if (storeCopyValueModels.length) {
    storeCopyValueModels.forEach((model) => {
      languageIndexes.add(model.languageId);
      statusSet.add(model.status);
    });
  }
  const isStoreCopyModuleDraftResult = await isStoreCopyModuleDraft(storeCopyModel);
  if (statusSet.has(RokuModuleValueStatus.ENDED)) {
    await setModelStatus(storeCopyModel, RokuModuleStatus.ENDED);
    return RokuModuleStatus.ENDED;
  } else if (statusSet.has(RokuModuleValueStatus.PUBLISHED)) {
    await setModelStatus(storeCopyModel, RokuModuleStatus.LIVE);
    return RokuModuleStatus.LIVE;
  } else if (
    !statusSet.has(RokuModuleValueStatus.ENDED) &&
    !statusSet.has(RokuModuleValueStatus.PUBLISHED) &&
    isStoreCopyModuleDraftResult
  ) {
    await setModelStatus(storeCopyModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  } else if (
    !statusSet.has(RokuModuleValueStatus.ENDED) &&
    !statusSet.has(RokuModuleValueStatus.PUBLISHED) &&
    !isStoreCopyModuleDraftResult
  ) {
    await setModelStatus(storeCopyModel, RokuModuleStatus.READY);
    return RokuModuleStatus.READY;
  }
};

const recheckDefaultLanguages = async (defaultStoreCopyModel: RokuStoreCopyModel) => {
  if (defaultStoreCopyModel && defaultStoreCopyModel.isDefault) {
    const defaultStoreCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
      where: { storeCopyId: defaultStoreCopyModel.id },
    });
    const storeCopyModels: RokuStoreCopyModel[] = await RokuStoreCopy.findAll({
      where: { storeId: defaultStoreCopyModel.storeId, productId: defaultStoreCopyModel.productId },
    });
    let defaultLanguageIndexes = new Set<number>();
    defaultStoreCopyValueModels.forEach((model) => defaultLanguageIndexes.add(model.languageId));

    for (let storeCopyModel of storeCopyModels) {
      if (!storeCopyModel.isDefault) {
        const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
          where: { storeCopyId: storeCopyModel.id },
        });
        let languageIndexes = new Set<number>();
        storeCopyValueModels.forEach((model) => languageIndexes.add(model.languageId));

        for (let languageId of defaultLanguageIndexes) {
          if (!languageIndexes.has(languageId)) {
            const currentLanguageIdDefaultStoreCopyValueModels = defaultStoreCopyValueModels.filter((model) => {
              return model.languageId === languageId;
            });

            if (currentLanguageIdDefaultStoreCopyValueModels) {
              for (let defaultStoreCopyValueModel of currentLanguageIdDefaultStoreCopyValueModels) {
                const status =
                  defaultStoreCopyValueModel.status === RokuModuleValueStatus.INCOMPLETE
                    ? RokuModuleValueStatus.INCOMPLETE
                    : RokuModuleValueStatus.SAVED;
                const storeCopyValueDBPayload = {
                  created: getCurrentDate(),
                  updated: getCurrentDate(),
                  createdBy: !!storeCopyModel.createdBy ? storeCopyModel.createdBy : null,
                  storeCopyId: storeCopyModel.id,
                  languageId,
                  storeCopyFieldId: defaultStoreCopyValueModel.storeCopyFieldId,
                  value: defaultStoreCopyValueModel.value,
                  status,
                };
                await RokuStoreCopyValue.create(storeCopyValueDBPayload);
              }
            }
          }
        }

        const currentStatus = await getCurrentModuleStatus(storeCopyModel);
        storeCopyModel.set('status', currentStatus);
        storeCopyModel.set('updated', getCurrentDate());
        await storeCopyModel.save();
      }
    }
  }
};

const isStoreCopyModuleDraft = async (storeCopyModel: RokuStoreCopyModel) => {
  const storeCopyFieldModels: RokuStoreCopyFieldModel[] = await RokuStoreCopyField.findAll({
    where: { storeId: storeCopyModel.storeId },
  });
  let areFieldsRequired = new Set<boolean>();
  for (let storeCopyFieldModel of storeCopyFieldModels) {
    if (storeCopyFieldModel.required) {
      areFieldsRequired.add(true);
    }
  }
  if (areFieldsRequired.size) {
    const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
    const requiredStoreCopyFieldModels = storeCopyFieldModels.filter((model) => model.required);
    for (let requiredStoreCopyFieldModel of requiredStoreCopyFieldModels) {
      const storeCopyValueModels: RokuStoreCopyValueModel[] = await RokuStoreCopyValue.findAll({
        where: { storeCopyFieldId: requiredStoreCopyFieldModel.id },
      });
      if (storeCopyValueModels.length !== languageModels.length) {
        return true;
      }
    }
    return false;
  } else {
    return false;
  }
};

const getFieldStatus = (storeCopyFieldModel: RokuStoreCopyFieldModel, value: any) => {
  if (storeCopyFieldModel.required && !value) {
    return RokuModuleValueStatus.INCOMPLETE;
  } else {
    return RokuModuleValueStatus.SAVED;
  }
};
