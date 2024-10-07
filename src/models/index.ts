import { Sequelize } from 'sequelize';
import { brandFactory } from './Brand';
import { offerFactory } from './Offer';
import { offerTypeFactory } from './OfferType';
import { planFactory } from './Plan';
import { platformFactory } from './Platform';
import { regionFactory } from './Region';
import { remoteLockFactory } from './RemoteLock';
import { roleFactory } from './Role';
import { statusFactory } from './Status';
import { storeFactory } from './Store';
import { userFactory } from './User';
import { environmentConfigFactory } from './EnvironmentConfigs';
import { LOG_LEVEL } from '../util/config';
import { workflowQueueFactory } from './WorkflowQueue';
import { retentionOfferFactory } from './RetentionOffer';
import { userEligibilityFactory } from './UserEligibility';
import { storeTranslationsFactory } from './StoreTranslations';
import { languageFactory } from './Language';
import { currencyFactory } from './Currency';
import { campaignFactory } from './Campaign';
import { AndroidStoreFactory } from './android/Store';
import { AndroidPlatformFactory } from './android/Platform';
import { AndroidCountryFactory } from './android/Country';
import { AndroidLanguageFactory } from './android/Language';
import { AndroidCountryLanguageFactory } from './android/CountryLanguage';
import { AndroidAppCopyFieldFactory } from './android/AppCopyField';
import { AndroidAppCopyFactory } from './android/AppCopy';
import { AndroidAppCopyValueFactory } from './android/AppCopyValue';
import { AndroidProductFactory } from './android/Product';
import { AndroidSkuFieldFactory } from './android/SkuField';
import { AndroidSkuFactory } from './android/Sku';
import { AndroidSkuValueFactory } from './android/SkuValue';
import { AndroidSelectorConfigFactory } from './android/SelectorConfig';
import { AndroidSelectorConfigSkuFactory } from './android/SelectorConfigSku';
import { AndroidCampaignFactory } from './android/Campaign';
import { AndroidCampaignHistoryFactory } from './android/CampaignHistory';
import { AndroidImageGalleryFactory } from './android/ImageGallery';
import { AndroidImagePlacementFactory } from './android/ImagePlacement';
import { AndroidImageCollectionFactory } from './android/ImageCollection';
import { AndroidImageCollectionImageFactory } from './android/ImageCollectionImage';
import { AndroidStoreCopyFieldFactory } from './android/StoreCopyField';
import { AndroidStoreCopyValueFactory } from './android/StoreCopyValue';
import { AndroidStoreCopyFactory } from './android/StoreCopy';
import { offerHistoryFactory } from './OfferHistory';
import { StateFactory } from './State';
import { RokuStoreFactory } from './roku/Store';
import { RokuProductFactory } from './roku/Product';
import { RokuPlatformFactory } from './roku/Platform';
import { RokuCountryFactory } from './roku/Country';
import { RokuLanguageFactory } from './roku/Language';
import { RokuCountryLanguageFactory } from './roku/CountryLanguage';
import { RokuAppCopyFieldFactory } from './roku/AppCopyField';
import { RokuAppCopyFactory } from './roku/AppCopy';
import { RokuAppCopyValueFactory } from './roku/AppCopyValue';
import { RokuSkuFieldFactory } from './roku/SkuField';
import { RokuSkuFactory } from './roku/Sku';
import { RokuSkuValueFactory } from './roku/SkuValue';
import { RokuSelectorConfigFactory } from './roku/SelectorConfig';
import { RokuSelectorConfigSkuFactory } from './roku/SelectorConfigSku';
import { RokuCampaignFactory } from './roku/Campaign';
import { RokuCampaignHistoryFactory } from './roku/CampaignHistory';
import { RokuImageGalleryFactory } from './roku/ImageGallery';
import { RokuImagePlacementFactory } from './roku/ImagePlacement';
import { RokuImageCollectionFactory } from './roku/ImageCollection';
import { RokuImageCollectionImageFactory } from './roku/ImageCollectionImage';
import { RokuStoreCopyFieldFactory } from './roku/StoreCopyField';
import { RokuStoreCopyFactory } from './roku/StoreCopy';
import { RokuStoreCopyValueFactory } from './roku/StoreCopyValue';
import { slackConfigFactory } from './SlackConfig';
import { AndroidEnvironmentsFactory } from './android/AndroidEnvironments';
import { RokuEnvironmentsFactory } from './roku/RokuEnvironments';
import { extensionOfferFactory } from './web/ExtensionOffer';
import { dpeConfigFactory } from './DPEConfig';

