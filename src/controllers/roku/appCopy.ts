import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuAppCopy,
  RokuAppCopyField,
  RokuAppCopyValue,
  RokuCampaign,
  RokuCountry,
  RokuCountryLanguage,
  RokuEnvironments,
  RokuLanguage,
  RokuPlatform,
  RokuProduct,
  RokuStore,
} from '../../models';
import { RokuAppCopyFieldModel } from 'src/models/roku/AppCopyField';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuPlatformModel } from 'src/models/roku/Platform';
import { RokuAppCopyModel } from 'src/models/roku/AppCopy';
import { RokuAppCopyValueModel } from 'src/models/roku/AppCopyValue';
import { RokuCountryModel } from 'src/models/roku/Country';
import { RokuLanguageModel } from 'src/models/roku/Language';
import { RokuProductModel } from 'src/models/roku/Product';
import { RokuModuleStatus, RokuModuleValueStatus } from '../../types/enum';
import { getCurrentDate, setModuleEnv } from '.';
import { RokuCountryLanguageModel } from 'src/models/roku/CountryLanguage';
import { requestUrl, checkTardisConnection } from '../../services/Tardis';
import axios from 'axios';
import { setLiveCampaignParameter } from './campaign';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { getAuthToken } from '../../services/GateKeeper';
import { isTokenValid, setModelStatus } from './multiModules';
import { updateSpinnerText, getProperValue, whitespaceSort } from '../../util/utils';
import { RokuEnvironmentsModel } from 'src/models/roku/RokuEnvironments';

const logger = Logger(module);

