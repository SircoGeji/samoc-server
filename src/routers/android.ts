import * as controller from '../controllers/android';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');
import multer = require('multer');

const Android = express.Router({ mergeParams: true });

/**
 * Get Android stores list
 * GET /api/android/stores
 */
Android.get('/store', controller.getAllStore);

/**
 * Get Android products list
 * GET /api/android/products
 */
Android.get('/product', controller.getAllProduct);

/**
 * Get all Android regions for specific store and product
 * GET /api/android/country?store&product
 */
Android.get('/country', controller.getAllCountry);

/**
 * Save Android country-languages by store and query platform
 * POST /api/android/country/save?store&product
 */
Android.post('/country/save', controller.saveCountry);

/**
 * Update Android country-languages by countryId
 * PUT /api/android/country/:countryId
 */
Android.put('/country/:countryId/update', controller.updateCountry);

/**
 * Get Android region by countryId
 * GET /api/android/country/:countryId
 */
Android.get('/country/:countryId', controller.getCountry);

/**
 * Delete a draft Android country-languages in DB by countryId
 * DELETE /api/android/country/:countryId/delete
 */
Android.delete('/country/:countryId/delete', controller.deleteCountry);

/**
 * Get all Android languages by store and product
 * GET /api/android/language?store&product
 */
Android.get('/language', controller.getAllLanguage);

/**
 * Get Android language by languageId
 * GET /api/android/language/:languageId
 */
Android.get('/language/:languageId', controller.getLanguage);

/**
 * Save Android language
 * POST /api/android/language/save
 */
Android.post('/language/save', controller.saveLanguage);

/**
 * Update Android language by languageId
 * PUT /api/android/language/:languageId/update
 */
Android.put('/language/:languageId/update', controller.updateLanguage);

/**
 * Delete Android language by languageId
 * DELETE /api/android/language/:languageId/delete
 */
Android.delete('/language/:languageId/delete', controller.deleteLanguage);

/**
 * Get Android AppCopy fields list by store and query platform
 * GET /api/android/app-copy/fields?store&platform&product
 */
Android.get('/app-copy/fields', controller.getAppCopyFields);

/**
 * Get all Android AppCopy modules
 * GET /api/android/app-copy?store&product
 */
Android.get('/app-copy', controller.getAllAppCopy);

/**
 * Get Android AppCopy module by appCopyId
 * GET /api/android/app-copy/:appCopyId
 */
Android.get('/app-copy/:appCopyId', controller.getAppCopy);

/**
 * Save Android AppCopy module by store and product
 * POST /api/android/app-copy/save?store&product
 */
Android.post('/app-copy/save', controller.saveAppCopy);

/**
 * Update Android AppCopy module by appCopyId
 * PUT /api/android/app-copy/:appCopyId/update
 */
Android.put('/app-copy/:appCopyId/update', controller.updateAppCopy);

/**
 * Delete Android AppCopy module by appCopyId
 * PUT /api/android/app-copy/:appCopyId/delete
 */
Android.delete('/app-copy/:appCopyId/delete', controller.deleteModuleById);

/**
 * Publish Android AppCopy modules list
 * POST /api/android/app-copy/publish
 */
Android.post('/app-copy/publish', controller.publishAppCopyList);

/**
 * Duplicate Android AppCopy module by appCopyId
 * POST /api/android/app-copy/:appCopyId/duplicate
 */
Android.post('/app-copy/:appCopyId/duplicate', controller.duplicateAppCopy);

/**
 * Promote Android AppCopy module by appCopyId
 * POST /api/android/app-copy/:appCopyId/promote
 */
Android.post('/app-copy/:appCopyId/promote', controller.promoteAppCopy);

/**
 * Pull Android promotion AppCopy module by appCopyId to it's promotion module
 * POST /api/android/app-copy/:appCopyId/pull?acceptChanges
 */
Android.post('/app-copy/:appCopyId/pull', controller.pullPromotionAppCopy);

/**
 * Duplicate] Android AppCopy module by appCopyId
 * POST /api/android/app-copy/:appCopyId/duplicate-data
 */
Android.get('/app-copy/:appCopyId/duplicate-data', controller.getDuplicateAppCopyData);

/**
 * Get Android AppCopy module usage in any campaign
 * GET /api/android/app-copy/:appCopyId/usage
 */
Android.get('/app-copy/:appCopyId/usage', controller.getAppCopyUsage);

/**
 * Validate Android publish on PROD password
 * GET /api/android/prod/:password/validate
 */
Android.get('/prod/:password/validate', controller.validatePRODPassword);

/**
 * Get Android Sku fields list by store
 * GET /api/android/sku/fields?store&product
 */
Android.get('/sku/fields', controller.getSkuFields);

/**
 * Get Android Sku images preview list by product
 * GET /api/android/sku/preview?product
 */
Android.get('/sku/preview', controller.getSkuSelectPreviewImages);