//TODO:
export const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PWD,
  {
    port: Number(process.env.DB_PORT) || 3306,
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    pool: {
      min: 0,
      max: 5,
      acquire: 30000,
      idle: 10000,
    },
    logging: LOG_LEVEL.toLowerCase() === 'debug',
  },
);

// Web Factories
export const Brand = brandFactory(db);
export const Offer = offerFactory(db);
export const OfferHistory = offerHistoryFactory(db);
export const OfferType = offerTypeFactory(db);
export const Plan = planFactory(db);
export const Platform = platformFactory(db);
export const Region = regionFactory(db);
export const RemoteLock = remoteLockFactory(db);
export const WorkflowQueue = workflowQueueFactory(db);
export const Role = roleFactory(db);
export const Status = statusFactory(db);
export const Store = storeFactory(db);
export const User = userFactory(db);
export const RetentionOffer = retentionOfferFactory(db);
export const UserEligibility = userEligibilityFactory(db);
export const StoreTranslations = storeTranslationsFactory(db);
export const Language = languageFactory(db);
export const Currency = currencyFactory(db);
export const Campaign = campaignFactory(db);
export const SlackConfig = slackConfigFactory(db);
export const EnvironmentConfig = environmentConfigFactory(db);
export const ExtensionOffer = extensionOfferFactory(db);

// Android Factories
export const AndroidStore = AndroidStoreFactory(db);
export const AndroidProduct = AndroidProductFactory(db);
export const AndroidPlatform = AndroidPlatformFactory(db);
export const AndroidCountry = AndroidCountryFactory(db);
export const AndroidLanguage = AndroidLanguageFactory(db);
export const AndroidCountryLanguage = AndroidCountryLanguageFactory(db);
export const AndroidAppCopyField = AndroidAppCopyFieldFactory(db);
export const AndroidAppCopy = AndroidAppCopyFactory(db);
export const AndroidAppCopyValue = AndroidAppCopyValueFactory(db);
export const AndroidSkuField = AndroidSkuFieldFactory(db);
export const AndroidSku = AndroidSkuFactory(db);
export const AndroidSkuValue = AndroidSkuValueFactory(db);
export const AndroidSelectorConfig = AndroidSelectorConfigFactory(db);
export const AndroidSelectorConfigSku = AndroidSelectorConfigSkuFactory(db);
export const AndroidCampaign = AndroidCampaignFactory(db);
export const AndroidCampaignHistory = AndroidCampaignHistoryFactory(db);
export const AndroidImageGallery = AndroidImageGalleryFactory(db);
export const AndroidImagePlacement = AndroidImagePlacementFactory(db);
export const AndroidImageCollection = AndroidImageCollectionFactory(db);
export const AndroidImageCollectionImage = AndroidImageCollectionImageFactory(
  db,
);
export const AndroidStoreCopyField = AndroidStoreCopyFieldFactory(db);
export const AndroidStoreCopy = AndroidStoreCopyFactory(db);
export const AndroidStoreCopyValue = AndroidStoreCopyValueFactory(db);
export const AndroidEnvironments = AndroidEnvironmentsFactory(db);

