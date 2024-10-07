import asyncHandler from 'express-async-handler';
import { AppError } from '../../util/errorHandler';
import { NextFunction, Request, Response } from 'express';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  AndroidCampaign,
  AndroidCountry,
  AndroidImageCollection,
  AndroidImageCollectionImage,
  AndroidImageGallery,
  AndroidImagePlacement,
  AndroidProduct,
  AndroidStore,
} from '../../models';
import { processOfferError } from '../../util/utils';
import { AndroidStoreModel } from 'src/models/android/Store';
import { AndroidProductModel } from 'src/models/android/Product';
import { AndroidModuleStatus, PlatformEnum } from '../../types/enum';
import { AndroidImagePlacementModel } from 'src/models/android/ImagePlacement';
import { AndroidImageGalleryModel } from 'src/models/android/ImageGallery';
import { AndroidImageCollectionModel } from 'src/models/android/ImageCollection';
import { AndroidImageCollectionImageModel } from 'src/models/android/ImageCollectionImage';
import { AndroidCountryModel } from 'src/models/android/Country';
import { getCurrentDate, setModuleEnv } from '.';
import { setLiveCampaignParameter } from './campaign';
import { AndroidCampaignModel } from 'src/models/android/Campaign';
import { copyObjectToS3, deleteObject } from '../../services/S3';
import { updateSpinnerText, pRetryAll } from '../../util/utils';
import { clearImageCache } from '../../services/Imgix';
import { generatePath, invalidateImageCache } from '../../services/Cloudfront';
import { setModelStatus } from './multiModules';
import pRetry from 'p-retry';

const logger = Logger(module);

/**
 * GET /api/android/image/:store/placement
 * Get all Android Image module placements by store
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImagePlacement = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImagePlacement module Controller - getAllImagePlacement');
  updateSpinnerText('Getting all images placements...');
  try {
    let storeModel: AndroidStoreModel;
    let imagePlacementModels: AndroidImagePlacementModel[];
    if (req.query.store) {
      storeModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        imagePlacementModels = await AndroidImagePlacement.findAll({
          where: { storeId },
        });
      } else {
        throw new AppError('Such Android Store module not found', 404);
      }
    } else {
      imagePlacementModels = await AndroidImagePlacement.findAll();
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
        message: 'Android ImagePlacements modules found',
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: 'Android ImagePlacements modules not found',
        status: 200,
        data: null,
      });
    }
  } catch (err) {
    logger.error(`Android getAllImagePlacement failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/image/gallery/:store?product
 * Get all Android ImageGallery modules by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImageGallery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageGallery module Controller - getAllImageGallery');
  updateSpinnerText('Getting all gallery images...');
  try {
    if (req.query.store) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: AndroidProductModel = await AndroidProduct.findOne({
            where: { path: req.query.product },
          });
          if (productModel) {
            const productId: number = productModel.id;
            const imageGalleryModels: AndroidImageGalleryModel[] = await AndroidImageGallery.findAll({
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
                message: 'Android ImageGallery modules found',
                status: 200,
                data: results,
              });
            } else {
              retWithSuccess(req, res, {
                message: 'Android ImageGallery modules not found',
                status: 200,
                data: [],
              });
            }
          } else {
            throw new AppError('Such Android Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Android Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Android getAllImageGallery failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/android/image/gallery/:store?product
 * Save Android ImageGallery module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveImageGallery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageGallery module Controller - getAllImageGallery');
  updateSpinnerText('Saving image in gallery...');
  try {
    if (req.query.store) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: AndroidProductModel = await AndroidProduct.findOne({
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
              const imageGallerySaveResult = await AndroidImageGallery.create(imageGalleryDBPayload);
              data.push(imageGallerySaveResult.id);
            }
            retWithSuccess(req, res, {
              message: `Android ImageGallery module${req.body.images.length !== 1 ? 's' : ''} saved in DB successfully`,
              status: 200,
              data,
            });
          } else {
            throw new AppError('Such Android Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Android Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Android getAllImageGallery failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/image/gallery/:imageId/collections
 * Get usage of ImageGallery module in ImageCollections modules
 * @param {Request}     req
 * @param {Response}    res
 */
