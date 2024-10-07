import {
  AndroidModulesEnum,
  AndroidModuleStatus,
  AndroidBundleStatus,
} from '../../types/enum';

export const getAndroidModuleTypeName = (moduleType: number) => {
  switch (moduleType) {
    case 0:
      return 'Campaign';
    case 1:
      return 'Acquisition Offer';
    case 2:
      return 'Renewal Offer';
    case 3:
      return 'App Copy';
    case 4:
      return 'Store Copy';
    case 5:
      return 'Images';
    case 6:
      return 'SKU';
    case 7:
      return 'Selector Config';
    case 8:
      return 'Gallery';
  }
};

export const getModuleStatus = (body: any, moduleType: number): string => {
  if (!body.status) {
    const mobileCopy = body.mobileCopy;
    const ftCopy = body.ftCopy;
    const mobileCopyStatuses: any[] = [];
    const ftCopyStatuses: any[] = [];

    if (mobileCopy) {
      Object.values(mobileCopy).forEach((region: any) => {
        mobileCopyStatuses.push(region.status);
      });
    }
    if (ftCopy) {
      Object.values(ftCopy).forEach((region: any) => {
        ftCopyStatuses.push(region.status);
      });
    }

    if (
      mobileCopyStatuses.every((elem) => elem === 'saved') ||
      ftCopyStatuses.every((elem) => elem === 'saved')
    ) {
      return AndroidModulesEnum.APP_COPY === moduleType
        ? AndroidModuleStatus.READY
        : AndroidBundleStatus.ACTIVE;
    } else {
      return AndroidModulesEnum.APP_COPY === moduleType
        ? AndroidModuleStatus.DRAFT
        : AndroidBundleStatus.DRAFT;
    }
  } else {
    return body.status;
  }
};

export const getAndroidModulePackageName = (module: any): string => {
  const moduleType: number = Number(module.moduleUniqueId.charAt(0));
  switch (moduleType) {
    case 0:
      return module.moduleUniqueId;
    case 1:
      return module.moduleUniqueId;
    case 2:
      return module.moduleUniqueId;
    case 3:
      return module.data['packageName'];
    case 4:
      return module.moduleUniqueId;
    case 5:
      return module.data['bundleName'];
    case 6:
      return module.data['skuName'];
    case 7:
      return module.data['selectorConfigName'];
  }
};

export const getCurrentDate = () => {
  const currentDate = new Date();
  return currentDate.toString();
};

export const setModuleEnv = (model: any, env: string, param: string) => {
  if (model[param] === null) {
    model.set(param, env);
  } else {
    if (!model[param].includes(env)) {
      const newEnv = `${model[param]}-${env}`;
      model.set(param, newEnv);
    }
  }
};

export {
  getAllCountry,
  saveCountry,
  getCountry,
  deleteCountry,
  updateCountry,
} from './country';
export {
  getAllLanguage,
  getLanguage,
  saveLanguage,
  updateLanguage,
  deleteLanguage,
} from './language';
export {
  getAppCopyFields,
  getAllAppCopy,
  getAppCopy,
  saveAppCopy,
  updateAppCopy,
  publishAppCopyList,
  duplicateAppCopy,
  promoteAppCopy,
  pullPromotionAppCopy,
  getDuplicateAppCopyData,
  getAppCopyUsage,
} from './appCopy';
export { getAllStore } from './store';
export { getAllProduct } from './product';
export { validatePRODPassword } from './validatePassword';
export {
  getSkuFields,
  getAllSku,
  getSku,
  saveSku,
  updateSku,
  archiveSku,
  getSkuUsage,
  getSkuSelectPreviewImages,
  publishSkuList,
  promoteSku,
  pullPromotionSku,
} from './sku';
export {
  getAllSelectorConfig,
  getSelectorConfig,
  saveSelectorConfig,
  updateSelectorConfig,
  publishSelectorConfig,
  getSelectorConfigUsage,
} from './selectorConfig';
export {
  getAllCampaign,
  getCampaign,
  saveCampaign,
  updateCampaign,
  publishCampaign,
} from './campaign';
export {
  getStoreCopyFields,
  getAllStoreCopy,
  getStoreCopy,
  saveStoreCopy,
  updateStoreCopy,
  publishStoreCopy,
  getStoreCopyUsage,
} from './storeCopy';
export { getAndroidEnv } from './env';
export {
  getAllImagePlacement,
  getAllImageGallery,
  saveImageGallery,
  getAllImageCollection,
  getImageCollection,
  saveImageCollection,
  updateImageCollection,
  publishImageCollection,
  getUsageOfImageInImageCollections,
  getImageCollectionUsage,
} from './image';
export { getAllCampaignHistory, getCampaignHistory } from './campaignHistory';
export {
  getPublishingOverwriteWarningMessage,
  deleteModuleById,
} from './multiModules';
export { uploadAndroidImage } from '../../services/S3';