/**
 * GET /api/roku/app-copy/fields?store&product
 * Get Roku AppCopy fields list by store and platform
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAppCopyFields = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy fields Controller - getAppCopyFields');
    updateSpinnerText('Getting app copy fields...');
    try {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      const storeId: number = storeModel.id;
      let appCopyFieldsArr: RokuAppCopyFieldModel[];

      let platformPath: any = null;
      if (req.query.platform) {
        const platform = req.query.platform as string;
        const platformModel: RokuPlatformModel = await RokuPlatform.findOne({
          where: { path: platform },
        });
        if (!platformModel) {
          throw new AppError('Platform is not found', 404);
        }
        appCopyFieldsArr = await RokuAppCopyField.findAll({
          where: {
            storeId,
            platformId: platformModel.id,
          },
        });
        platformPath = platformModel.path;
      } else {
        appCopyFieldsArr = await RokuAppCopyField.findAll({
          where: { storeId },
        });
      }

      let message = `No Roku AppCopy fields found`;
      if (appCopyFieldsArr) {
        const baseUrl = process.env.ANDROID_PREVIEW_IMAGE_BASE_URL;
        const productPath = req.query.product as string;
        message = `Roku AppCopy fields found`;
        let results: any[] = [];
        results = appCopyFieldsArr.map((field) => {
          let previewImageUrl = null;
          if (field.previewImageGroup && platformPath && productPath) {
            previewImageUrl = `${baseUrl}/appcopy/${productPath}_${platformPath}_${field.previewImageGroup}.png`;
          }
          return {
            fieldName: field.name,
            dataType: field.type,
            translatable: getProperValue(field.translatable, 'boolean'),
            maxLength: field.charLimit,
            required: field.required,
            previewImageUrl,
            order: field.order,
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
    } catch (err) {
      logger.error(`Roku getAppCopyFields failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/app-copy/
 * Get all Roku AppCopy modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - getAllAppCopy');
    updateSpinnerText('Getting all app copy modules...');
    try {
      const appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll();

      let message = `No Roku AppCopy modules found`;
      if (appCopyModels) {
        message = `Roku AppCopy module found`;
        let results: any = [];

        for (let model of appCopyModels) {
          const result = await getAppCopyModuleData(model);
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
      logger.error(`Roku getAllAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/app-copy/:appCopyId
 * Get Roku AppCopy module by appCopyId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - getAppCopy');
    updateSpinnerText('Getting app copy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      let message = `No such Roku AppCopy module found`;
      if (appCopyModel) {
        message = `Roku AppCopy module found`;
        const result = await getAppCopyModuleData(appCopyModel);

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
      logger.error(`Roku getAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

export const getAppCopyModuleData = async (model: RokuAppCopyModel) => {
  const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
    {
      where: { appCopyId: model.id },
    },
  );
  const platformIndexes = new Set<number>();
  appCopyValueModels.forEach((model) => platformIndexes.add(model.platformId));
  const platfromModels: RokuPlatformModel[] = await RokuPlatform.findAll();
  const appCopyFieldsModels: RokuAppCopyFieldModel[] = await RokuAppCopyField.findAll(
    {
      where: { storeId: model.storeId },
    },
  );
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();
  let platforms: any = {};

  platformIndexes.forEach((platformId) => {
    const platformName = platfromModels.find(
      (platform) => platform.id === platformId,
    ).path;
    const platformValueData: RokuAppCopyValueModel[] = appCopyValueModels.filter(
      (elem) => elem.platformId === platformId,
    );

    const countryLanguageIndexes = new Set<number>();
    platformValueData.forEach((platform) =>
      countryLanguageIndexes.add(platform.countryLanguageId),
    );
    let countries: any;
    const countryIndexes = new Set<number>();
    countryLanguageIndexes.forEach((countryLanguageId) => {
      const countryLanguageModel = countryLanguageModels.find(
        (country) => country.id === countryLanguageId,
      );
      if (!!countryLanguageModel && !!countryLanguageModel.countryId) {
        const countryId = countryLanguageModel.countryId;
        countryIndexes.add(countryId);
      }
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
      const countryValueData: RokuAppCopyValueModel[] = platformValueData.filter(
        (elem) => {
          return currentCountryCountryLanguageIndexes.has(
            elem.countryLanguageId,
          );
        },
      );
      let languages: any = {};
      let countryStatusSet = new Set<string>();
      currentCountryCountryLanguageModels.forEach((countryLanguageModel) => {
        const languageCode = languageModels.find(
          (language) => language.id === countryLanguageModel.languageId,
        ).code;
        const languageValueData: RokuAppCopyValueModel[] = countryValueData.filter(
          (elem) => {
            return elem.countryLanguageId === countryLanguageModel.id;
          },
        );
        let fieldsValues: any = {};
        languageValueData.forEach((elem) => {
          const appCopyField: RokuAppCopyFieldModel = appCopyFieldsModels.find(
            (field) => field.id === elem.appCopyFieldId,
          );
          if (appCopyField) {
            fieldsValues = {
              ...fieldsValues,
              [appCopyField.name]: getProperValue(
                elem.value,
                appCopyField.type,
              ),
            };
            countryStatusSet.add(elem.status);
          }
        });
        languages = { ...languages, [languageCode]: fieldsValues };
      });
      countries = {
        ...countries,
        [countryCode]: {
          status: getCountryStatus(countryStatusSet),
          languages,
        },
      };
    });
    platforms = { ...platforms, [platformName]: countries };
  });
  const status = await getCurrentModuleStatus(model);
  return {
    appCopyId: model.id,
    created: model.created,
    updated: model.updated,
    storeId: model.storeId,
    productId: model.productId,
    envId: model.envId,
    promotionId: model.promotionId,
    hasChanges: model.hasChanges,
    name: model.name,
    isDefault: model.isDefault,
    isPublished: model.isPublished,
    isActive: model.isActive,
    status,
    platforms,
    promotedAt: model.promotedAt,
    needToPromote: model.needToPromote,
  };
};

/**
 * POST /api/roku/app-copy/save?store&product
 * Save Roku AppCopy module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - saveAppCopy');
    updateSpinnerText('Saving app copy module...');
    const storeModel: RokuStoreModel = await RokuStore.findOne({
      where: { path: req.query.store },
    });
    const storeId: number = storeModel.id;

    const product = req.query.product as string;
    const productModel: RokuProductModel = await RokuProduct.findOne({
      where: { path: product },
    });
    const productId: number = productModel.id;
    let appCopyId: number;

    if (storeModel && productModel) {
      try {
        // Check if the module is the first in DB
        let isDefault: boolean = false;
        const appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll({
          where: { storeId, productId },
        });
        if (!appCopyModels.length) {
          isDefault = true;
        }
        const devEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
          {
            where: { code: 'dev' },
          },
        );
        const appCopyDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!req.body.createdBy ? req.body.createdBy : null,
          storeId,
          productId,
          envId: devEnvModel.id,
          hasChanges: false,
          name: req.body.name,
          isDefault,
          isPublished: false,
          isActive: false,
          status: RokuModuleStatus.DRAFT,
          needToPromote: false,
        };
        const appCopyResult = await RokuAppCopy.create(appCopyDBPayload);
        appCopyId = appCopyResult.id;
        await createAppCopyValueModelsFromBody(
          appCopyResult,
          req.body.platforms,
        );

        const currentStatus = await getCurrentModuleStatus(appCopyResult);
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          appCopyResult.set('status', currentStatus);
          await appCopyResult.save();
        }

        retWithSuccess(req, res, {
          message: `Roku ${appCopyResult.name} AppCopy module saved in DB successfully`,
          status: 201,
          data: { appCopyId },
        });
      } catch (err) {
        logger.error(`Roku saveAppCopy failed, ${err.message}`, err);

        // deleting incomplete records from DB
        const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne({
          where: {
            id: appCopyId,
          },
        });
        await appCopyModel.destroy({ force: true });

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
 * PUT /api/roku/app-copy/:appCopyId/update
 * Update Roku AppCopy module by appCopyId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - updateAppCopy');
    updateSpinnerText('Updating app copy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      if (appCopyModel) {
        if (req.query.status !== undefined) {
          appCopyModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          if (req.query.isDefault === 'true') {
            const defaultAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne(
              {
                where: {
                  envId: appCopyModel.envId,
                  storeId: appCopyModel.storeId,
                  productId: appCopyModel.productId,
                  isDefault: true,
                },
              },
            );
            if (!!defaultAppCopyModel) {
              defaultAppCopyModel.set('isDefault', false);
              defaultAppCopyModel.set('updated', getCurrentDate());
              await defaultAppCopyModel.save();
            }
          }
          appCopyModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (req.query.platform) {
            const platfromModel: RokuPlatformModel = await RokuPlatform.findOne(
              {
                where: { path: req.query.platform },
              },
            );
            if (req.query.country) {
              const countryModel: RokuCountryModel = await RokuCountry.findOne({
                where: {
                  storeId: appCopyModel.storeId,
                  productId: appCopyModel.productId,
                  code: req.query.country,
                },
              });
              await updateAppCopyValueModels(
                appCopyId,
                req.body,
                platfromModel.id,
                countryModel.id,
              );
            } else {
              await updateAppCopyValueModels(
                appCopyId,
                req.body,
                platfromModel.id,
              );
            }
          } else {
            await updateAppCopyValueModels(appCopyId, req.body.platforms);
            appCopyModel.set('name', req.body.name);
          }
          if (!!appCopyModel.promotedAt) {
            appCopyModel.set('needToPromote', true);
          }
        }

        await recheckDefaultRegions(appCopyModel);

        const currentStatus = await getCurrentModuleStatus(appCopyModel);
        appCopyModel.set('status', currentStatus);
        appCopyModel.set('updated', getCurrentDate());
        await appCopyModel.save();

        retWithSuccess(req, res, {
          message: `Roku ${appCopyModel.name} AppCopy module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: 'No such Roku AppCopy module found',
          status: 200,
          data: null,
        });
      }
    } catch (err) {
      logger.error(`Roku updateAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/roku/app-copy/publish
 * Publish Roku AppCopy modules list
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishAppCopyList = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - publishAppCopyList');
    updateSpinnerText('Publishing app copy modules list...');
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
      const publishModulesIndexesSet = new Set<number>(
        reversedData.map((module: any) => module.appCopyId),
      );
      await unpublishRestModules(
        storeId,
        productId,
        envId,
        publishModulesIndexesSet,
      );

      for (let module of reversedData) {
        const foundAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
          module.appCopyId,
        );
        if (!!foundAppCopyModel) {
          foundAppCopyModel.set('isActive', module.isActive);
          foundAppCopyModel.set('updated', getCurrentDate());
          await foundAppCopyModel.save();
          await publishAppCopyModule(foundAppCopyModel, envId);
        }
      }
      // deploy live AppCopy modules list to Tardis service
      const deployData = await deployTardisAppCopyList(
        storeId,
        productId,
        publishModulesIndexesSet,
        envId,
        tardisToken,
      );
      retWithSuccess(req, res, {
        message: `Roku AppCopy modules list published successfully`,
        status: 201,
        data: deployData,
      });
    } catch (err) {
      logger.error(`Roku pusblishAppCopy failed, ${err.message}`, err);
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
  let restLiveModels: RokuAppCopyModel[] = await RokuAppCopy.findAll({
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
    // unpublish all AppCopyValue models of published module
    const restLiveValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
      {
        where: { appCopyId: restLiveModel.id },
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

export const publishAppCopyModule = async (
  appCopyModel: RokuAppCopyModel,
  envId: number,
) => {
  const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
    {
      where: { appCopyId: appCopyModel.id },
    },
  );
  await publishAppCopyValueModels(appCopyValueModels);
  appCopyModel.set('isPublished', true);
  appCopyModel.set('status', RokuModuleValueStatus.PUBLISHED);
  appCopyModel.set('updated', getCurrentDate());
  await appCopyModel.save();
  const envModel: RokuEnvironmentsModel = await RokuEnvironments.findByPk(
    envId,
  );
  await setLiveCampaignParameter(
    appCopyModel.storeId,
    appCopyModel.productId,
    'app-copy',
    envModel.code,
    appCopyModel.id,
  );
};

const deployTardisAppCopyList = async (
  storeId: number,
  productId: number,
  appCopyIndexesSet: Set<number>,
  envId: number,
  tardisToken: string,
) => {
  let data: any = {};
  const storeModel: RokuStoreModel = await RokuStore.findByPk(storeId);
  const productModel: RokuProductModel = await RokuProduct.findByPk(productId);
  const envModel: RokuEnvironmentsModel = await RokuEnvironments.findByPk(
    envId,
  );
  data = await deployAppCopyData(
    storeModel,
    productModel,
    envModel,
    appCopyIndexesSet,
    tardisToken,
  );
  return data;
};

/**
 * POST /api/roku/app-copy/:appCopyId/duplicate
 * Duplicate Roku AppCopy module by appCopyId
 * @param {Request}     req
 * @param {Response}    res
 */