export const getUsageOfImageInImageCollections = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Android ImageGallery module Controller - getUsageOfImageInImageCollections');
    updateSpinnerText('Getting usage of images in image collections...');
    try {
      if (req.params.imageId) {
        const imageId: number = Number(req.params.imageId);
        const imageGalleryModel: AndroidImageGalleryModel = await AndroidImageGallery.findByPk(imageId);
        if (imageGalleryModel) {
          const imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll(
            {
              where: { imageId },
            },
          );
          if (imageCollectionImageModels.length) {
            let imageCollectionNames = new Set<string>();
            for (let imageCollectionImageModel of imageCollectionImageModels) {
              const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
                imageCollectionImageModel.imageCollectionId,
              );
              imageCollectionNames.add(imageCollectionModel.name);
            }
            const results = Array.from(imageCollectionNames);
            retWithSuccess(req, res, {
              message: `Android ${imageGalleryModel.name} ImageGallery module usage found`,
              status: 200,
              data: results,
            });
          } else {
            retWithSuccess(req, res, {
              message: `Android ${imageGalleryModel.name} ImageGallery module usage not found`,
              status: 200,
              data: null,
            });
          }
        } else {
          throw new AppError('Such Android imageGallery module not found', 404);
        }
      } else {
        throw new AppError('ImageId value is required in the request params', 404);
      }
    } catch (err) {
      logger.error(`Android getUsageOfImageInImageCollections failed, ${err.message}`, err);
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/android/image/collection/:store?product
 * Get all Android ImageCollection modules by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageCollection module Controller - getAllImageCollection');
  updateSpinnerText('Getting all image collections...');
  try {
    let imageCollectionModels: AndroidImageCollectionModel[];
    if (req.query.store) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      const storeId: number = storeModel.id;
      if (req.query.product) {
        const productModel: AndroidProductModel = await AndroidProduct.findOne({
          where: { path: req.query.product },
        });
        const productId: number = productModel.id;
        imageCollectionModels = await AndroidImageCollection.findAll({
          where: { storeId, productId },
        });
      } else {
        imageCollectionModels = await AndroidImageCollection.findAll({
          where: { storeId },
        });
      }
    } else {
      imageCollectionModels = await AndroidImageCollection.findAll();
    }

    if (imageCollectionModels.length) {
      let results: any[] = [];
      for (let imageCollectionModel of imageCollectionModels) {
        const result = await getImageCollectionModuleData(imageCollectionModel);
        results.push(result);
      }
      retWithSuccess(req, res, {
        message: `Android ImageCollection modules found`,
        status: 200,
        data: results,
      });
    } else {
      retWithSuccess(req, res, {
        message: `Android ImageCollection modules not found`,
        status: 200,
        data: [],
      });
    }
  } catch (err) {
    logger.error(`Android getAllImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * GET /api/android/image/collection/:imageCollectionId
 * Get Android ImageCollection module by imageCollectionId
 * @param {Request}     req
 * @param {Response}    res
 */
export const getImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageCollection module Controller - getImageCollection');
  updateSpinnerText('Getting image collection...');
  try {
    if (req.params.imageCollectionId) {
      const imageCollectionId: number = Number(req.params.imageCollectionId);
      const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
        imageCollectionId,
      );
      if (imageCollectionModel) {
        const result = await getImageCollectionModuleData(imageCollectionModel);
        retWithSuccess(req, res, {
          message: `Android ImageCollection module found`,
          status: 200,
          data: result,
        });
      } else {
        retWithSuccess(req, res, {
          message: `Android ImageCollection module not found`,
          status: 200,
          data: null,
        });
      }
    } else {
      throw new AppError('imageCollectionId value is required in the request params', 404);
    }
  } catch (err) {
    logger.error(`Android getImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

/**
 * POST /api/android/image/collection/:store/save?product
 * Save Android ImageCollection module by store and product
 * @param {Request}     req
 * @param {Response}    res
 */
export const saveImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageCollection module Controller - saveImageCollection');
  updateSpinnerText('Saving image collection...');
  let imageCollectionId: number;
  try {
    if (req.query.store) {
      const storeModel: AndroidStoreModel = await AndroidStore.findOne({
        where: { path: req.query.store },
      });
      if (storeModel) {
        const storeId: number = storeModel.id;
        if (req.query.product) {
          const productModel: AndroidProductModel = await AndroidProduct.findOne({
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
              status: AndroidModuleStatus.DRAFT,
            };
            const imageCollectionResult = await AndroidImageCollection.create(imageCollectionDBPayload);
            imageCollectionId = imageCollectionResult.id;
            await createImageCollectionImageModels(imageCollectionResult, req.body.images);

            const currentStatus = await getCurrentModuleStatus(imageCollectionResult);
            if (currentStatus !== AndroidModuleStatus.DRAFT) {
              imageCollectionResult.set('status', currentStatus);
              await imageCollectionResult.save();
            }

            retWithSuccess(req, res, {
              message: `Android ${imageCollectionResult.name} ImageCollection module saved in DB successfully`,
              status: 201,
              data: { imageCollectionId },
            });
          } else {
            throw new AppError('Such Android Product module not found', 404);
          }
        } else {
          throw new AppError('Product value is required in the request query', 404);
        }
      } else {
        throw new AppError('Such Android Store module not found', 404);
      }
    } else {
      throw new AppError('Store value is required in the request query', 404);
    }
  } catch (err) {
    logger.error(`Android saveImageCollection failed, ${err.message}`, err);

    // deleting incomplete records from DB
    const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(imageCollectionId);
    await imageCollectionModel.destroy({ force: true });

    return next(processOfferError(err));
  }
});