/**
 * Get all Android SKU modules
 * GET /api/android/sku?store&product
 */
Android.get('/sku', controller.getAllSku);

/**
 * Get Android SKU module by skuId
 * GET /api/android/sku/:skuId
 */
Android.get('/sku/:skuId', controller.getSku);

/**
 * Save Android Sku module by store and product
 * POST /api/android/sku/save?store&product
 */
Android.post('/sku/save', controller.saveSku);

/**
 * Update Android Sku module by skuId
 * PUT /api/android/sku/:skuId/update
 */
Android.put('/sku/:skuId/update', controller.updateSku);

/**
 * Archive Android Sku module by skuId
 * PUT /api/android/sku/:skuId/archive
 */
Android.put('/sku/:skuId/archive', controller.archiveSku);

/**
 * Delete Android Sku module by skuId
 * PUT /api/android/sku/:skuId/delete
 */
Android.delete('/sku/:skuId/delete', controller.deleteModuleById);

/**
 * Get Android Sku module usage in any campaign
 * GET /api/android/sku/:skuId/usage
 */
Android.get('/sku/:skuId/usage', controller.getSkuUsage);

/**
 * Publish Android Sku modules list
 * POST /api/android/sku/publish
 */
Android.post('/sku/publish', controller.publishSkuList);

/**
 * Promote Android Sku module by skuId
 * POST /api/android/sku/:skuId/promote
 */
Android.post('/sku/:skuId/promote', controller.promoteSku);

/**
 * Pull Android promotion Sku module by skuId to it's promotion module
 * POST /api/android/sku/:skuId/pull?acceptChanges
 */
Android.post('/sku/:skuId/pull', controller.pullPromotionSku);

/**
 * Get all Android SelectorConfig modules
 * GET /api/android/selector-config?store&product
 */
Android.get('/selector-config', controller.getAllSelectorConfig);

/**
 * Get Android SelectorConfig module by selectorConfigId
 * GET /api/android/selector-config/:selectorConfigId
 */
Android.get('/selector-config/:selectorConfigId', controller.getSelectorConfig);

/**
 * Save Android SelectorConfig module by store and product
 * POST /api/android/selector-config/save?store&product
 */
Android.post('/selector-config/save', controller.saveSelectorConfig);

/**
 * Update Android SelectorConfig module by selectorConfigId
 * PUT /api/android/selector-config/:selectorConfigId/update
 */
Android.put('/selector-config/:selectorConfigId/update', controller.updateSelectorConfig);

/**
 * Publish Android SelectorConfig module by selectorConfigId and environment
 * POST /api/android/selector-config/:selectorConfigId/publish?env
 */
Android.post('/selector-config/:selectorConfigId/publish', controller.publishSelectorConfig);

/**
 * Delete Android SelectorConfig module by selectorConfigId
 * PUT /api/android/selector-config/:selectorConfigId/delete
 */
Android.delete('/selector-config/:selectorConfigId/delete', controller.deleteModuleById);

/**
 * Get Android SelectorConfig module usage in any campaign
 * GET /api/android/selector-config/:selectorConfigId/usage
 */
Android.get('/selector-config/:selectorConfigId/usage', controller.getSelectorConfigUsage);

/**
 * Get Android StoreCopy module fields by store and query platform
 * GET /api/android/store-copy/fields?store&product
 */
Android.get('/store-copy/fields', controller.getStoreCopyFields);

/**
 * Get all Android StoreCopy modules
 * GET /api/android/store-copy?store&product
 */
Android.get('/store-copy', controller.getAllStoreCopy);

/**
 * Get Android StoreCopy module by storeCopyId
 * GET /api/android/store-copy/:storeCopyId
 */
Android.get('/store-copy/:storeCopyId', controller.getStoreCopy);

/**
 * Save Android StoreCopy module by store and product
 * POST /api/android/store-copy/save?store&product
 */
Android.post('/store-copy/save', controller.saveStoreCopy);

/**
 * Update Android StoreCopy module by storeCopyId
 * PUT /api/android/store-copy/:storeCopyId/update
 */
Android.put('/store-copy/:storeCopyId/update', controller.updateStoreCopy);

/**
 * Publish Android StoreCopy module by storeCopyId and environment
 * POST /api/android/store-copy/:storeCopyId/publish?env
 */
Android.post('/store-copy/:storeCopyId/publish', controller.publishStoreCopy);

/**
 * Delete Android StoreCopy module by storeCopyId
 * PUT /api/android/store-copy/:storeCopyId/delete
 */
Android.delete('/store-copy/:storeCopyId/delete', controller.deleteModuleById);

/**
 * Get Android StoreCopy module usage in any campaign
 * GET /api/android/store-copy/:storeCopyId/usage
 */
Android.get('/store-copy/:storeCopyId/usage', controller.getStoreCopyUsage);

