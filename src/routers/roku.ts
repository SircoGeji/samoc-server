import * as controller from '../controllers/roku';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');
import multer = require('multer');

const Roku = express.Router({ mergeParams: true });

/**
 * Get Roku stores list
 * GET /api/roku/stores
 */
Roku.get('/store', controller.getAllStore);

/**
 * Get Roku products list
 * GET /api/roku/products
 */
Roku.get('/product', controller.getAllProduct);

/**
 * Get all Roku regions for specific store and product
 * GET /api/roku/country?store&product
 */
Roku.get('/country', controller.getAllCountry);

/**
 * Save Roku country-languages by store and query platform
 * POST /api/roku/country/save?store&product
 */
Roku.post('/country/save', controller.saveCountry);

/**
 * Update Roku country-languages by countryId
 * PUT /api/roku/country/:countryId
 */
Roku.put('/country/:countryId/update', controller.updateCountry);

/**
 * Get Roku region by countryId
 * GET /api/roku/country/:countryId
 */
Roku.get('/country/:countryId', controller.getCountry);

/**
 * Delete a draft Roku country-languages in DB by countryId
 * DELETE /api/roku/country/:countryId/delete
 */
Roku.delete('/country/:countryId/delete', controller.deleteCountry);

/**
 * Get all Roku languages by store and product
 * GET /api/roku/language?store&product
 */
Roku.get('/language', controller.getAllLanguage);

/**
 * Get Roku language by languageId
 * GET /api/roku/language/:languageId
 */
Roku.get('/language/:languageId', controller.getLanguage);

/**
 * Save Roku language
 * POST /api/roku/language/save
 */
Roku.post('/language/save', controller.saveLanguage);

/**
 * Update Roku language by languageId
 * PUT /api/roku/language/:languageId/update
 */
Roku.put('/language/:languageId/update', controller.updateLanguage);

/**
 * Delete Roku language by languageId
 * DELETE /api/roku/language/:languageId/delete
 */
Roku.delete('/language/:languageId/delete', controller.deleteLanguage);

/**
 * Get Roku AppCopy fields list by store and query platform
 * GET /api/roku/app-copy/fields?store&platform&product
 */
Roku.get('/app-copy/fields', controller.getAppCopyFields);

/**
 * Get all Roku AppCopy modules
 * GET /api/roku/app-copy?store&product
 */
Roku.get('/app-copy', controller.getAllAppCopy);

/**
 * Get Roku AppCopy module by appCopyId
 * GET /api/roku/app-copy/:appCopyId
 */
Roku.get('/app-copy/:appCopyId', controller.getAppCopy);

/**
 * Save Roku AppCopy module by store and product
 * POST /api/roku/app-copy/save?store&product
 */
Roku.post('/app-copy/save', controller.saveAppCopy);

/**
 * Update Roku AppCopy module by appCopyId
 * PUT /api/roku/app-copy/:appCopyId/update
 */
Roku.put('/app-copy/:appCopyId/update', controller.updateAppCopy);

/**
 * Delete Roku AppCopy module by appCopyId
 * PUT /api/roku/app-copy/:appCopyId/delete
 */
Roku.delete('/app-copy/:appCopyId/delete', controller.deleteModuleById);

/**
 * Publish Roku AppCopy modules list
 * POST /api/roku/app-copy/publish
 */
Roku.post('/app-copy/publish', controller.publishAppCopyList);

/**
 * Duplicate] Roku AppCopy module by appCopyId
 * POST /api/roku/app-copy/:appCopyId/duplicate
 */
Roku.post('/app-copy/:appCopyId/duplicate', controller.duplicateAppCopy);

/**
 * Promote Roku AppCopy module by appCopyId
 * POST /api/roku/app-copy/:appCopyId/promote
 */
Roku.post('/app-copy/:appCopyId/promote', controller.promoteAppCopy);

/**
 * Pull Roku promotion AppCopy module by appCopyId to it's promotion module
 * POST /api/roku/app-copy/:appCopyId/pull?acceptChanges
 */
Roku.post('/app-copy/:appCopyId/pull', controller.pullPromotionAppCopy);

/**
 * Duplicate] Roku AppCopy module by appCopyId
 * POST /api/roku/app-copy/:appCopyId/duplicate-data
 */
Roku.get('/app-copy/:appCopyId/duplicate-data', controller.getDuplicateAppCopyData);

/**
 * Get Roku AppCopy module usage in any campaign
 * GET /api/roku/app-copy/:appCopyId/usage
 */
Roku.get('/app-copy/:appCopyId/usage', controller.getAppCopyUsage);

/**
 * Validate Roku publish on PROD password
 * GET /api/roku/prod/:password/validate
 */
Roku.get('/prod/:password/validate', controller.validatePRODPassword);

/**
 * Get Roku Sku fields list by store
 * GET /api/roku/sku/fields?store&product
 */
Roku.get('/sku/fields', controller.getSkuFields);

/**
 * Get Roku Sku images preview list by product
 * GET /api/roku/sku/preview?product
 */