export const duplicateAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - duplicateAppCopy');
    updateSpinnerText('Duplicating app copy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      if (appCopyModel) {
        const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
          {
            where: { appCopyId },
          },
        );
        if (appCopyValueModels.length) {
          let appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll();
          let appCopyNamesSet = new Set<string>(
            appCopyModels.length
              ? appCopyModels.map((model) => model.name)
              : [],
          );
          let duplicateAppCopyId: number = null;
          const name: string = getDuplicateName(
            appCopyModel.name,
            appCopyNamesSet,
          );
          const duplicateAppCopyDBPayload = {
            created: getCurrentDate(),
            updated: getCurrentDate(),
            createdBy: !!appCopyModel.createdBy ? appCopyModel.createdBy : null,
            storeId: appCopyModel.storeId,
            productId: appCopyModel.productId,
            name,
            isDefault: false,
            status: RokuModuleStatus.DRAFT,
            needToPromote: false,
          };
          const duplicateAppCopyResult = await RokuAppCopy.create(
            duplicateAppCopyDBPayload,
          );
          duplicateAppCopyId = duplicateAppCopyResult.id;
          await createAppCopyValueModels(
            appCopyValueModels,
            duplicateAppCopyResult,
          );

          const currentStatus = await getCurrentModuleStatus(
            duplicateAppCopyResult,
          );
          if (currentStatus !== RokuModuleStatus.DRAFT) {
            duplicateAppCopyResult.set('status', currentStatus);
            await duplicateAppCopyResult.save();
          }

          const duplicatedAppCopy = await getAppCopyModuleData(
            duplicateAppCopyResult,
          );

          retWithSuccess(req, res, {
            message: `Roku ${appCopyModel.name} AppCopy module duplicated in DB successfully`,
            status: 201,
            data: { ...duplicatedAppCopy },
          });
        } else {
          throw new AppError('AppCopyValue modules in DB not found', 404);
        }
      } else {
        throw new AppError('AppCopy module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Roku duplicateAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/roku/app-copy/:appCopyId/promote
 * Promote Roku AppCopy module by appCopyId
 * @param {Request}     req
 * @param {Response}    res
 */
export const promoteAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - promoteAppCopy');
    updateSpinnerText('Promoting appCopy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      if (!appCopyModel) {
        throw new AppError('AppCopy module in DB not found', 404);
      }

      appCopyModel.set('updated', getCurrentDate());
      appCopyModel.set('promotedAt', getCurrentDate());
      appCopyModel.set('needToPromote', false);
      await appCopyModel.save();

      const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
        {
          where: { appCopyId },
        },
      );

      if (!appCopyValueModels || !appCopyValueModels.length) {
        throw new AppError('AppCopyValue modules in DB not found', 404);
      }

      let promotedAppCopy: any = null;
      const foundPromotedAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne(
        {
          where: { promotionId: appCopyId },
        },
      );
      let message = '';
      const foundStagedAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne(
        {
          where: { stagedId: appCopyId },
        },
      );
      if (!!foundPromotedAppCopyModel) {
        const isPromotedAppCopySameAsOriginalRes = await isPromotedAppCopySameAsOriginal(
          appCopyModel,
          foundPromotedAppCopyModel,
        );
        message = `Roku "${foundPromotedAppCopyModel.name}" AppCopy module promoted without changes`;
        if (!!foundStagedAppCopyModel) {
          updateRokuAppCopy(appCopyModel, foundStagedAppCopyModel);
          updateRokuAppCopyValues(appCopyModel.id, foundStagedAppCopyModel.id);
          promotedAppCopy = await getAppCopyModuleData(
            foundPromotedAppCopyModel,
          );
        } else {
          const stageEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
            {
              where: { code: 'stg' },
            },
          );
          const promoteAppCopyDBPayload = {
            created: getCurrentDate(),
            updated: getCurrentDate(),
            createdBy: !!appCopyModel.createdBy ? appCopyModel.createdBy : null,
            storeId: appCopyModel.storeId,
            productId: appCopyModel.productId,
            envId: stageEnvModel.id,
            stagedId: appCopyModel.id,
            hasChanges: false,
            name: appCopyModel.name,
            isPublished: false,
            isDefault: appCopyModel.isDefault,
            isActive: false,
            status: RokuModuleStatus.DRAFT,
            needToPromote: false,
          };
          const promoteAppCopyResult = await RokuAppCopy.create(
            promoteAppCopyDBPayload,
          );
          createAppCopyValueModels(appCopyValueModels, promoteAppCopyResult);
          const currentStatus = await getCurrentModuleStatus(
            promoteAppCopyResult,
          );
          if (currentStatus !== RokuModuleStatus.DRAFT) {
            promoteAppCopyResult.set('status', currentStatus);
            await promoteAppCopyResult.save();
          }
          promotedAppCopy = await getAppCopyModuleData(promoteAppCopyResult);
        }
        if (!isPromotedAppCopySameAsOriginalRes) {
          foundPromotedAppCopyModel.set('hasChanges', true);
          foundPromotedAppCopyModel.set('updated', getCurrentDate());
          await foundPromotedAppCopyModel.save();
          promotedAppCopy = await getAppCopyModuleData(
            foundPromotedAppCopyModel,
          );
          message = `Roku "${promotedAppCopy.name}" AppCopy module promoted in DB successfully`;
        }
      } else {
        const prodEnvModel: RokuEnvironmentsModel = await RokuEnvironments.findOne(
          {
            where: { code: 'prod' },
          },
        );
        const promoteAppCopyDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!appCopyModel.createdBy ? appCopyModel.createdBy : null,
          storeId: appCopyModel.storeId,
          productId: appCopyModel.productId,
          envId: prodEnvModel.id,
          promotionId: appCopyModel.id,
          hasChanges: false,
          name: appCopyModel.name,
          isPublished: false,
          isDefault: appCopyModel.isDefault,
          isActive: false,
          status: RokuModuleStatus.DRAFT,
          needToPromote: false,
        };
        const promoteAppCopyResult = await RokuAppCopy.create(
          promoteAppCopyDBPayload,
        );
        createAppCopyValueModels(appCopyValueModels, promoteAppCopyResult);
        const currentStatus = await getCurrentModuleStatus(
          promoteAppCopyResult,
        );
        if (currentStatus !== RokuModuleStatus.DRAFT) {
          promoteAppCopyResult.set('status', currentStatus);
          await promoteAppCopyResult.save();
        }
        promotedAppCopy = await getAppCopyModuleData(promoteAppCopyResult);
        message = `Roku "${promotedAppCopy.name}" AppCopy module promoted in DB successfully`;
      }

      retWithSuccess(req, res, {
        message,
        status: 201,
        data: !!promotedAppCopy ? { ...promotedAppCopy } : null,
      });
    } catch (err) {
      logger.error(`Roku promoteAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

const updateRokuAppCopyValues = async (
  sourceAppCopyId: number,
  destinationAppCopyId: number,
) => {
  const sourceAppCopyValues = await RokuAppCopyValue.findAll({
    where: { appCopyId: sourceAppCopyId },
  });
  const destinationAppCopyValues = await RokuAppCopyValue.findAll({
    where: { appCopyId: destinationAppCopyId },
  });

  const destinationAppCopyModel = await RokuAppCopy.findByPk(
    destinationAppCopyId,
  );

  if (!!sourceAppCopyValues) {
    for (const sourceAppCopyValueModel of sourceAppCopyValues) {
      const foundDestinationAppCopyValueModel = destinationAppCopyValues.find(
        (destinationSkuValueModel) =>
          sourceAppCopyValueModel.appCopyFieldId ===
            destinationSkuValueModel.appCopyFieldId &&
          sourceAppCopyValueModel.countryLanguageId ===
            destinationSkuValueModel.countryLanguageId,
      );
      if (!!foundDestinationAppCopyValueModel) {
        const foundAppCopyFieldModel: RokuAppCopyFieldModel = await RokuAppCopyField.findByPk(
          foundDestinationAppCopyValueModel.appCopyFieldId,
        );
        foundDestinationAppCopyValueModel.set(
          'value',
          getProperValue(
            sourceAppCopyValueModel.value,
            foundAppCopyFieldModel.type,
            true,
          ),
        );
        foundDestinationAppCopyValueModel.set(
          'status',
          sourceAppCopyValueModel.status,
        );
        foundDestinationAppCopyValueModel.set('updated', getCurrentDate());
        await foundDestinationAppCopyValueModel.save();
      } else {
        const appCopyValueDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!destinationAppCopyModel.createdBy
            ? destinationAppCopyModel.createdBy
            : null,
          appCopyId: destinationAppCopyModel
            ? destinationAppCopyModel.id
            : sourceAppCopyValueModel.appCopyId,
          platformId: sourceAppCopyValueModel.platformId,
          countryLanguageId: sourceAppCopyValueModel.countryLanguageId,
          appCopyFieldId: sourceAppCopyValueModel.appCopyFieldId,
          value: sourceAppCopyValueModel.value,
          status: destinationAppCopyModel
            ? sourceAppCopyValueModel.status === RokuModuleValueStatus.ENDED ||
              sourceAppCopyValueModel.status ===
                RokuModuleValueStatus.PUBLISHED ||
              sourceAppCopyValueModel.status === RokuModuleValueStatus.SAVED
              ? RokuModuleValueStatus.SAVED
              : RokuModuleValueStatus.INCOMPLETE
            : sourceAppCopyValueModel.status,
        };
        await RokuAppCopyValue.create(appCopyValueDBPayload);
      }
    }
  } else {
    throw new AppError(
      'Unable to update app copy, source app copy values not found.',
      404,
    );
  }
};

const updateRokuAppCopy = async (
  oldAppCopy: RokuAppCopyModel,
  newAppCopy: RokuAppCopyModel,
) => {
  newAppCopy.set('updated', getCurrentDate());
  newAppCopy.set('name', oldAppCopy.name);
  newAppCopy.set('productId', oldAppCopy.productId);
  newAppCopy.set('storeId', oldAppCopy.storeId);
  newAppCopy.set('isDefault', oldAppCopy.isDefault);
  const currentStatus = await getCurrentModuleStatus(oldAppCopy);
  newAppCopy.set('status', currentStatus);
  newAppCopy.save();
};

/**
 * POST /api/roku/appCopy/:appCopyId/pull?acceptChanges
 * Pull Roku promotion AppCopy module by appCopyId to it's promotion module
 * @param {Request}     req
 * @param {Response}    res
 */
export const pullPromotionAppCopy = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - promoteAppCopy');
    updateSpinnerText('Promoting appCopy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const promotedAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );
      const acceptChanges: boolean = req.query.acceptChanges === 'true';

      if (!promotedAppCopyModel) {
        throw new AppError('AppCopy module in DB not found', 404);
      }

      const promotedAppCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
        {
          where: { appCopyId },
        },
      );

      if (!promotedAppCopyValueModels || !promotedAppCopyValueModels.length) {
        throw new AppError(
          'Promoted AppCopyValue modules in DB not found',
          404,
        );
      }
      const foundStagedAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findOne(
        {
          where: { stagedId: promotedAppCopyModel.promotionId },
        },
      );

      if (!foundStagedAppCopyModel) {
        throw new AppError('Staged AppCopy module in DB not found', 404);
      }

      let message = `"${promotedAppCopyModel.name}" APPCOPY changes from the Client Dev environment have been discarded`;
      if (!!acceptChanges) {
        message = `"${promotedAppCopyModel.name}" APPCOPY changes from the Client Dev environment have been accepted`;
        const foundStagedAppCopyValueModels = await RokuAppCopyValue.findAll({
          where: { appCopyId: foundStagedAppCopyModel.id },
        });
        for (let foundStagedAppCopyValueModel of foundStagedAppCopyValueModels) {
          const foundPromotedAppCopyValueModel = promotedAppCopyValueModels.find(
            (promotedAppCopyValueModel) =>
              foundStagedAppCopyValueModel.appCopyFieldId ===
                promotedAppCopyValueModel.appCopyFieldId &&
              foundStagedAppCopyValueModel.countryLanguageId ===
                promotedAppCopyValueModel.countryLanguageId,
          );
          if (!!foundPromotedAppCopyValueModel) {
            const foundAppCopyFieldModel: RokuAppCopyFieldModel = await RokuAppCopyField.findByPk(
              foundPromotedAppCopyValueModel.appCopyFieldId,
            );
            foundPromotedAppCopyValueModel.set(
              'value',
              getProperValue(
                foundStagedAppCopyValueModel.value,
                foundAppCopyFieldModel.type,
                true,
              ),
            );
            foundPromotedAppCopyValueModel.set(
              'status',
              foundStagedAppCopyValueModel.status,
            );
            foundPromotedAppCopyValueModel.set('updated', getCurrentDate());
            await foundPromotedAppCopyValueModel.save();
          } else {
            createAppCopyValueModels(
              [foundStagedAppCopyValueModel],
              promotedAppCopyModel,
            );
          }
        }
        promotedAppCopyModel.set('name', foundStagedAppCopyModel.name);
        const currentStatus = await getCurrentModuleStatus(
          foundStagedAppCopyModel,
        );
        promotedAppCopyModel.set('status', currentStatus);
      }
      promotedAppCopyModel.set('hasChanges', false);
      promotedAppCopyModel.set('updated', getCurrentDate());
      await promotedAppCopyModel.save();

      retWithSuccess(req, res, {
        message,
        status: 201,
        data: getAppCopyModuleData(promotedAppCopyModel),
      });
    } catch (err) {
      logger.error(`Roku promoteAppCopy failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/app-copy/:appCopyId/usage
 * Get Roku AppCopy module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAppCopyUsage = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - getAppCopyUsage');
    updateSpinnerText('Getting app copy module usage...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      if (appCopyModel) {
        const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll({
          where: { appCopyId },
        });

        let data: any[] = null;
        if (campaignModels.length) {
          data = [];
          campaignModels.forEach((model) => {
            data.push(model.name);
          });
        }

        retWithSuccess(req, res, {
          message: `Roku ${appCopyModel.name} AppCopy module usage data found`,
          status: 201,
          data,
        });
      } else {
        throw new AppError('AppCopy module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Roku getAppCopyUsage failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/app-copy/:appCopyId/duplicate-data
 * Get Roku AppCopy module duplicate data by appCopyId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getDuplicateAppCopyData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku AppCopy module Controller - getDuplicateAppCopyData');
    updateSpinnerText('Getting duplicate app copy module...');
    try {
      const appCopyId: number = Number(req.params.appCopyId);
      const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
        appCopyId,
      );

      if (appCopyModel) {
        const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
          {
            where: { appCopyId },
          },
        );
        if (appCopyValueModels.length) {
          let appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll();
          let appCopyNamesSet = new Set<string>(
            appCopyModels.length
              ? appCopyModels.map((model) => model.name)
              : [],
          );
          const name: string = getDuplicateName(
            appCopyModel.name,
            appCopyNamesSet,
          );

          retWithSuccess(req, res, {
            message: `Roku ${appCopyModel.name} AppCopy module duplicated in DB successfully`,
            status: 201,
            data: { appCopyId: 0, name, status: appCopyModel.status },
          });
        } else {
          throw new AppError('AppCopyValue modules in DB not found', 404);
        }
      } else {
        throw new AppError('AppCopy module in DB not found', 404);
      }
    } catch (err) {
      logger.error(`Roku getDuplicateAppCopyData failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

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

export const createAppCopyValueModelsFromBody = async (
  appCopyModel: RokuAppCopyModel,
  body: any,
) => {
  const appCopyValueArray = await getBodyAppCopyValueArray(appCopyModel, body);
  await createAppCopyValueModels(appCopyValueArray, appCopyModel);
};

export const createAppCopyValueModels = async (
  arr: any,
  appCopyModel?: RokuAppCopyModel,
) => {
  arr.sort(whitespaceSort);
  for (const elem of arr) {
    const appCopyValueDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!appCopyModel.createdBy ? appCopyModel.createdBy : null,
      appCopyId: appCopyModel ? appCopyModel.id : elem.appCopyId,
      platformId: elem.platformId,
      countryLanguageId: elem.countryLanguageId,
      appCopyFieldId: elem.appCopyFieldId,
      value: elem.value,
      status: appCopyModel
        ? elem.status === RokuModuleValueStatus.ENDED ||
          elem.status === RokuModuleValueStatus.PUBLISHED ||
          elem.status === RokuModuleValueStatus.SAVED
          ? RokuModuleValueStatus.SAVED
          : RokuModuleValueStatus.INCOMPLETE
        : elem.status,
    };
    await RokuAppCopyValue.create(appCopyValueDBPayload);
  }
};

export const publishAppCopyValueModels = async (
  appCopyValueModels: RokuAppCopyValueModel[],
) => {
  for (const model of appCopyValueModels) {
    model.set('status', RokuModuleValueStatus.PUBLISHED);
    model.set('updated', getCurrentDate());
    await model.save();
  }
};

export const updateAppCopyValueModels = async (
  appCopyId: number,
  body: any,
  platformId?: number,
  countryId?: number,
) => {
  let appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
    {
      where: { appCopyId },
    },
  );
  const appCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(appCopyId);
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();

  if (!!platformId) {
    appCopyValueModels = appCopyValueModels.filter((model) => {
      return model.platformId === platformId;
    });
    if (!!countryId) {
      const countryLanguageIndexes = new Set<number>();
      countryLanguageModels.forEach((model) => {
        if (model.countryId === countryId) {
          countryLanguageIndexes.add(model.id);
        }
      });
      appCopyValueModels = appCopyValueModels.filter((model) =>
        countryLanguageIndexes.has(model.countryLanguageId),
      );
    }
  }

  const appCopyValueModelsSet = new Set<number>();
  appCopyValueModels.forEach((elem) => {
    appCopyValueModelsSet.add(elem.id);
  });

  const appCopyValueArrFromBody: any[] = await getBodyAppCopyValueArray(
    appCopyModel,
    body,
    platformId !== null ? platformId : null,
    countryId !== null ? countryId : null,
  );

  if (appCopyValueArrFromBody.length) {
    appCopyValueArrFromBody.sort(whitespaceSort);
    for (const fieldElem of appCopyValueArrFromBody) {
      const foundAppCopyValueModel = appCopyValueModels.find((elem) => {
        return (
          elem.platformId === fieldElem.platformId &&
          elem.countryLanguageId === fieldElem.countryLanguageId &&
          elem.appCopyFieldId === fieldElem.appCopyFieldId
        );
      });

      if (foundAppCopyValueModel) {
        if (
          foundAppCopyValueModel.value !== fieldElem.value ||
          foundAppCopyValueModel.status !== fieldElem.status
        ) {
          foundAppCopyValueModel.set('value', fieldElem.value);
          foundAppCopyValueModel.set('status', fieldElem.status);
          foundAppCopyValueModel.set('updated', getCurrentDate());
          await foundAppCopyValueModel.save();
        }
        appCopyValueModelsSet.delete(foundAppCopyValueModel.id);
      } else {
        const appCopyValueDBPayload = {
          created: getCurrentDate(),
          updated: getCurrentDate(),
          createdBy: !!appCopyModel.createdBy ? appCopyModel.createdBy : null,
          appCopyId: fieldElem.appCopyId,
          platformId: fieldElem.platformId,
          countryLanguageId: fieldElem.countryLanguageId,
          appCopyFieldId: fieldElem.appCopyFieldId,
          value: fieldElem.value,
          status: fieldElem.status,
        };
        await RokuAppCopyValue.create(appCopyValueDBPayload);
      }
    }
  }

  // destroy unsent from body language fields-value
  if (appCopyValueModelsSet.size !== 0) {
    for (const appCopyValueModelsSetElem of appCopyValueModelsSet) {
      const foundAppCopyValueModel: RokuAppCopyValueModel = await RokuAppCopyValue.findByPk(
        appCopyValueModelsSetElem,
      );
      await foundAppCopyValueModel.destroy({ force: true });
    }
  }
};

export const recheckDefaultRegions = async (
  defaultAppCopyModel: RokuAppCopyModel,
) => {
  if (defaultAppCopyModel && defaultAppCopyModel.isDefault) {
    const appCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll({
      where: {
        envId: defaultAppCopyModel.envId,
        storeId: defaultAppCopyModel.storeId,
        productId: defaultAppCopyModel.productId,
      },
    });
    let appCopyIndexes = new Set<number>();
    appCopyModels.forEach((model) => appCopyIndexes.add(model.id));
    appCopyIndexes.delete(defaultAppCopyModel.id);

    const platformModels: RokuPlatformModel[] = await RokuPlatform.findAll({});
    for (let appCopyId of appCopyIndexes) {
      let platformIndexes = new Set<number>();
      platformModels.forEach((model) => platformIndexes.add(model.id));

      for (let platformId of platformIndexes) {
        const defaultAppCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
          {
            where: { appCopyId: defaultAppCopyModel.id, platformId },
          },
        );
        let defaultCountryLanguageIndexes = new Set<number>();
        defaultAppCopyValueModels.forEach((model) =>
          defaultCountryLanguageIndexes.add(model.countryLanguageId),
        );

        const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
          {
            where: { appCopyId, platformId },
          },
        );
        let countryLanguageIndexes = new Set<number>();
        appCopyValueModels.forEach((model) =>
          countryLanguageIndexes.add(model.countryLanguageId),
        );

        for (let countryLanguageId of defaultCountryLanguageIndexes) {
          if (!countryLanguageIndexes.has(countryLanguageId)) {
            const currentCountryLanguageIdDefaultAppCopyValueModels = defaultAppCopyValueModels.filter(
              (model) => {
                return (
                  model.platformId === platformId &&
                  model.countryLanguageId === countryLanguageId
                );
              },
            );

            if (currentCountryLanguageIdDefaultAppCopyValueModels) {
              for (let defaultAppCopyValueModel of currentCountryLanguageIdDefaultAppCopyValueModels) {
                const status =
                  defaultAppCopyValueModel.status ===
                  RokuModuleValueStatus.INCOMPLETE
                    ? RokuModuleValueStatus.INCOMPLETE
                    : RokuModuleValueStatus.SAVED;
                const foundAppCopyFieldModel: RokuAppCopyFieldModel = await RokuAppCopyField.findByPk(
                  defaultAppCopyValueModel.appCopyFieldId,
                );
                const appCopyValueDBPayload = {
                  created: getCurrentDate(),
                  updated: getCurrentDate(),
                  createdBy: !!defaultAppCopyModel.createdBy
                    ? defaultAppCopyModel.createdBy
                    : null,
                  appCopyId,
                  platformId,
                  countryLanguageId,
                  appCopyFieldId: defaultAppCopyValueModel.appCopyFieldId,
                  value: getProperValue(
                    defaultAppCopyValueModel.value,
                    foundAppCopyFieldModel.type,
                    true,
                  ),
                  status,
                };
                await RokuAppCopyValue.create(appCopyValueDBPayload);
              }
            }
          }
        }
      }
    }

    for (let appCopyModel of appCopyModels) {
      if (!appCopyModel.isDefault) {
        const currentStatus = await getCurrentModuleStatus(appCopyModel);
        appCopyModel.set('status', currentStatus);
        appCopyModel.set('updated', getCurrentDate());
        await appCopyModel.save();
      }
    }
  }
};

export const getBodyAppCopyValueArray = async (
  appCopyModel: RokuAppCopyModel,
  body: any,
  receivedPlatfromId?: number,
  receivedCountryId?: number,
) => {
  const platfromModels: RokuPlatformModel[] = await RokuPlatform.findAll();
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();
  const languageModels: RokuLanguageModel[] = await RokuLanguage.findAll();

  const appCopyId = appCopyModel.id;
  const storeId = appCopyModel.storeId;
  const productId = appCopyModel.productId;
  let result: any[] = [];
  let platformId: number = null;
  let countryId: number = null;

  const appCopyFieldsModels: RokuAppCopyFieldModel[] = await RokuAppCopyField.findAll(
    { where: { storeId } },
  );

  if (!!receivedPlatfromId) {
    platformId = receivedPlatfromId;
    if (!!receivedCountryId) {
      countryId = receivedCountryId;
      result = getAppCopyValueArrayFromCountryBody(
        body,
        appCopyId,
        storeId,
        productId,
        platformId,
        countryId,
        languageModels,
        countryLanguageModels,
        appCopyFieldsModels,
      );
    } else {
      result = getAppCopyValueArrayFromPlatformBody(
        body,
        appCopyId,
        storeId,
        productId,
        platformId,
        languageModels,
        countryLanguageModels,
        appCopyFieldsModels,
        countryModels,
        countryId !== null ? countryId : null,
      );
    }
  } else {
    result = getAppCopyValueArrayFromModuleBody(
      body,
      appCopyId,
      storeId,
      productId,
      languageModels,
      countryLanguageModels,
      appCopyFieldsModels,
      platfromModels,
      countryModels,
      platformId !== null ? platformId : null,
      countryId !== null ? countryId : null,
    );
  }
  return result;
};

export const getAppCopyValueArrayFromModuleBody = (
  body: any,
  appCopyId: number,
  storeId: number,
  productId: number,
  languageModels: RokuLanguageModel[],
  countryLanguageModels: RokuCountryLanguageModel[],
  appCopyFieldsModels: RokuAppCopyFieldModel[],
  platfromModels: RokuPlatformModel[],
  countryModels: RokuCountryModel[],
  platformId?: number,
  countryId?: number,
): any[] => {
  let result: any[] = [];
  const bodyPlatformsKeys = Object.keys(body);
  const bodyPlatformsValues = Object.values(body);
  if (bodyPlatformsKeys.length) {
    bodyPlatformsValues.forEach((bodyPlatform, i) => {
      result = [
        ...result,
        ...getAppCopyValueArrayFromPlatformBody(
          bodyPlatform,
          appCopyId,
          storeId,
          productId,
          platformId !== null
            ? platformId
            : platfromModels.find((elem) => elem.path === bodyPlatformsKeys[i])
                .id,
          languageModels,
          countryLanguageModels,
          appCopyFieldsModels,
          countryModels,
          countryId !== null ? countryId : null,
        ),
      ];
    });
  }
  return result;
};

export const getAppCopyValueArrayFromPlatformBody = (
  bodyPlatform: any,
  appCopyId: number,
  storeId: number,
  productId: number,
  platformId: number,
  languageModels: RokuLanguageModel[],
  countryLanguageModels: RokuCountryLanguageModel[],
  appCopyFieldsModels: RokuAppCopyFieldModel[],
  countryModels: RokuCountryModel[],
  countryId?: number,
): any[] => {
  let result: any = [];
  const bodyCountryKeys = Object.keys(bodyPlatform);
  const bodyCountryValues = Object.values(bodyPlatform);
  bodyCountryValues.forEach((bodyCountry, j) => {
    result = [
      ...result,
      ...getAppCopyValueArrayFromCountryBody(
        bodyCountry,
        appCopyId,
        storeId,
        productId,
        platformId,
        countryId !== null
          ? countryId
          : countryModels.find((elem) => {
              return (
                elem.code === bodyCountryKeys[j] &&
                elem.storeId === storeId &&
                elem.productId === productId
              );
            }).id,
        languageModels,
        countryLanguageModels,
        appCopyFieldsModels,
      ),
    ];
  });
  return result;
};

export const getAppCopyValueArrayFromCountryBody = (
  bodyCountry: any,
  appCopyId: number,
  storeId: number,
  productId: number,
  platformId: number,
  countryId: number,
  languageModels: RokuLanguageModel[],
  countryLanguageModels: RokuCountryLanguageModel[],
  appCopyFieldsModels: RokuAppCopyFieldModel[],
): any[] => {
  appCopyFieldsModels = appCopyFieldsModels.filter(
    (model) => model.platformId === platformId,
  );
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
      const foundNonTranslatableField = appCopyFieldsModels.find(
        (appCopyFieldsModel) => {
          return (
            appCopyFieldsModel.storeId === storeId &&
            appCopyFieldsModel.platformId === platformId &&
            appCopyFieldsModel.name === bodyCountryNonTranslatableKeys[m] &&
            !appCopyFieldsModel.translatable
          );
        },
      );
      allCurrentCountryLanguages.forEach((countryLanguageModel) => {
        resultArr.push({
          appCopyId,
          storeId,
          productId,
          platformId,
          countryLanguageId: countryLanguageModel.id,
          appCopyFieldId: foundNonTranslatableField.id,
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
    const languageId = languageModels.find(
      (elem) => elem.code === bodyLanguageKeys[k],
    ).id;
    const countryLanguageId = countryLanguageModels.find(
      (model) =>
        model.countryId === countryId && model.languageId === languageId,
    ).id;
    bodyFieldValues.forEach((bodyField, x) => {
      const foundAppCopyFieldModel = appCopyFieldsModels.find((elem) => {
        return (
          elem.name === bodyFieldKeys[x] &&
          elem.storeId === storeId &&
          elem.platformId === platformId
        );
      });
      resultArr.push({
        appCopyId,
        storeId,
        productId,
        platformId,
        countryLanguageId,
        appCopyFieldId: foundAppCopyFieldModel.id,
        value: getProperValue(bodyField, foundAppCopyFieldModel.type, true),
        status,
      });
    });
  });
  return resultArr;
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

export const getCurrentModuleStatus = async (
  appCopyModel: RokuAppCopyModel,
) => {
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll({
    where: { storeId: appCopyModel.storeId, productId: appCopyModel.productId },
  });
  let countryLanguageIndexes = new Set<number>();
  for (let countryModel of countryModels) {
    const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll(
      {
        where: { countryId: countryModel.id },
      },
    );
    if (countryLanguageModels.length) {
      for (let countryLanguageModel of countryLanguageModels) {
        countryLanguageIndexes.add(countryLanguageModel.id);
      }
    }
  }

  //check AppCopy models
  let areRequiredFieldsFilled = new Set<boolean>();
  let statusSet = new Set<string>();
  let appCopyValueCountryLanguageIndexes = new Set<number>();

  const platformModels: RokuPlatformModel[] = await RokuPlatform.findAll();
  const platformIndexesSet = new Set<number>(
    platformModels.map((model) => model.id),
  );
  for (let platformId of platformIndexesSet) {
    let requiredAppCopyFieldIndexesSet = new Set<number>();

    const appCopyFieldModels: RokuAppCopyFieldModel[] = await RokuAppCopyField.findAll(
      {
        where: { storeId: appCopyModel.storeId, platformId, required: true },
      },
    );
    if (appCopyFieldModels.length) {
      appCopyFieldModels.forEach((model) =>
        requiredAppCopyFieldIndexesSet.add(model.id),
      );
      requiredAppCopyFieldIndexesSet = new Set<number>(
        appCopyFieldModels.map((model) => model.id),
      );
    }

    const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
      {
        where: { appCopyId: appCopyModel.id, platformId },
      },
    );
    if (appCopyValueModels.length) {
      appCopyValueModels.forEach((model) => {
        statusSet.add(model.status);
        appCopyValueCountryLanguageIndexes.add(model.countryLanguageId);
      });

      for (let countryLanguageId of countryLanguageIndexes) {
        const languageAppCopyValueModels = appCopyValueModels.filter(
          (model) => model.countryLanguageId === countryLanguageId,
        );
        let isLanguageFilled: boolean[] = [];
        requiredAppCopyFieldIndexesSet.forEach((appCopyFieldId) => {
          const foundModel = languageAppCopyValueModels.find(
            (model) => model.appCopyFieldId === appCopyFieldId,
          );
          if (foundModel && !!foundModel.value) {
            isLanguageFilled.push(true);
          } else {
            isLanguageFilled.push(false);
          }
        });
        const isLanguageFilledSet = new Set<boolean>(isLanguageFilled);
        if (
          isLanguageFilled.length !== requiredAppCopyFieldIndexesSet.size ||
          isLanguageFilledSet.has(false)
        ) {
          areRequiredFieldsFilled.add(false);
        }
      }
    } else {
      return RokuModuleStatus.DRAFT;
    }
  }

  // result
  if (!statusSet.size) {
    await setModelStatus(appCopyModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  } else if (statusSet.has(RokuModuleValueStatus.ENDED)) {
    await setModelStatus(appCopyModel, RokuModuleStatus.ENDED);
    return RokuModuleStatus.ENDED;
  } else if (statusSet.has(RokuModuleValueStatus.PUBLISHED)) {
    await setModelStatus(appCopyModel, RokuModuleStatus.LIVE);
    return RokuModuleStatus.LIVE;
  } else if (
    (!statusSet.has(RokuModuleValueStatus.PUBLISHED) &&
      statusSet.has(RokuModuleValueStatus.INCOMPLETE)) ||
    areRequiredFieldsFilled.has(false) ||
    countryLanguageIndexes.size !== appCopyValueCountryLanguageIndexes.size
  ) {
    await setModelStatus(appCopyModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  } else if (
    !statusSet.has(RokuModuleValueStatus.PUBLISHED) &&
    statusSet.has(RokuModuleValueStatus.SAVED) &&
    !areRequiredFieldsFilled.has(false) &&
    countryLanguageIndexes.size === appCopyValueCountryLanguageIndexes.size
  ) {
    await setModelStatus(appCopyModel, RokuModuleStatus.READY);
    return RokuModuleStatus.READY;
  }
};

// ===================================================================================================================

export const deployAppCopyData = async (
  storeModel: RokuStoreModel,
  productModel: RokuProductModel,
  envModel: RokuEnvironmentsModel,
  appCopyIndexesSet: Set<number>,
  tardisToken: string,
) => {
  let results: any = {};

  let appCopyModels: RokuAppCopyModel[] = [];
  let appCopyValueModels: RokuAppCopyValueModel[] = [];
  // find AppCopy models and their value models
  for (let appCopyIndex of appCopyIndexesSet) {
    const foundAppCopyModel: RokuAppCopyModel = await RokuAppCopy.findByPk(
      appCopyIndex,
    );
    if (!!foundAppCopyModel && foundAppCopyModel.envId === envModel.id) {
      const foundAppCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
        {
          where: { appCopyId: appCopyIndex },
        },
      );
      if (!!foundAppCopyValueModels.length) {
        appCopyModels.push(foundAppCopyModel);
        appCopyValueModels = [
          ...appCopyValueModels,
          ...foundAppCopyValueModels,
        ];
      }
    }
  }

  // set appCopyValue models data
  const platformIndexes = new Set<number>();
  appCopyValueModels.forEach((model) => platformIndexes.add(model.platformId));
  const platfromModels: RokuPlatformModel[] = await RokuPlatform.findAll();
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll();
  const countryLanguageModels: RokuCountryLanguageModel[] = await RokuCountryLanguage.findAll();

  for (let platformId of platformIndexes) {
    const platformPath = platfromModels.find(
      (platform) => platform.id === platformId,
    ).path;
    const platformValueData: RokuAppCopyValueModel[] = appCopyValueModels.filter(
      (elem) => elem.platformId === platformId,
    );

    const countryLanguageIndexes = new Set<number>();
    platformValueData.forEach((platform) =>
      countryLanguageIndexes.add(platform.countryLanguageId),
    );
    const countryIndexes = new Set<number>();
    countryLanguageIndexes.forEach((countryLanguageId) => {
      const countryLanguageModel = countryLanguageModels.find(
        (country) => country.id === countryLanguageId,
      );
      if (!!countryLanguageModel && !!countryLanguageModel.countryId) {
        const countryId = countryLanguageModel.countryId;
        countryIndexes.add(countryId);
      }
    });

    for (let countryId of countryIndexes) {
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

      const tardisRequestUrl: string = requestUrl(
        envModel.code,
        storeModel.path,
        productModel.path,
        'app-copy',
        platformPath,
        countryCode,
      );
      const activeAppCopy: RokuAppCopyModel = await getActiveAppCopy(
        storeModel.id,
        productModel.id,
        envModel.id,
        false,
      );
      let activeDefaultAppCopy: RokuAppCopyModel = await getActiveAppCopy(
        storeModel.id,
        productModel.id,
        envModel.id,
        true,
      );
      const tardisRequestBody = await getAppCopyTardisData(
        appCopyModels,
        platformId,
        currentCountryCountryLanguageModels,
        envModel.id,
        !!activeAppCopy
          ? activeAppCopy.id
          : !!activeDefaultAppCopy
          ? activeDefaultAppCopy.id
          : null,
      );

      results = {
        ...results,
        [`${platformPath}-${countryCode}`]: {
          tardisRequestUrl,
          tardisRequestBody,
        },
      };
    }
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

export const getAppCopyTardisData = async (
  appCopyModels: RokuAppCopyModel[],
  platformId: number,
  currentCountryCountryLanguageModels: RokuCountryLanguageModel[],
  envId: number,
  activeId: number | null,
): Promise<any> => {
  let offers: any[] = [];
  let offersObj: any = {};

  for (let appCopyModel of appCopyModels) {
    const appCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
      {
        where: { appCopyId: appCopyModel.id, platformId },
      },
    );
    offersObj = await getAppCopyTardisDataOffer(
      appCopyModel,
      appCopyValueModels,
      currentCountryCountryLanguageModels,
      envId,
    );
    offers.push(offersObj);
  }

  return {
    activeId,
    offers,
  };
};

export const getAppCopyTardisDataOffer = async (
  appCopyModel: RokuAppCopyModel,
  appCopyValueModels: RokuAppCopyValueModel[],
  currentCountryCountryLanguageModels: RokuCountryLanguageModel[],
  envId: number,
) => {
  let offerData: any = {};
  let translations: any[] = [];
  let nonTranslatableFields: any = {};
  for (let countryLanguageModel of currentCountryCountryLanguageModels) {
    const tardisData = await getAppCopyTardisLanguageData(
      countryLanguageModel,
      appCopyValueModels,
    );
    const translationsObj = {
      lang: tardisData.lang,
      storeOffer: tardisData.storeOffer,
    };
    nonTranslatableFields = { ...tardisData.nonTranslatableFields };
    translations.push(translationsObj);
  }

  offerData = {
    id: Number(appCopyModel.id),
    name: appCopyModel.name,
    isDefault: appCopyModel.isDefault,
    isActive: !!appCopyModel.isActive && appCopyModel.envId === envId,
    translations,
    ...nonTranslatableFields,
  };

  return offerData;
};

export const getAppCopyTardisLanguageData = async (
  countryLanguageModel: RokuCountryLanguageModel,
  appCopyValueModels: RokuAppCopyValueModel[],
) => {
  const languageModel: RokuLanguageModel = await RokuLanguage.findByPk(
    countryLanguageModel.languageId,
  );
  const languageValueData: RokuAppCopyValueModel[] = appCopyValueModels.filter(
    (elem) => {
      return elem.countryLanguageId === countryLanguageModel.id;
    },
  );
  let storeOffer: any = {};
  let nonTranslatableFields: any = {};
  for (let elem of languageValueData) {
    const appCopyField: RokuAppCopyFieldModel = await RokuAppCopyField.findByPk(
      elem.appCopyFieldId,
    );
    if (appCopyField) {
      const value = getProperValue(elem.value, appCopyField.type);
      if (!getProperValue(appCopyField.translatable, 'boolean')) {
        nonTranslatableFields = {
          ...nonTranslatableFields,
          [appCopyField.name]: value,
        };
      } else {
        storeOffer = { ...storeOffer, [appCopyField.name]: value };
      }
    }
  }
  return {
    lang: languageModel.code,
    storeOffer,
    nonTranslatableFields,
  };
};

export const getActiveAppCopy = async (
  storeId: number,
  productId: number,
  envId: number,
  isDefault?: boolean,
): Promise<RokuAppCopyModel> => {
  let liveAppCopyModels: RokuAppCopyModel[] = await RokuAppCopy.findAll({
    where: {
      storeId,
      productId,
      isPublished: true,
    },
  });
  if (isDefault === false || isDefault === true) {
    liveAppCopyModels = liveAppCopyModels.filter(
      (model) => model.isDefault === isDefault,
    );
  }
  let envActiveAppCopyModel = null;
  if (liveAppCopyModels.length) {
    const activeAppCopyModels: RokuAppCopyModel[] = liveAppCopyModels.filter(
      (model) => model.envId === envId && !!model.isActive,
    );
    activeAppCopyModels.sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
    );
    envActiveAppCopyModel = activeAppCopyModels[0];
  }
  return !!envActiveAppCopyModel ? envActiveAppCopyModel : null;
};

const isPromotedAppCopySameAsOriginal = async (
  originalAppCopyModel: RokuAppCopyModel,
  promotedAppCopyModel: RokuAppCopyModel,
): Promise<boolean> => {
  const originalAppCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
    {
      where: { appCopyId: originalAppCopyModel.id },
    },
  );
  const promotedAppCopyValueModels: RokuAppCopyValueModel[] = await RokuAppCopyValue.findAll(
    {
      where: { appCopyId: promotedAppCopyModel.id },
    },
  );
  let allAppCopyValueModelsAreEqual = true;
  if (originalAppCopyModel.name !== promotedAppCopyModel.name) {
    allAppCopyValueModelsAreEqual = false;
  } else {
    for (let promotedAppCopyValueModel of promotedAppCopyValueModels) {
      const foundAppCopyFieldModel: RokuAppCopyFieldModel = await RokuAppCopyField.findByPk(
        promotedAppCopyValueModel.appCopyFieldId,
      );
      const foundOriginalAppCopyValueModel = originalAppCopyValueModels.find(
        (model) =>
          model.appCopyFieldId === promotedAppCopyValueModel.appCopyFieldId &&
          model.countryLanguageId ===
            promotedAppCopyValueModel.countryLanguageId,
      );
      const originalAppCopyValueModelValue = getProperValue(
        !!foundOriginalAppCopyValueModel
          ? foundOriginalAppCopyValueModel.value
          : null,
        foundAppCopyFieldModel.type,
        false,
      );
      const promotedAppCopyValueModelValue = getProperValue(
        promotedAppCopyValueModel.value,
        foundAppCopyFieldModel.type,
        false,
      );
      if (originalAppCopyValueModelValue !== promotedAppCopyValueModelValue) {
        allAppCopyValueModelsAreEqual = false;
      }
    }
  }
  return allAppCopyValueModelsAreEqual;
};
