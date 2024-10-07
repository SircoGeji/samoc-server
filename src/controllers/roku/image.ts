import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  RokuCampaign,
  RokuCountry,
  RokuImageCollection,
  RokuImageCollectionImage,
  RokuImageGallery,
  RokuImagePlacement,
  RokuProduct,
  RokuStore,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { RokuStoreModel } from 'src/models/roku/Store';
import { RokuProductModel } from 'src/models/roku/Product';
import { PlatformEnum, RokuModuleStatus } from '../../types/enum';
import { RokuImagePlacementModel } from 'src/models/roku/ImagePlacement';
import { RokuImageGalleryModel } from 'src/models/roku/ImageGallery';
import { RokuImageCollectionModel } from 'src/models/roku/ImageCollection';
import { RokuImageCollectionImageModel } from 'src/models/roku/ImageCollectionImage';
import { RokuCountryModel } from 'src/models/roku/Country';
import { getCurrentDate, setModuleEnv } from '.';
import { setLiveCampaignParameter } from './campaign';
import { RokuCampaignModel } from 'src/models/roku/Campaign';
import { copyObjectToS3, deleteObject } from '../../services/S3';
import { updateSpinnerText, pRetryAll } from '../../util/utils';
import { clearImageCache } from '../../services/Imgix';
import { generatePath, invalidateImageCache } from '../../services/Cloudfront';
import { setModelStatus } from './multiModules';
import pRetry from 'p-retry';

const logger = Logger(module);