export const getCountriesIndexesString = async (countriesCodesArr: any[], storeId: number, productId: number) => {
  let countriesIndexesSet = new Set<number>();
  for (let countryCode of countriesCodesArr) {
    const countryModel: AndroidCountryModel = await AndroidCountry.findOne({
      where: { storeId, productId, code: countryCode },
    });
    if (countryModel) {
      countriesIndexesSet.add(countryModel.id);
    }
  }
  return countriesIndexesSet.size ? Array.from(countriesIndexesSet).join(',') : null;
};

export const createImageCollectionImageModels = async (
  imageCollectionModel: AndroidImageCollectionModel,
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
    await AndroidImageCollectionImage.create(imageCollectionImageDBPayload);
  }
};

/**
 * PUT /api/android/image/collection/:imageCollectionId/update
 * Update Android ImageCollection module by imageCollectionId
 * @param {Request}     req
 * @param {Response}    res
 */
export const updateImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android ImageCollection module Controller - updateImageCollection');
  updateSpinnerText('Updating image collection...');
  try {
    const imageCollectionId: number = Number(req.params.imageCollectionId);
    if (imageCollectionId !== null || imageCollectionId !== undefined) {
      const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
        imageCollectionId,
      );
      if (imageCollectionModel) {
        if (req.query.status !== undefined) {
          imageCollectionModel.set('status', req.query.status);
        } else if (req.query.isDefault !== undefined) {
          imageCollectionModel.set('isDefault', req.query.isDefault === 'true');
        } else {
          if (imageCollectionModel.status === AndroidModuleStatus.LIVE) {
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
          message: `Android ${imageCollectionModel.name} ImageCollection module updated in DB successfully`,
          status: 201,
          data: null,
        });
      } else {
        throw new AppError('Such Android ImageCollection module not found', 404);
      }
    } else {
      throw new AppError('Invalid imageCollectionId value', 404);
    }
  } catch (err) {
    logger.error(`Android updateImageCollection failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const deleteUncheckedCountriesInS3 = async (imageCollectionModel: AndroidImageCollectionModel, body: any) => {
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
    const productModel: AndroidProductModel = await AndroidProduct.findByPk(imageCollectionModel.productId);
    const envArr: string[] = imageCollectionModel.deployedTo.split('-');
    if (envArr.length) {
      for (let env of envArr) {
        if (productModel) {
          for (let countryId of uncheckedCountries) {
            const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(Number(countryId));
            const imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll(
              {
                where: { imageCollectionId: imageCollectionModel.id },
              },
            );
            if (countryModel && imageCollectionImageModels.length) {
              for (let imageCollectionImageModel of imageCollectionImageModels) {
                const imagePlacementModel: AndroidImagePlacementModel = await AndroidImagePlacement.findByPk(
                  imageCollectionImageModel.imagePlacementId,
                );
                const imageGalleryModel: AndroidImageGalleryModel = await AndroidImageGallery.findByPk(
                  imageCollectionImageModel.imageId,
                );
                if (imagePlacementModel && imageGalleryModel) {
                  const imagePlacementName = imagePlacementModel.name.replace(/ /g, '_');
                  const name = `${imagePlacementName}_${countryModel.path}.${imageGalleryModel.type.toLowerCase()}`;
                  await deleteObject(PlatformEnum.ANDROID, 'appImages', env, null, productModel.path, name);
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
  let imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll({
    where: { imageCollectionId },
  });
  const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(imageCollectionId);

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
      await AndroidImageCollectionImage.create(imageCollectionImageDBPayload);
    }
  }

  // destroy unsent from body language fields-value
  if (imageCollectionImageModelsSet.size !== 0) {
    for (const imageCollectionImageModelsSetElem of imageCollectionImageModelsSet) {
      const foundImageCollectionImageModel: AndroidImageCollectionImageModel = await AndroidImageCollectionImage.findByPk(
        imageCollectionImageModelsSetElem,
      );
      if (foundImageCollectionImageModel) {
        foundImageCollectionImageModel.destroy({ force: true });
      }
    }
  }
};

/**
 * GET /api/android/image-collection/:imageCollectionId/usage
 * Get Android ImageCollection module usage in any campaign
 * @param {Request}     req
 * @param {Response}    res
 */
export const getImageCollectionUsage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  logger.debug('Android StoreCopy module Controller - getImageCollectionUsage');
  updateSpinnerText('Getting image collection usage...');
  try {
    const imageCollectionId: number = Number(req.params.imageCollectionId);
    const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(imageCollectionId);

    if (imageCollectionModel) {
      const campaignModels: AndroidCampaignModel[] = await AndroidCampaign.findAll();
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
      }

      retWithSuccess(req, res, {
        message: `Android ${imageCollectionModel.name} ImageCollection module usage data found`,
        status: 201,
        data,
      });
    } else {
      throw new AppError('ImageCollection module in DB not found', 404);
    }
  } catch (err) {
    logger.error(`Android getImageCollectionUsage failed, ${err.message}`, err);
    return next(processOfferError(err));
  }
});

export const getBodyImageCollectionImageArray = async (
  imageCollectionModel: AndroidImageCollectionModel,
  imagesBody: any,
) => {
  const imageCollectionId: number = imageCollectionModel.id;
  const imagePlacementModels: AndroidImagePlacementModel[] = await AndroidImagePlacement.findAll({
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
  imagePlacementModels: AndroidImagePlacementModel[],
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

export const getImageCollectionModuleData = async (imageCollectionModel: AndroidImageCollectionModel) => {
  const imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll({
    where: { imageCollectionId: imageCollectionModel.id },
  });
  let countries: any[] = [];
  let images: any = {};
  if (!!imageCollectionModel.countries) {
    const countryIndexesArr = imageCollectionModel.countries.split(',');
    if (countryIndexesArr.length) {
      for (let countryId of countryIndexesArr) {
        const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(countryId);
        if (countryModel) {
          countries.push(countryModel.code);
        }
      }
    }
  }
  if (imageCollectionImageModels.length) {
    for (let imageCollectionImageModel of imageCollectionImageModels) {
      const imagePlacementModel: AndroidImagePlacementModel = await AndroidImagePlacement.findByPk(
        imageCollectionImageModel.imagePlacementId,
      );
      const imageGalleryModel: AndroidImageGalleryModel = await AndroidImageGallery.findByPk(
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
 * POST /api/android/image/collection/:imageCollectionid/publish?env
 * Publish Android ImageCollection module by imageCollectionid and environment
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishImageCollection = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  req.socket.setTimeout(900e3); // increase request socket timeout to 15 minutes
  logger.debug('Android ImageCollection module Controller - publishImageCollection');
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
    const imageCollectionModel: AndroidImageCollectionModel = await AndroidImageCollection.findByPk(
      imageCollectionId,
    );
    if (!imageCollectionModel) {
      throw new AppError('Such Android ImageCollection module not found', 404);
    }
    bundleModule = imageCollectionModel;
    const productModel: AndroidProductModel = await AndroidProduct.findByPk(imageCollectionModel.productId);
    const imageArr: any[] = await getImagesNameAndPathForS3(imageCollectionModel);
    if (!imageArr.length) {
      throw new AppError('Images array of name and path not found', 400);
    }
    // set status to IN PROGRESS
    const envStr = req.query.envStr;
    imageCollectionModel.set('status', AndroidModuleStatus.PUBLISH_PROGRESS + envStr);
    await imageCollectionModel.save();
    
    await publishBundleRetry(
      imageArr,
      env,
      productModel,
      imageCollectionModel,
    );

    retWithSuccess(req, res, {
      message: `Android ${
        imageCollectionModel.name
      } ImageCollection module published on ${env.toUpperCase()} successfully`,
      status: 201,
      data: null,
    });
  } catch (err) {
    logger.error(`Android publishImageCollection failed, ${err.message}`, err);
    if (!!bundleModule) {
      bundleModule.set('status', AndroidModuleStatus.READY);
      await bundleModule.save();
    }
    return next(processOfferError(err));
  }
});

export const publishBundleRetry = async (
  imageArr: any[],
  env: string,
  productModel: AndroidProductModel,
  imageCollectionModel: AndroidImageCollectionModel,
): Promise<any> => {
  let copyAndImgixClearFinished = false;
  let cloudfrontInvalidateCacheFinished = false;
  const bundleOp = async () => {
    if (!copyAndImgixClearFinished) {
      for (let [i, image] of imageArr.entries()) {
        await copyObjectToS3(PlatformEnum.ANDROID, env, productModel.path, image.name, image.sourceKey, i);
        await clearImageCache(PlatformEnum.ANDROID, env, productModel.path, image.name, i);
      }
      copyAndImgixClearFinished = true;
    }
    if (!cloudfrontInvalidateCacheFinished) {
      await invalidateImageCache(generatePath(PlatformEnum.ANDROID, env, productModel.path));
      cloudfrontInvalidateCacheFinished = true;
    }
    await publishImageCollectionModule(imageCollectionModel, env);
  };
  // setup retry mechanism
  await pRetry(bundleOp, pRetryAll);
};

export const getImagesNameAndPathForS3 = async (imageCollectionModel: AndroidImageCollectionModel) => {
  const countryIndexesArr: string[] = imageCollectionModel.countries.split(',');
  let countryCodes: string[] = [];
  for (let countryId of countryIndexesArr) {
    const countryModel: AndroidCountryModel = await AndroidCountry.findByPk(Number(countryId));
    if (countryModel) {
      countryCodes.push(countryModel.path);
    }
  }

  const imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll({
    where: { imageCollectionId: imageCollectionModel.id },
  });
  let images: any[] = [];
  for (let imageCollectionImageModel of imageCollectionImageModels) {
    const imagePlacementModel: AndroidImagePlacementModel = await AndroidImagePlacement.findByPk(
      imageCollectionImageModel.imagePlacementId,
    );
    const imageGalleryModel: AndroidImageGalleryModel = await AndroidImageGallery.findByPk(
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

export const publishImageCollectionModule = async (imageCollectionModel: AndroidImageCollectionModel, env: string) => {
  const imageCollectionImageModels: AndroidImageCollectionImageModel[] = await AndroidImageCollectionImage.findAll({
    where: { imageCollectionid: imageCollectionModel.id },
  });
  imageCollectionModel.set('status', AndroidModuleStatus.LIVE);
  if (imageCollectionModel.status === AndroidModuleStatus.LIVE) {
    // set status "saved" for all other "published" appCopyValue models
    let restImageCollectionModels: AndroidImageCollectionModel[] = await AndroidImageCollection.findAll({
      where: {
        storeId: imageCollectionModel.storeId,
        productId: imageCollectionModel.productId,
        status: AndroidModuleStatus.LIVE,
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
  restImageCollectionModel: AndroidImageCollectionModel,
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

export const getCurrentModuleStatus = async (imageCollectionModel: AndroidImageCollectionModel) => {
  if (imageCollectionModel.status.includes(AndroidModuleStatus.PUBLISH_PROGRESS)) {
    return imageCollectionModel.status;
  }
  const countryModels: AndroidCountryModel[] = await AndroidCountry.findAll({
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
  const imagePlacementModels: AndroidImagePlacementModel[] = await AndroidImagePlacement.findAll({
    where: { storeId: imageCollectionModel.storeId, required: true },
  });
  if (imagePlacementModels.length) {
    let notNullSet = new Set<boolean>();
    for (let imagePlacementModel of imagePlacementModels) {
      const imageCollectionImageModel: AndroidImageCollectionImageModel = await AndroidImageCollectionImage.findOne({
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
    await setModelStatus(imageCollectionModel, AndroidModuleStatus.ENDED);
    return AndroidModuleStatus.ENDED;
  } else if (!!imageCollectionModel.deployedTo) {
    await setModelStatus(imageCollectionModel, AndroidModuleStatus.LIVE);
    return AndroidModuleStatus.LIVE;
  } else if (notNullCountries && allRequiredImagePlacementsNotNull) {
    await setModelStatus(imageCollectionModel, AndroidModuleStatus.READY);
    return AndroidModuleStatus.READY;
  } else {
    await setModelStatus(imageCollectionModel, AndroidModuleStatus.DRAFT);
    return AndroidModuleStatus.DRAFT;
  }
};