// Roku Factories
export const RokuStore = RokuStoreFactory(db);
export const RokuProduct = RokuProductFactory(db);
export const RokuPlatform = RokuPlatformFactory(db);
export const RokuCountry = RokuCountryFactory(db);
export const RokuLanguage = RokuLanguageFactory(db);
export const RokuCountryLanguage = RokuCountryLanguageFactory(db);
export const RokuAppCopyField = RokuAppCopyFieldFactory(db);
export const RokuAppCopy = RokuAppCopyFactory(db);
export const RokuAppCopyValue = RokuAppCopyValueFactory(db);
export const RokuSkuField = RokuSkuFieldFactory(db);
export const RokuSku = RokuSkuFactory(db);
export const RokuSkuValue = RokuSkuValueFactory(db);
export const RokuSelectorConfig = RokuSelectorConfigFactory(db);
export const RokuSelectorConfigSku = RokuSelectorConfigSkuFactory(db);
export const RokuCampaign = RokuCampaignFactory(db);
export const RokuCampaignHistory = RokuCampaignHistoryFactory(db);
export const RokuImageGallery = RokuImageGalleryFactory(db);
export const RokuImagePlacement = RokuImagePlacementFactory(db);
export const RokuImageCollection = RokuImageCollectionFactory(db);
export const RokuImageCollectionImage = RokuImageCollectionImageFactory(
  db,
);
export const RokuStoreCopyField = RokuStoreCopyFieldFactory(db);
export const RokuStoreCopy = RokuStoreCopyFactory(db);
export const RokuStoreCopyValue = RokuStoreCopyValueFactory(db);
export const RokuEnvironments = RokuEnvironmentsFactory(db);
export const DPEConfig = dpeConfigFactory(db);

// additional Factories
export const State = StateFactory(db);