/**
 * GET /api/roku/image/:store/placement
 * Get all Roku Image module placements by store
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImagePlacement = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImagePlacement module Controller - getAllImagePlacement');
  updateSpinnerText('Getting all images placements...');
  try {
    let storeModel: RokuStoreModel;
    let imagePlacementModels: RokuImagePlacementModel[];
    if (req.query.store) {
      storeModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        imagePlacementModels = await RokuImagePlacement.findAll({
          where: { storeId },
        });
      } else {
        throw new AppError('Such Roku Store module not found', 404);
      }
    } else {
      imagePlacementModels = await RokuImagePlacement.findAll();
    }

    if (imagePlacementModels.length) {
      const results = imagePlacementModels.map((model) => {
        return {
          created: model.created,
          updated: model.updated,
          storeId: model.storeId,
          name: model.name,
          reqMaxSize: model.reqMaxSize,
          reqType: model.reqType,
          reqDimen: model.reqDimen,
          required: model.required,
          order: model.order,
        };
      });
      retWithSuccess(req, res, {
        message: 'Roku ImagePlacements modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Roku ImagePlacements modules not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Roku getAllImagePlacement failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/image/gallery/:store?product
 * Get all Roku ImageGallery modules by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImageGallery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageGallery module Controller - getAllImageGallery');
  updateSpinnerText('Getting all gallery images...');
  try {
    if (req.query.store) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: RokuProductModel = await RokuProduct.findOne({
            where: { path: req.query.product },
          });
          if (productModel) {
            const productId: number = productModel.id;
            const imageGalleryModels: RokuImageGalleryModel[] = await RokuImageGallery.findAll({
              where: { storeId, productId },
            });
            if (imageGalleryModels.length) {
              const results = imageGalleryModels.map((model) => {
                return {
                  created: model.created,
                  updated: model.updated,
                  storeId: model.storeId,
                  productId: model.productId,
                  imageId: model.id,
                  name: model.name,
                  size: model.size,
                  type: model.type,
                  dimensions: model.dimensions,
                  path: model.path,
                };
              });
              retWithSuccess(req, res, {
                message: 'Roku ImageGallery modules found',
                status: 200,
                data: results,
              });
            } else {
              retWithSuccess(req, res, {
                message: 'Roku ImageGallery modules not found',
                status: 200,
                data: [],
              });
            }
          } else {
            throw new AppError('Such Roku Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Roku Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Roku getAllImageGallery failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/image/gallery/:store?product
 * Save Roku ImageGallery module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveImageGallery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageGallery module Controller - getAllImageGallery');
  updateSpinnerText('Saving image in gallery...');
  try {
    if (req.query.store) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: RokuProductModel = await RokuProduct.findOne({
            where: { path: req.query.product },
          });
          if (productModel) {
            let data: any[] = [];
            const productId: number = productModel.id;
            for (let image of req.body.images) {
              const imageGalleryDBPayload = {
                created: getCurrentDate(),
                updated: getCurrentDate(),
                createdBy: !!req.body.createdBy ? req.body.createdBy : null,
                storeId,
                productId,
                name: image.name,
                size: image.size,
                type: image.type,
                dimensions: image.dimensions,
                path: image.path,
              };
              const imageGallerySaveResult = await RokuImageGallery.create(imageGalleryDBPayload);
              data.push(imageGallerySaveResult.id);
            }
            retWithSuccess(req, res, {
              message: `Roku ImageGallery module${req.body.images.length !== 1 ? 's' : ''} saved in DB successfully`,
              status: 200,
              data,
            });
          } else {
            throw new AppError('Such Roku Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Roku Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Roku getAllImageGallery failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/image/gallery/:imageId/collections
 * Get usage of ImageGallery module in ImageCollections modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getUsageOfImageInImageCollections = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Roku ImageGallery module Controller - getUsageOfImageInImageCollections');
    updateSpinnerText('Getting usage of images in image collections...');
    try {
      if (req.params.imageId) {
        const imageId: number = Number(req.params.imageId);
        const imageGalleryModel: RokuImageGalleryModel = await RokuImageGallery.findByPk(imageId);
        if (imageGalleryModel) {
          const imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll(
            {
              where: { imageId },
            },
          );
          if (imageCollectionImageModels.length) {
            let imageCollectionNames = new Set<string>();
            for (let imageCollectionImageModel of imageCollectionImageModels) {
              const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
                imageCollectionImageModel.imageCollectionId,
              );
              imageCollectionNames.add(imageCollectionModel.name);
            }
            const results = Array.from(imageCollectionNames);
            retWithSuccess(req, res, {
              message: `Roku ${imageGalleryModel.name} ImageGallery module usage found`,
              status: 200,
              data: results,
            });
          } else {
            retWithSuccess(req, res, {
              message: `Roku ${imageGalleryModel.name} ImageGallery module usage not found`,
              status: 200,
              data: null,
            });
          }
        } else {
          throw new AppError('Such Roku imageGallery module not found', 404);
        }
      } else {
        throw new AppError('ImageId value is required in the request params', 404);
      }
    } catch (err) {
      logger.error(`Roku getUsageOfImageInImageCollections failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/roku/image/collection/:store?product
 * Get all Roku ImageCollection modules by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageCollection module Controller - getAllImageCollection');
  updateSpinnerText('Getting all image collections...');
  try {
    let imageCollectionModels: RokuImageCollectionModel[];
    if (req.query.store) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      const storeId: number = storeModel.id;
      if (req.query.product) {
        const productModel: RokuProductModel = await RokuProduct.findOne({
          where: { path: req.query.product },
        });
        const productId: number = productModel.id;
        imageCollectionModels = await RokuImageCollection.findAll({
          where: { storeId, productId },
        });
      } else {
        imageCollectionModels = await RokuImageCollection.findAll({
          where: { storeId },
        });
      }
    } else {
      imageCollectionModels = await RokuImageCollection.findAll();
    }

    if (imageCollectionModels.length) {
      let results: any[] = [];
      for (let imageCollectionModel of imageCollectionModels) {
        const result = await getImageCollectionModuleData(imageCollectionModel);
        results.push(result);
      }
      retWithSuccess(req, res, {
        message: `Roku ImageCollection modules found`,
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: `Roku ImageCollection modules not found`,
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Roku getAllImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/roku/image/collection/:imageCollectionId
 * Get Roku ImageCollection module by imageCollectionId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageCollection module Controller - getImageCollection');
  updateSpinnerText('Getting image collection...');
  try {
    if (req.params.imageCollectionId) {
      const imageCollectionId: number = Number(req.params.imageCollectionId);
      const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
        imageCollectionId,
      );
      if (imageCollectionModel) {
        const result = await getImageCollectionModuleData(imageCollectionModel);
        retWithSuccess(req, res, {
          message: `Roku ImageCollection module found`,
          status: 200,
          data: result,
        });
      } else {
        retWithSuccess(req, res, {
          message: `Roku ImageCollection module not found`,
          status: 200,
          data: null,
        });
      }
    } else {
      throw new AppError('imageCollectionId value is required in the request params', 404);
    }
  } catch (err) {
    logger.error(`Roku getImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/roku/image/collection/:store/save?product
 * Save Roku ImageCollection module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageCollection module Controller - saveImageCollection');
  updateSpinnerText('Saving image collection...');
  let imageCollectionId: number;
  try {
    if (req.query.store) {
      const storeModel: RokuStoreModel = await RokuStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: RokuProductModel = await RokuProduct.findOne({
            where: { path: req.query.product },
          });
          if (productModel) {
            const productId: number = productModel.id;
            let countries: string = null;
            if (req.body.countries && req.body.countries.length) {
              countries = await getCountriesIndexesString(req.body.countries, storeId, productId);
            }

            const imageCollectionDBPayload = {
              created: getCurrentDate(),
              updated: getCurrentDate(),
              createdBy: !!req.body.createdBy ? req.body.createdBy : null,
              storeId,
              productId,
              name: req.body.name,
              isDefault: false,
              countries,
              status: RokuModuleStatus.DRAFT,
            };
            const imageCollectionResult = await RokuImageCollection.create(imageCollectionDBPayload);
            imageCollectionId = imageCollectionResult.id;
            await createImageCollectionImageModels(imageCollectionResult, req.body.images);

            const currentStatus = await getCurrentModuleStatus(imageCollectionResult);
            if (currentStatus !== RokuModuleStatus.DRAFT) {
              imageCollectionResult.set('status', currentStatus);
              await imageCollectionResult.save();
            }

            retWithSuccess(req, res, {
              message: `Roku ${imageCollectionResult.name} ImageCollection module saved in DB successfully`,
              status: 201,
              data: { imageCollectionId },
            });
          } else {
            throw new AppError('Such Roku Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Roku Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Roku saveImageCollection failed, ${err.message}`, err);

    // deleting incomplete records from DB
    const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(imageCollectionId);
    await imageCollectionModel.destroy({ force: true });

    return next(processOfferError(err));
  }
});

export const getCountriesIndexesString = async (countriesCodesArr: any[], storeId: number, productId: number) => {
  let countriesIndexesSet = new Set<number>();
  for (let countryCode of countriesCodesArr) {
    const countryModel: RokuCountryModel = await RokuCountry.findOne({
      where: { storeId, productId, code: countryCode },
    });
    if (countryModel) {
      countriesIndexesSet.add(countryModel.id);
    }
  }
  return countriesIndexesSet.size ? Array.from(countriesIndexesSet).join(',') : null;
};

export const createImageCollectionImageModels = async (
  imageCollectionModel: RokuImageCollectionModel,
  imagesBody: any,
) => {
  const imageCollectionImageArray = await getBodyImageCollectionImageArray(imageCollectionModel, imagesBody);
  for (const elem of imageCollectionImageArray) {
    const imageCollectionImageDBPayload = {
      created: getCurrentDate(),
      updated: getCurrentDate(),
      createdBy: !!imageCollectionModel.createdBy ? imageCollectionModel.createdBy : null,
      imageCollectionId: elem.imageCollectionId,
      imagePlacementId: elem.imagePlacementId,
      imageId: elem.imageId,
    };
    await RokuImageCollectionImage.create(imageCollectionImageDBPayload);
  }
};

/**
 * PUT /api/roku/image/collection/:imageCollectionId/update
 * Update Roku ImageCollection module by imageCollectionId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageCollection module Controller - updateImageCollection');
  updateSpinnerText('Updating image collection...');
  try {
    const imageCollectionId: number = Number(req.params.imageCollectionId);
    if (imageCollectionId !== null || imageCollectionId !== undefined) {
      const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
        imageCollectionId,
      );
      if (imageCollectionModel) {
        if (req.query.status !== undefined) {
          imageCollectionModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          imageCollectionModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (imageCollectionModel.status === RokuModuleStatus.LIVE) {
            await deleteUncheckedCountriesInS3(imageCollectionModel, req.body);
          }

          await updateImageCollectionImageModels(imageCollectionId, req.body.images);
          imageCollectionModel.set('name', req.body.name);
          let countries: string = null;
          if (req.body.countries && req.body.countries.length) {
            countries = await getCountriesIndexesString(
              req.body.countries,
              imageCollectionModel.storeId,
              imageCollectionModel.productId,
            );
          }
          imageCollectionModel.set('countries', countries);
        }

        const currentStatus = await getCurrentModuleStatus(imageCollectionModel);
        imageCollectionModel.set('status', currentStatus);
        imageCollectionModel.set('updated', getCurrentDate());
        await imageCollectionModel.save();

        retWithSuccess(req, res, {
          message: `Roku ${imageCollectionModel.name} ImageCollection module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        throw new AppError('Such Roku ImageCollection module not found', 404);
      }
    } else {
      throw new AppError('Invalid imageCollectionId value', 404);
    }
  } catch (err) {
    logger.error(`Roku updateImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const deleteUncheckedCountriesInS3 = async (imageCollectionModel: RokuImageCollectionModel, body: any) => {
  const oldCountries: string[] = imageCollectionModel.countries.split(',');
  const bodyCountries = await getCountriesIndexesString(
    body.countries,
    imageCollectionModel.storeId,
    imageCollectionModel.productId,
  );
  const newCountries: string[] = bodyCountries.split(',');
  let uncheckedCountries: string[] = [];
  for (let countryId of oldCountries) {
    if (!newCountries.includes(countryId)) {
      uncheckedCountries.push(countryId);
    }
  }
  if (uncheckedCountries.length) {
    const productModel: RokuProductModel = await RokuProduct.findByPk(imageCollectionModel.productId);
    const envArr: string[] = imageCollectionModel.deployedTo.split('-');
    if (envArr.length) {
      for (let env of envArr) {
        if (productModel) {
          for (let countryId of uncheckedCountries) {
            const countryModel: RokuCountryModel = await RokuCountry.findByPk(Number(countryId));
            const imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll(
              {
                where: { imageCollectionId: imageCollectionModel.id },
              },
            );
            if (countryModel && imageCollectionImageModels.length) {
              for (let imageCollectionImageModel of imageCollectionImageModels) {
                const imagePlacementModel: RokuImagePlacementModel = await RokuImagePlacement.findByPk(
                  imageCollectionImageModel.imagePlacementId,
                );
                const imageGalleryModel: RokuImageGalleryModel = await RokuImageGallery.findByPk(
                  imageCollectionImageModel.imageId,
                );
                if (imagePlacementModel && imageGalleryModel) {
                  const imagePlacementName = imagePlacementModel.name.replace(/ /g, '_');
                  const name = `${imagePlacementName}_${countryModel.path}.${imageGalleryModel.type.toLowerCase()}`;
                  await deleteObject(PlatformEnum.ROKU, 'appImages', env, null, productModel.path, name);
                }
              }
            }
          }
        }
      }
    }
  }
};

export const updateImageCollectionImageModels = async (imageCollectionId: number, imagesBody: any) => {
  let imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll({
    where: { imageCollectionId },
  });
  const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(imageCollectionId);

  const imageCollectionImageModelsSet = new Set<number>();
  imageCollectionImageModels.forEach((elem) => {
    imageCollectionImageModelsSet.add(elem.id);
  });

  const imageCollectionImageArrFromBody: any[] = await getBodyImageCollectionImageArray(
    imageCollectionModel,
    imagesBody,
  );

  for (const fieldElem of imageCollectionImageArrFromBody) {
    const foundImageCollectionImageModel = imageCollectionImageModels.find(
      (elem) => elem.imagePlacementId === fieldElem.imagePlacementId,
    );

    if (foundImageCollectionImageModel) {
      foundImageCollectionImageModel.set('imageId', fieldElem.imageId);
      foundImageCollectionImageModel.set('updated', getCurrentDate());
      await foundImageCollectionImageModel.save();
      imageCollectionImageModelsSet.delete(foundImageCollectionImageModel.id);
    } else {
      const imageCollectionImageDBPayload = {
        created: getCurrentDate(),
        updated: getCurrentDate(),
        createdBy: !!imageCollectionModel.createdBy ? imageCollectionModel.createdBy : null,
        imageCollectionId: fieldElem.imageCollectionId,
        imagePlacementId: fieldElem.imagePlacementId,
        imageId: fieldElem.imageId,
      };
      await RokuImageCollectionImage.create(imageCollectionImageDBPayload);
    }
  }

  // destroy unsent from body language fields-value
  if (imageCollectionImageModelsSet.size !== 0) {
    for (const imageCollectionImageModelsSetElem of imageCollectionImageModelsSet) {
      const foundImageCollectionImageModel: RokuImageCollectionImageModel = await RokuImageCollectionImage.findByPk(
        imageCollectionImageModelsSetElem,
      );
      if (foundImageCollectionImageModel) {
        foundImageCollectionImageModel.destroy({ force: true });
      }
    }
  }
};

/**
 * GET /api/roku/image-collection/:imageCollectionId/usage
 * Get Roku ImageCollection module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getImageCollectionUsage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Roku ImageCollection module Controller - getImageCollectionUsage');
  updateSpinnerText('Getting image collection usage...');
  try {
    const imageCollectionId: number = Number(req.params.imageCollectionId);
    const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(imageCollectionId);

    if (imageCollectionModel) {
      const campaignModels: RokuCampaignModel[] = await RokuCampaign.findAll();

      let data: any[] = null;
      if (campaignModels.length) {
        data = [];
        campaignModels.forEach((model) => {
          if (!!model.imageCollectionIndexes){
            let imageCollectionIndexes: string[] = [];
            if (model.imageCollectionIndexes?.includes(',')) {
              imageCollectionIndexes = model.imageCollectionIndexes.split(',');
            } else {
              imageCollectionIndexes.push(model.imageCollectionIndexes);
            }
            if (imageCollectionIndexes.includes(req.params.imageCollectionId)){
              data.push(model.name);
            }
          }
        });
      } else {
        retWithSuccess(req, res, {
          message: `Roku ${imageCollectionModel.name} ImageCollection module usage not found`,
          status: 200,
          data: null,
        });
      }

      retWithSuccess(req, res, {
        message: `Roku ${imageCollectionModel.name} ImageCollection module usage data found`,
        status: 200,
        data,
      });
    } else {
      throw new AppError('ImageCollection module in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Roku getImageCollectionUsage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getBodyImageCollectionImageArray = async (
  imageCollectionModel: RokuImageCollectionModel,
  imagesBody: any,
) => {
  const imageCollectionId: number = imageCollectionModel.id;
  const imagePlacementModels: RokuImagePlacementModel[] = await RokuImagePlacement.findAll({
    where: { storeId: imageCollectionModel.storeId },
  });

  const storeId: number = imageCollectionModel.storeId;
  const productId: number = imageCollectionModel.productId;
  let result: any[] = [];

  result = getImageCollectionImageArrayFromImagesBody(
    imagesBody,
    imageCollectionId,
    storeId,
    productId,
    imagePlacementModels,
  );
  return result;
};

export const getImageCollectionImageArrayFromImagesBody = (
  imagesBody: any,
  imageCollectionId: number,
  storeId: number,
  productId: number,
  imagePlacementModels: RokuImagePlacementModel[],
): any[] => {
  let resultArr: any[] = [];
  const bodyPlacementKeys = Object.keys(imagesBody);
  const bodyPlacementValues = Object.values(imagesBody);
  bodyPlacementValues.forEach((bodyPlacement, i) => {
    const imagePlacementId: number = imagePlacementModels.find((model) => model.name === bodyPlacementKeys[i]).id;
    resultArr.push({
      storeId,
      productId,
      imageCollectionId,
      imagePlacementId,
      imageId: bodyPlacement,
    });
  });
  return resultArr;
};

export const getImageCollectionModuleData = async (imageCollectionModel: RokuImageCollectionModel) => {
  const imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll({
    where: { imageCollectionId: imageCollectionModel.id },
  });
  let countries: any[] = [];
  let images: any = {};
  if (!!imageCollectionModel.countries) {
    const countryIndexesArr = imageCollectionModel.countries.split(',');
    if (countryIndexesArr.length) {
      for (let countryId of countryIndexesArr) {
        const countryModel: RokuCountryModel = await RokuCountry.findByPk(countryId);
        if (countryModel) {
          countries.push(countryModel.code);
        }
      }
    }
  }
  if (imageCollectionImageModels.length) {
    for (let imageCollectionImageModel of imageCollectionImageModels) {
      const imagePlacementModel: RokuImagePlacementModel = await RokuImagePlacement.findByPk(
        imageCollectionImageModel.imagePlacementId,
      );
      const imageGalleryModel: RokuImageGalleryModel = await RokuImageGallery.findByPk(
        imageCollectionImageModel.imageId,
      );
      images = {
        ...images,
        [imagePlacementModel.name]: {
          imageId: imageGalleryModel.id,
          created: imageGalleryModel.created,
          updated: imageGalleryModel.updated,
          storeId: imageGalleryModel.storeId,
          productId: imageGalleryModel.productId,
          name: imageGalleryModel.name,
          size: imageGalleryModel.size,
          type: imageGalleryModel.type,
          path: imageGalleryModel.path,
        },
      };
    }
  }
  const status = await getCurrentModuleStatus(imageCollectionModel);
  const result = {
    created: imageCollectionModel.created,
    updated: imageCollectionModel.updated,
    storeId: imageCollectionModel.storeId,
    productId: imageCollectionModel.productId,
    imageCollectionId: imageCollectionModel.id,
    name: imageCollectionModel.name,
    isDefault: imageCollectionModel.isDefault,
    status,
    deployedTo: imageCollectionModel.deployedTo,
    endedOn: imageCollectionModel.endedOn,
    countries,
    images,
  };
  return result;
};

/**
 * POST /api/roku/image/collection/:imageCollectionid/publish?env
 * Publish Roku ImageCollection module by imageCollectionid and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  req.socket.setTimeout(900e3); // increase request socket timeout to 15 minutes
  logger.debug('Roku ImageCollection module Controller - publishImageCollection');
  let bundleModule;
  try {
    const imageCollectionId: number = Number(req.params.imageCollectionId);
    if (imageCollectionId === null || imageCollectionId === undefined) {
      throw new AppError('Invalid imageCollectionid value', 400);
    }
    if (!req.query.env) {
      throw new AppError('Environment is a required parameter', 400);
    }
    const env: string = req.query.env as string;
    if (!env) {
      throw new AppError('Invalid environment value', 400);
    }
    const imageCollectionModel: RokuImageCollectionModel = await RokuImageCollection.findByPk(
      imageCollectionId,
    );
    if (!imageCollectionModel) {
      throw new AppError('Such Roku ImageCollection module not found', 404);
    }
    bundleModule = imageCollectionModel;
    const productModel: RokuProductModel = await RokuProduct.findByPk(imageCollectionModel.productId);
    const imageArr: any[] = await getImagesNameAndPathForS3(imageCollectionModel);
    if (!imageArr.length) {
      throw new AppError('Images array of name and path not found', 400);
    }
    // set status to IN PROGRESS
    const envStr = req.query.envStr;
    imageCollectionModel.set('status', RokuModuleStatus.PUBLISH_PROGRESS + envStr);
    await imageCollectionModel.save();
    
    await publishBundleRetry(
      imageArr,
      env,
      productModel,
      imageCollectionModel,
    );

    retWithSuccess(req, res, {
      message: `Roku ${
        imageCollectionModel.name
      } ImageCollection module published on ${env.toUpperCase()} successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Roku publishImageCollection failed, ${err.message}`, err);
    if (!!bundleModule) {
      bundleModule.set('status', RokuModuleStatus.READY);
      await bundleModule.save();
    }
    return next(processOfferError(err));
  }
});

export const publishBundleRetry = async (
  imageArr: any[],
  env: string,
  productModel: RokuProductModel,
  imageCollectionModel: RokuImageCollectionModel,
): Promise<any> => {
  let copyAndImgixClearFinished = false;
  let cloudfrontInvalidateCacheFinished = false;
  const bundleOp = async () => {
    if (!copyAndImgixClearFinished) {
      for (let [i, image] of imageArr.entries()) {
        await copyObjectToS3(PlatformEnum.ROKU, env, productModel.path, image.name, image.sourceKey, i);
        await clearImageCache(PlatformEnum.ROKU, env, productModel.path, image.name, i);
      }
      copyAndImgixClearFinished = true;
    }
    if (!cloudfrontInvalidateCacheFinished) {
      await invalidateImageCache(generatePath(PlatformEnum.ROKU, env, productModel.path));
      cloudfrontInvalidateCacheFinished = true;
    }
    await publishImageCollectionModule(imageCollectionModel, env);
  };
  // setup retry mechanism
  await pRetry(bundleOp, pRetryAll);
};

export const getImagesNameAndPathForS3 = async (imageCollectionModel: RokuImageCollectionModel) => {
  const countryIndexesArr: string[] = imageCollectionModel.countries.split(',');
  let countryCodes: string[] = [];
  for (let countryId of countryIndexesArr) {
    const countryModel: RokuCountryModel = await RokuCountry.findByPk(Number(countryId));
    if (countryModel) {
      countryCodes.push(countryModel.path);
    }
  }

  const imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll({
    where: { imageCollectionId: imageCollectionModel.id },
  });
  let images: any[] = [];
  for (let imageCollectionImageModel of imageCollectionImageModels) {
    const imagePlacementModel: RokuImagePlacementModel = await RokuImagePlacement.findByPk(
      imageCollectionImageModel.imagePlacementId,
    );
    const imageGalleryModel: RokuImageGalleryModel = await RokuImageGallery.findByPk(
      imageCollectionImageModel.imageId,
    );
    if (imagePlacementModel && imageGalleryModel) {
      const name = imagePlacementModel.name.replace(/ /g, '_');
      images.push({
        name,
        path: imageGalleryModel.path,
        type: imageGalleryModel.type.toLowerCase(),
      });
    }
  }

  let result: any[] = [];
  if (countryCodes.length) {
    countryCodes.forEach((countryCode) => {
      images.forEach((imageData) => {
        const name = `${imageData.name}_${countryCode}.${imageData.type}`;
        result.push({
          name,
          sourceKey: imageData.path.replace('https://img.flex.com/', ''),
        });
      });
    });
    return result;
  } else {
    return null;
  }
};

export const publishImageCollectionModule = async (imageCollectionModel: RokuImageCollectionModel, env: string) => {
  const imageCollectionImageModels: RokuImageCollectionImageModel[] = await RokuImageCollectionImage.findAll({
    where: { imageCollectionid: imageCollectionModel.id },
  });
  imageCollectionModel.set('status', RokuModuleStatus.LIVE);
  if (imageCollectionModel.status === RokuModuleStatus.LIVE) {
    // set status "saved" for all other "published" appCopyValue models
    let restImageCollectionModels: RokuImageCollectionModel[] = await RokuImageCollection.findAll({
      where: {
        storeId: imageCollectionModel.storeId,
        productId: imageCollectionModel.productId,
        status: RokuModuleStatus.LIVE,
      },
    });
    restImageCollectionModels = restImageCollectionModels.filter((elem) => {
      return elem.id !== imageCollectionModel.id && elem.deployedTo.includes(env);
    });
    const imageCollectionCountries: string[] = imageCollectionModel.countries.split(',');
    if (restImageCollectionModels.length) {
      for (let restImageCollectionModel of restImageCollectionModels) {
        const newCountries: string = getNewCountriesString(imageCollectionCountries, restImageCollectionModel);
        if (newCountries) {
          restImageCollectionModel.set('countries', newCountries);

          if (restImageCollectionModel.deployedTo !== env && newCountries !== restImageCollectionModel.countries) {
            let newDeployedTo: string = restImageCollectionModel.deployedTo.replace(env, '');
            newDeployedTo = newDeployedTo.replace('-', '');
            restImageCollectionModel.set('deployedTo', newDeployedTo);
            setModuleEnv(restImageCollectionModel, env, 'endedOn');
          }
        } else {
          if (restImageCollectionModel.deployedTo === env) {
            restImageCollectionModel.set('deployedTo', null);
            setModuleEnv(restImageCollectionModel, env, 'endedOn');
          } else {
            let newDeployedTo: string = restImageCollectionModel.deployedTo.replace(env, '');
            newDeployedTo = newDeployedTo.replace('-', '');
            restImageCollectionModel.set('deployedTo', newDeployedTo);
            setModuleEnv(restImageCollectionModel, env, 'endedOn');
          }
        }

        const currentStatus = await getCurrentModuleStatus(restImageCollectionModel);
        restImageCollectionModel.set('status', currentStatus);
        restImageCollectionModel.set('updated', getCurrentDate());
        await restImageCollectionModel.save();
      }
    }
    setModuleEnv(imageCollectionModel, env, 'deployedTo');
    if (env === imageCollectionModel.endedOn) {
      imageCollectionModel.set('endedOn', null);
    }
  }
  imageCollectionModel.set('updated', getCurrentDate());
  await imageCollectionModel.save();

  await setLiveCampaignParameter(
    imageCollectionModel.storeId,
    imageCollectionModel.productId,
    'image-collection',
    env,
    imageCollectionModel.id,
  );

  // deploy module data to Tardis service
  // const data = await deployModuleData(
  //     env,
  //     imageCollectionModel,
  //     imageCollectionImageModels,
  //     'image-collection',
  // );
  // return data;
};

export const getNewCountriesString = (
  imageCollectionCountries: string[],
  restImageCollectionModel: RokuImageCollectionModel,
) => {
  const restImageCollectionCountries: string[] = restImageCollectionModel.countries.split(',');
  let newCountries: string[] = [...restImageCollectionCountries];
  imageCollectionCountries.forEach((countryId) => {
    if (newCountries.includes(countryId)) {
      const elemIndex = newCountries.indexOf(countryId);
      if (elemIndex > -1) {
        newCountries.splice(elemIndex, 1);
      }
    }
  });

  return newCountries.length ? newCountries.join(',') : null;
};

export const getCurrentModuleStatus = async (imageCollectionModel: RokuImageCollectionModel) => {
  if (imageCollectionModel.status.includes(RokuModuleStatus.PUBLISH_PROGRESS)) {
    return imageCollectionModel.status;
  }
  const countryModels: RokuCountryModel[] = await RokuCountry.findAll({
    where: { storeId: imageCollectionModel.storeId, productId: imageCollectionModel.productId },
  });

  // check not null countries column
  let notNullCountries: boolean = false;
  let countryIndexes = new Set<number>(countryModels.map((model) => model.id));

  if (imageCollectionModel.countries && imageCollectionModel.countries.length) {
    if (imageCollectionModel.countries.includes(',')) {
      const countriesArr: any[] = imageCollectionModel.countries.split(',');
      notNullCountries = countriesArr.some((countryId) => countryIndexes.has(Number(countryId)));
    } else {
      notNullCountries = countryIndexes.has(Number(imageCollectionModel.countries));
    }
  }

  // check not null required image placements
  let allRequiredImagePlacementsNotNull: boolean = false;
  const imagePlacementModels: RokuImagePlacementModel[] = await RokuImagePlacement.findAll({
    where: { storeId: imageCollectionModel.storeId, required: true },
  });
  if (imagePlacementModels.length) {
    let notNullSet = new Set<boolean>();
    for (let imagePlacementModel of imagePlacementModels) {
      const imageCollectionImageModel: RokuImageCollectionImageModel = await RokuImageCollectionImage.findOne({
        where: { imageCollectionId: imageCollectionModel.id, imagePlacementId: imagePlacementModel.id },
      });
      if (imageCollectionImageModel) {
        notNullSet.add(true);
      } else {
        notNullSet.add(false);
      }
    }
    if (!notNullSet.has(false)) {
      allRequiredImagePlacementsNotNull = true;
    }
  } else {
    allRequiredImagePlacementsNotNull = true;
  }

  // return result status
  if (!imageCollectionModel.deployedTo && !!imageCollectionModel.endedOn) {
    await setModelStatus(imageCollectionModel, RokuModuleStatus.ENDED);
    return RokuModuleStatus.ENDED;
  } else if (!!imageCollectionModel.deployedTo) {
    await setModelStatus(imageCollectionModel, RokuModuleStatus.LIVE);
    return RokuModuleStatus.LIVE;
  } else if (notNullCountries && allRequiredImagePlacementsNotNull) {
    await setModelStatus(imageCollectionModel, RokuModuleStatus.READY);
    return RokuModuleStatus.READY;
  } else {
    await setModelStatus(imageCollectionModel, RokuModuleStatus.DRAFT);
    return RokuModuleStatus.DRAFT;
  }
};