Roku.get('/sku/preview', controller.getSkuSelectPreviewImages);

/**
 * Get all Roku SKU modules
 * GET /api/roku/sku?store&product
 */
Roku.get('/sku', controller.getAllSku);

/**
 * Get Roku SKU module by skuId
 * GET /api/roku/sku/:skuId
 */
Roku.get('/sku/:skuId', controller.getSku);

/**
 * Save Roku Sku module by store and product
 * POST /api/roku/sku/save?store&product
 */
Roku.post('/sku/save', controller.saveSku);

/**
 * Update Roku Sku module by skuId
 * PUT /api/roku/sku/:skuId/update
 */
Roku.put('/sku/:skuId/update', controller.updateSku);

/**
 * Archive Roku Sku module by skuId
 * PUT /api/roku/sku/:skuId/archive
 */
Roku.put('/sku/:skuId/archive', controller.archiveSku);

/**
 * Delete Roku Sku module by skuId
 * PUT /api/roku/sku/:skuId/delete
 */
Roku.delete('/sku/:skuId/delete', controller.deleteModuleById);

/**
 * Get Roku Sku module usage in any campaign
 * GET /api/roku/sku/:skuId/usage
 */
Roku.get('/sku/:skuId/usage', controller.getSkuUsage);

/**
 * Publish Roku Sku modules list
 * POST /api/roku/sku/publish
 */
Roku.post('/sku/publish', controller.publishSkuList);

/**
 * Promote Roku Sku module by skuId
 * POST /api/roku/sku/:skuId/promote
 */
Roku.post('/sku/:skuId/promote', controller.promoteSku);

/**
 * Pull Roku promotion Sku module by skuId to it's promotion module
 * POST /api/roku/sku/:skuId/pull?acceptChanges
 */
Roku.post('/sku/:skuId/pull', controller.pullPromotionSku);

/**
 * Get all Roku SelectorConfig modules
 * GET /api/roku/selector-config?store&product
 */
Roku.get('/selector-config', controller.getAllSelectorConfig);

/**
 * Get Roku SelectorConfig module by selectorConfigId
 * GET /api/roku/selector-config/:selectorConfigId
 */
Roku.get('/selector-config/:selectorConfigId', controller.getSelectorConfig);

/**
 * Save Roku SelectorConfig module by store and product
 * POST /api/roku/selector-config/save?store&product
 */
Roku.post('/selector-config/save', controller.saveSelectorConfig);

/**
 * Update Roku SelectorConfig module by selectorConfigId
 * PUT /api/roku/selector-config/:selectorConfigId/update
 */
Roku.put('/selector-config/:selectorConfigId/update', controller.updateSelectorConfig);

/**
 * Publish Roku SelectorConfig module by selectorConfigId and environment
 * POST /api/roku/selector-config/:selectorConfigId/publish?env
 */
Roku.post('/selector-config/:selectorConfigId/publish', controller.publishSelectorConfig);

/**
 * Delete Roku SelectorConfig module by selectorConfigId
 * PUT /api/roku/selector-config/:selectorConfigId/delete
 */
Roku.delete('/selector-config/:selectorConfigId/delete', controller.deleteModuleById);

/**
 * Get Roku SelectorConfig module usage in any campaign
 * GET /api/roku/selector-config/:selectorConfigId/usage
 */
Roku.get('/selector-config/:selectorConfigId/usage', controller.getSelectorConfigUsage);

/**
 * Get Roku StoreCopy module fields by store and query platform
 * GET /api/roku/store-copy/fields?store&product
 */
Roku.get('/store-copy/fields', controller.getStoreCopyFields);

/**
 * Get all Roku StoreCopy modules
 * GET /api/roku/store-copy?store&product
 */
Roku.get('/store-copy', controller.getAllStoreCopy);

/**
 * Get Roku StoreCopy module by storeCopyId
 * GET /api/roku/store-copy/:storeCopyId
 */
Roku.get('/store-copy/:storeCopyId', controller.getStoreCopy);

/**
 * Save Roku StoreCopy module by store and product
 * POST /api/roku/store-copy/save?store&product
 */
Roku.post('/store-copy/save', controller.saveStoreCopy);

/**
 * Update Roku StoreCopy module by storeCopyId
 * PUT /api/roku/store-copy/:storeCopyId/update
 */
Roku.put('/store-copy/:storeCopyId/update', controller.updateStoreCopy);

/**
 * Publish Roku StoreCopy module by storeCopyId and environment
 * POST /api/roku/store-copy/:storeCopyId/publish?env
 */
Roku.post('/store-copy/:storeCopyId/publish', controller.publishStoreCopy);

/**
 * Delete Roku StoreCopy module by storeCopyId
 * PUT /api/roku/store-copy/:storeCopyId/delete
 */
Roku.delete('/store-copy/:storeCopyId/delete', controller.deleteModuleById);

/**
 * Get Roku StoreCopy module usage in any campaign
 * GET /api/roku/store-copy/:storeCopyId/usage
 */
Roku.get('/store-copy/:storeCopyId/usage', controller.getStoreCopyUsage);