// Offer associations
Offer.belongsTo(Plan, {
  foreignKey: {
    name: 'planCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Offer.belongsTo(OfferType, {
  foreignKey: {
    name: 'offerTypeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Offer.belongsTo(Status, {
  foreignKey: {
    name: 'statusId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Offer.belongsTo(User, {
  foreignKey: {
    name: 'createdBy',
  },
  as: 'createdByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Offer.belongsTo(User, {
  foreignKey: {
    name: 'lastModifiedBy',
  },
  as: 'lastModifiedByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Offer.belongsTo(Campaign, {
  foreignKey: {
    name: 'campaign',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// OfferHistory associations
OfferHistory.belongsTo(Offer, {
  foreignKey: {
    name: 'OfferCode',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
OfferHistory.belongsTo(Status, {
  foreignKey: {
    name: 'statusId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Plan associations
Plan.belongsTo(Store, {
  foreignKey: {
    name: 'storeCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Plan.belongsTo(Status, {
  foreignKey: {
    name: 'statusId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Plan.belongsTo(User, {
  foreignKey: {
    name: 'createdBy',
  },
  as: 'createdByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Plan.belongsTo(User, {
  foreignKey: {
    name: 'lastModifiedBy',
  },
  as: 'lastModifiedByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Store associations
Store.belongsTo(Platform, {
  foreignKey: {
    name: 'platformCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Store.belongsTo(Brand, {
  foreignKey: {
    name: 'brandCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
Store.belongsTo(Region, {
  foreignKey: {
    name: 'regionCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
// Users associations
User.belongsTo(Role, {
  foreignKey: {
    name: 'roleId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Retention Offer associations
RetentionOffer.belongsTo(Store, {
  foreignKey: {
    name: 'storeCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RetentionOffer.belongsTo(Status, {
  foreignKey: {
    name: 'statusId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RetentionOffer.belongsTo(User, {
  foreignKey: {
    name: 'createdBy',
  },
  as: 'createdByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RetentionOffer.belongsTo(User, {
  foreignKey: {
    name: 'lastModifiedBy',
  },
  as: 'lastModifiedByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RetentionOffer.belongsTo(Campaign, {
  foreignKey: {
    name: 'campaign',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Extension Offer associations
ExtensionOffer.belongsTo(Store, {
  foreignKey: {
    name: 'storeCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
ExtensionOffer.belongsTo(Status, {
  foreignKey: {
    name: 'statusId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
ExtensionOffer.belongsTo(User, {
  foreignKey: {
    name: 'createdBy',
  },
  as: 'createdByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
ExtensionOffer.belongsTo(User, {
  foreignKey: {
    name: 'lastModifiedBy',
  },
  as: 'lastModifiedByUser',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Language associations
Region.belongsTo(Language, {
  foreignKey: {
    name: 'regionCode',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Currency associations
Region.belongsTo(Currency, {
  foreignKey: 'currency',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

/* ------------------------------------------------------------------------------------------------------------------------------------------- */
/* ------------------------------------------------------- ANDROID ASSOCIATIONS -------------------------------------------------------------- */
/* ------------------------------------------------------------------------------------------------------------------------------------------- */

// Android_Country associations
AndroidCountry.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCountry.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_CountryLanguage associations
AndroidCountryLanguage.belongsTo(AndroidCountry, {
  foreignKey: {
    name: 'countryId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidCountryLanguage.belongsTo(AndroidLanguage, {
  foreignKey: {
    name: 'languageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Android_AppCopyField associations
AndroidAppCopyField.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidAppCopyField.belongsTo(AndroidPlatform, {
  foreignKey: {
    name: 'platformId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_AppCopy associations
AndroidAppCopy.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidAppCopy.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_AppCopyValue associations
AndroidAppCopyValue.belongsTo(AndroidAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidAppCopyValue.belongsTo(AndroidPlatform, {
  foreignKey: {
    name: 'platformId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidAppCopyValue.belongsTo(AndroidCountryLanguage, {
  foreignKey: {
    name: 'countryLanguageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidAppCopyValue.belongsTo(AndroidAppCopyField, {
  foreignKey: {
    name: 'appCopyFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_SkuField associations
AndroidSkuField.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_Sku associations
AndroidSku.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidSku.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_SkuValue associations
AndroidSkuValue.belongsTo(AndroidSku, {
  foreignKey: {
    name: 'skuId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidSkuValue.belongsTo(AndroidCountryLanguage, {
  foreignKey: {
    name: 'countryLanguageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidSkuValue.belongsTo(AndroidSkuField, {
  foreignKey: {
    name: 'skuFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_SelectorConfig associations
AndroidSelectorConfig.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidSelectorConfig.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_SelectorConfigSku associations
AndroidSelectorConfigSku.belongsTo(AndroidSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidSelectorConfigSku.belongsTo(AndroidSku, {
  foreignKey: {
    name: 'skuId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidSelectorConfigSku.belongsTo(AndroidCountry, {
  foreignKey: {
    name: 'countryId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Android_ImageGallery associations
AndroidImageGallery.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidImageGallery.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_ImagePlacement associations
AndroidImagePlacement.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_ImageCollection associations
AndroidImageCollection.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidImageCollection.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_ImageCollectionImage associations
AndroidImageCollectionImage.belongsTo(AndroidImageCollection, {
  foreignKey: {
    name: 'imageCollectionId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidImageCollectionImage.belongsTo(AndroidImagePlacement, {
  foreignKey: {
    name: 'imagePlacementId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidImageCollectionImage.belongsTo(AndroidImageGallery, {
  foreignKey: {
    name: 'imageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Android_StoreCopyFields associations
AndroidStoreCopyField.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_StoreCopy associations
AndroidStoreCopy.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidStoreCopy.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_StoreCopyValue associations
AndroidStoreCopyValue.belongsTo(AndroidStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidStoreCopyValue.belongsTo(AndroidLanguage, {
  foreignKey: {
    name: 'languageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
AndroidStoreCopyValue.belongsTo(AndroidStoreCopyField, {
  foreignKey: {
    name: 'storeCopyFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_Campaign associations
AndroidCampaign.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaign.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaign.belongsTo(AndroidAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaign.belongsTo(AndroidSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaign.belongsTo(AndroidSku, {
  foreignKey: {
    name: 'winbackSkuId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaign.belongsTo(AndroidStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Android_CampaignHistory associations
AndroidCampaignHistory.belongsTo(AndroidStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaignHistory.belongsTo(AndroidProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaignHistory.belongsTo(AndroidAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaignHistory.belongsTo(AndroidSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaignHistory.belongsTo(AndroidSku, {
  foreignKey: {
    name: 'winbackSkuId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
AndroidCampaignHistory.belongsTo(AndroidStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

/* ------------------------------------------------------------------------------------------------------------------------------------------- */
/* --------------------------------------------------------- ROKU ASSOCIATIONS --------------------------------------------------------------- */
/* ------------------------------------------------------------------------------------------------------------------------------------------- */

// Roku_Country associations
RokuCountry.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCountry.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_CountryLanguage associations
RokuCountryLanguage.belongsTo(RokuCountry, {
  foreignKey: {
    name: 'countryId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuCountryLanguage.belongsTo(RokuLanguage, {
  foreignKey: {
    name: 'languageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Roku_AppCopyField associations
RokuAppCopyField.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuAppCopyField.belongsTo(RokuPlatform, {
  foreignKey: {
    name: 'platformId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_AppCopy associations
RokuAppCopy.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuAppCopy.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_AppCopyValue associations
RokuAppCopyValue.belongsTo(RokuAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuAppCopyValue.belongsTo(RokuPlatform, {
  foreignKey: {
    name: 'platformId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuAppCopyValue.belongsTo(RokuCountryLanguage, {
  foreignKey: {
    name: 'countryLanguageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuAppCopyValue.belongsTo(RokuAppCopyField, {
  foreignKey: {
    name: 'appCopyFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_SkuField associations
RokuSkuField.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_Sku associations
RokuSku.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuSku.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_SkuValue associations
RokuSkuValue.belongsTo(RokuSku, {
  foreignKey: {
    name: 'skuId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuSkuValue.belongsTo(RokuCountryLanguage, {
  foreignKey: {
    name: 'countryLanguageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuSkuValue.belongsTo(RokuSkuField, {
  foreignKey: {
    name: 'skuFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_SelectorConfig associations
RokuSelectorConfig.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuSelectorConfig.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_SelectorConfigSku associations
RokuSelectorConfigSku.belongsTo(RokuSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuSelectorConfigSku.belongsTo(RokuSku, {
  foreignKey: {
    name: 'skuId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuSelectorConfigSku.belongsTo(RokuCountry, {
  foreignKey: {
    name: 'countryId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Roku_ImageGallery associations
RokuImageGallery.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuImageGallery.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_ImagePlacement associations
RokuImagePlacement.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_ImageCollection associations
RokuImageCollection.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuImageCollection.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_ImageCollectionImage associations
RokuImageCollectionImage.belongsTo(RokuImageCollection, {
  foreignKey: {
    name: 'imageCollectionId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuImageCollectionImage.belongsTo(RokuImagePlacement, {
  foreignKey: {
    name: 'imagePlacementId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuImageCollectionImage.belongsTo(RokuImageGallery, {
  foreignKey: {
    name: 'imageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});

// Roku_StoreCopyFields associations
RokuStoreCopyField.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_StoreCopy associations
RokuStoreCopy.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuStoreCopy.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_StoreCopyValue associations
RokuStoreCopyValue.belongsTo(RokuStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuStoreCopyValue.belongsTo(RokuLanguage, {
  foreignKey: {
    name: 'languageId',
  },
  onDelete: 'CASCADE',
  onUpdate: 'NO ACTION',
});
RokuStoreCopyValue.belongsTo(RokuStoreCopyField, {
  foreignKey: {
    name: 'storeCopyFieldId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_Campaign associations
RokuCampaign.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaign.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaign.belongsTo(RokuAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaign.belongsTo(RokuSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaign.belongsTo(RokuSku, {
  foreignKey: {
    name: 'winbackSkuId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaign.belongsTo(RokuStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});

// Roku_CampaignHistory associations
RokuCampaignHistory.belongsTo(RokuStore, {
  foreignKey: {
    name: 'storeId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaignHistory.belongsTo(RokuProduct, {
  foreignKey: {
    name: 'productId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaignHistory.belongsTo(RokuAppCopy, {
  foreignKey: {
    name: 'appCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaignHistory.belongsTo(RokuSelectorConfig, {
  foreignKey: {
    name: 'selectorConfigId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaignHistory.belongsTo(RokuSku, {
  foreignKey: {
    name: 'winbackSkuId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
RokuCampaignHistory.belongsTo(RokuStoreCopy, {
  foreignKey: {
    name: 'storeCopyId',
  },
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
});