/**
 * Get Android environments list
 * GET /api/android/env
 */
Android.get('/env/', controller.getAndroidEnv);

/**
 * Get all Android ImagePlacement modules by store
 * GET /api/android/image/placement?store&product
 */
Android.get('/image/placement', controller.getAllImagePlacement);

/**
 * Get all Android ImageGallery modules by store and product
 * GET /api/android/image/gallery?store&product
 */
Android.get('/image/gallery/', controller.getAllImageGallery);

/**
 * Save Android ImageGallery module by store and product
 * POST /api/android/image/gallery/save?store&product
 */
Android.post('/image/gallery/save', controller.saveImageGallery);

/**
 * Get usage of ImageGallery module in ImageCollections modules
 * GET /api/android/image/gallery/:imageId/collections
 */
Android.get('/image/gallery/:imageId/collections', controller.getUsageOfImageInImageCollections);

/**
 * Delete Android ImageGallery module by imageId
 * DELETE /api/android/image/gallery/save?store&product
 */
Android.delete('/image/gallery/:imageId/delete', controller.deleteModuleById);

/**
 * Get all Android ImageCollection modules by store and product
 * GET /api/android/image/collection?store&product
 */
Android.get('/image/collection/', controller.getAllImageCollection);

/**
 * Get all Android ImageCollection module by imageCollectionId
 * GET /api/android/image/collection/:imageCollectionId
 */
Android.get('/image/collection/:imageCollectionId', controller.getImageCollection);

/**
 * Save Android ImageCollection module by store and product
 * POST /api/android/image/collection/save?store&product
 */
Android.post('/image/collection/save', controller.saveImageCollection);

/**
 * Update Android ImageCollection module by imageCollectionId
 * PUT /api/android/image/collection/:imageCollectionId/update
 */
Android.put('/image/collection/:imageCollectionId/update', controller.updateImageCollection);

/**
 * Publish Android ImageCollection module by imageCollectionId and environment
 * POST /api/android/image/collection/:imageCollectionId/publish?env
 */
Android.post('/image/collection/:imageCollectionId/publish', controller.publishImageCollection);

/**
 * Delete Android ImageCollection module by imageCollectionId
 * PUT /api/android/image/collection/:imageCollectionId/delete
 */
Android.delete('/image/collection/:imageCollectionId/delete', controller.deleteModuleById);

/**
 * Get Android ImageCollection module usage in any campaign
 * GET /api/android/image/collection/:imageCollectionId/usage
 */
Android.get('/image/collection/:imageCollectionId/usage', controller.getImageCollectionUsage);

/**
 * Upload image to S3 bucket by directory and query store & product
 * POST /api/android/:directory/uploadImage?store&product
 */
Android.post('/:directory/uploadImage', multer().array('uploadImage'), controller.uploadAndroidImage);

/**
 * Get all Android Campaign modules
 * GET /api/android/campaign?store&product
 */
Android.get('/campaign', controller.getAllCampaign);

/**
 * Get Android Campaign module by campaignId
 * GET /api/android/campaign/:campaignId
 */
Android.get('/campaign/:campaignId', controller.getCampaign);

/**
 * Save Android Campaign module by store and product
 * POST /api/android/campaign/save?store&product
 */
Android.post('/campaign/save', controller.saveCampaign);

/**
 * Update Android Campaign module by campaignId
 * PUT /api/android/campaign/:campaignId/update
 */
Android.put('/campaign/:campaignId/update', controller.updateCampaign);

/**
 * Publish Android Campaign module by campaignId and environment
 * POST /api/android/campaign/:campaignId/publish?env
 */
Android.post('/campaign/:campaignId/publish', controller.publishCampaign);

/**
 * Delete Android Campaign module by campaignId
 * PUT /api/android/campaign/:campaignId/delete
 */
Android.delete('/campaign/:campaignId/delete', controller.deleteModuleById);

/**
 * Get all Android CampaignHistory modules
 * GET /api/android/campaign/history?store&product
 */
Android.get('/campaign-history', controller.getAllCampaignHistory);

/**
 * Get Android Campaign module by campaignHistoryId
 * GET /api/android/campaign/history/:campaignHistoryId
 */
Android.get('/campaign-history/:campaignHistoryId', controller.getCampaignHistory);

/**
 * Delete Android CampaignHistory module by campaignHistoryId
 * PUT /api/android/campaign-history/:campaignHistoryId/delete
 */
Android.delete('/campaign-history/:campaignHistoryId/delete', controller.deleteModuleById);

/**
 * Get Android modules publishing overwrite warning messages by moduleName, id and environment
 * GET /api/android/publish/:moduleName/:id?env
 */
Android.get('/publish/:moduleName/:id', controller.getPublishingOverwriteWarningMessage);

/**
 * Not allowed handler
 */
Android.all('/', returnNotAllowed(['get', 'post']));

export default Android;