/**
 * Get Roku environments list
 * GET /api/roku/env
 */
Roku.get('/env/', controller.getRokuEnv);

/**
 * Get all Roku ImagePlacement modules by store
 * GET /api/roku/image/placement?store&product
 */
Roku.get('/image/placement', controller.getAllImagePlacement);

/**
 * Get all Roku ImageGallery modules by store and product
 * GET /api/roku/image/gallery?store&product
 */
Roku.get('/image/gallery/', controller.getAllImageGallery);

/**
 * Save Roku ImageGallery module by store and product
 * POST /api/roku/image/gallery/save?store&product
 */
Roku.post('/image/gallery/save', controller.saveImageGallery);

/**
 * Get usage of ImageGallery module in ImageCollections modules
 * GET /api/roku/image/gallery/:imageId/collections
 */
Roku.get('/image/gallery/:imageId/collections', controller.getUsageOfImageInImageCollections);

/**
 * Delete Roku ImageGallery module by imageId
 * DELETE /api/roku/image/gallery/save?store&product
 */
Roku.delete('/image/gallery/:imageId/delete', controller.deleteModuleById);

/**
 * Get all Roku ImageCollection modules by store and product
 * GET /api/roku/image/collection?store&product
 */
Roku.get('/image/collection/', controller.getAllImageCollection);

/**
 * Get all Roku ImageCollection module by imageCollectionId
 * GET /api/roku/image/collection/:imageCollectionId
 */
Roku.get('/image/collection/:imageCollectionId', controller.getImageCollection);

/**
 * Save Roku ImageCollection module by store and product
 * POST /api/roku/image/collection/save?store&product
 */
Roku.post('/image/collection/save', controller.saveImageCollection);

/**
 * Update Roku ImageCollection module by imageCollectionId
 * PUT /api/roku/image/collection/:imageCollectionId/update
 */
Roku.put('/image/collection/:imageCollectionId/update', controller.updateImageCollection);

/**
 * Publish Roku ImageCollection module by imageCollectionId and environment
 * POST /api/roku/image/collection/:imageCollectionId/publish?env
 */
Roku.post('/image/collection/:imageCollectionId/publish', controller.publishImageCollection);

/**
 * Delete Roku ImageCollection module by imageCollectionId
 * PUT /api/roku/image/collection/:imageCollectionId/delete
 */
Roku.delete('/image/collection/:imageCollectionId/delete', controller.deleteModuleById);

/**
 * Get Roku ImageCollection module usage in any campaign
 * GET /api/roku/image/collection/:imageCollectionId/usage
 */
Roku.get('/image/collection/:imageCollectionId/usage', controller.getImageCollectionUsage);

/**
 * Upload image to S3 bucket by directory and query store & product
 * POST /api/roku/:directory/uploadImage?store&product
 */
Roku.post('/:directory/uploadImage', multer().array('uploadImage'), controller.uploadRokuImage);

/**
 * Get all Roku Campaign modules
 * GET /api/roku/campaign?store&product
 */
Roku.get('/campaign', controller.getAllCampaign);

/**
 * Get Roku Campaign module by campaignId
 * GET /api/roku/campaign/:campaignId
 */
Roku.get('/campaign/:campaignId', controller.getCampaign);

/**
 * Save Roku Campaign module by store and product
 * POST /api/roku/campaign/save?store&product
 */
Roku.post('/campaign/save', controller.saveCampaign);

/**
 * Update Roku Campaign module by campaignId
 * PUT /api/roku/campaign/:campaignId/update
 */
Roku.put('/campaign/:campaignId/update', controller.updateCampaign);

/**
 * Publish Roku Campaign module by campaignId and environment
 * POST /api/roku/campaign/:campaignId/publish?env
 */
Roku.post('/campaign/:campaignId/publish', controller.publishCampaign);

/**
 * Delete Roku Campaign module by campaignId
 * PUT /api/roku/campaign/:campaignId/delete
 */
Roku.delete('/campaign/:campaignId/delete', controller.deleteModuleById);

/**
 * Get all Roku CampaignHistory modules
 * GET /api/roku/campaign/history?store&product
 */
Roku.get('/campaign-history', controller.getAllCampaignHistory);

/**
 * Get Roku Campaign module by campaignHistoryId
 * GET /api/roku/campaign/history/:campaignHistoryId
 */
Roku.get('/campaign-history/:campaignHistoryId', controller.getCampaignHistory);

/**
 * Delete Roku CampaignHistory module by campaignHistoryId
 * PUT /api/roku/campaign-history/:campaignHistoryId/delete
 */
Roku.delete('/campaign-history/:campaignHistoryId/delete', controller.deleteModuleById);

/**
 * Get Roku modules publishing overwrite warning messages by moduleName, id and environment
 * GET /api/roku/publish/:moduleName/:id?env
 */
Roku.get('/publish/:moduleName/:id', controller.getPublishingOverwriteWarningMessage);

/**
 * Not allowed handler
 */
Roku.all('/', returnNotAllowed(['get', 'post']));

export default Roku;
