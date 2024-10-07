import * as controller from '../controllers/offers';
import { returnNotAllowed } from '../controllers/notallowed';
import { validate } from '../middleware/validator';
import { offerValidationRules } from '../validators/Offer';
import express = require('express');

const offers = express.Router({ mergeParams: true });

/**
 * Get all offers
 * GET /api/offers
 */
offers.get('/', controller.getDBAllOffers);

/**
 * Pull all data from remote services offers data to environment data base
 * PUT /api/offers
 */
offers.put('/', controller.putAllOffers);

/**
 * Save a draft offer in DB
 * POST /api/offers/save
 */
offers.post(
  '/save',
  // offerValidationRules('createNewOffer'),
  // validate,
  controller.saveDraftOffer,
);

/**
 * Create a new offer in stg
 * POST /api/offers/create
 */
offers.post(
  '/create',
  // offerValidationRules('createNewOffer'),
  // validate,
  controller.createNewOffer,
);

/**
 * Get an existing offer
 * GET /api/offers/:offerId
 */
offers.get('/:offerId', controller.getOffer);

/**
 * Update an existing offer
 * PUT /api/offers/:offerId
 */
offers.put(
  '/:offerId',
  offerValidationRules('updateOffer'),
  validate,
  controller.updateOffer,
);

/**
 * Delete an existing offer
 * DELETE /api/offers/:offerId
 */
offers.delete('/:offerId', controller.deleteOffer);

/**
 * Validate an existing offer
 * GET /api/offers/:offerId/validate
 */
offers.get('/:offerId/validate', controller.validateOffer);

/**
 * Publish an existing offer
 * GET /api/offers/:offerId/publish
 */
offers.get('/:offerId/publish', controller.publishOffer);

/**
 * Generate Unique Codes Csv for an existing offer
 * GET /api/offers/:offerId/uniqueCodes/generate
 */
offers.get('/:offerId/uniqueCodes/generate', controller.generateCodes);

/**
 * Export Unique Codes Csv for an existing offer
 * GET /api/offers/:offerId/uniqueCodes/export
 */
offers.get('/:offerId/uniqueCodes/export', controller.exportCodes);

/**
 * Download Unique Codes Csv for an existing offer
 * GET /api/offers/:offerId/uniqueCodes/download
 */
offers.get('/:offerId/uniqueCodes/download', controller.downloadCsv);

/**
 * Get Retention Offer User Eligibility Rules
 * GET /api/offers/retention/rules
 */
offers.get('/retention/rules', controller.getRetentionOfferRules);

/**
 * Get Extension Offer User Eligibility Rules
 * GET /api/offers/extension/rules
 */
offers.get('/extension/rules', controller.getExtensionOfferRules);

/**
 * Update user eligibility rules for extension offers
 * PUT /api/offers/extension/rules?store=<storeCode>&envState=<envCode>
 */
offers.put('/extension/rules', controller.updateExtensionOfferRules);

/**
 * Update Cancellation offers
 * PUT /api/offers/retention/filters
 */
offers.put('/retention/rules', controller.updateRetentionRules);
offers.put('/retention/filters/retire', controller.retireRetentionFilters);

/**
 * Get list of plans with allowed retention offers (including upgrade)
 * GET /api/offers/retention/terms/?store=<storeCode>
 */
offers.get('/retention/terms', controller.getRetentionOffersForDurations);

/**
 * Validate an existing offer
 * GET /api/offers/dit/:offerId
 */
offers.get('/dit/:offerId', controller.validateOfferDIT);

/**
 * Update an existing offer
 * PUT /api/offers/dit/:offerId
 */
offers.put('/dit/:offerId', controller.updateOfferDit);

// TODO: Add validators
/**
 * Update an existing offer
 * PUT /api/offers/campaign/save
 */
offers.post('/campaign/save', controller.saveDraftCampaign);

/**
 * Get an existing offer
 * GET /api/offers/campaign/:campaignId
 */
offers.get('/campaign/:campaignId', controller.getCampaign);

/**
 * Create a new campaign in STG
 * POST /api/offers/campaign/create
 */
offers.post('/campaign/create', controller.createNewCampaign);

/**
 * Update an existing campaign
 * PUT /api/offers/campaign/:campaignId
 */
offers.put('/campaign/:campaignId', controller.updateCampaign);

/**
 * Delete an existing campaign
 * DELETE /api/offers/campaign/:campaignId
 */
offers.delete('/campaign/:campaignId', controller.deleteCampaign);

/**
 * Validate an existing campaign
 * GET /api/offers/campaign/:campaignId/validate
 */
offers.get('/campaign/:campaignId/validate', controller.validateCampaign);

/**
 * Publish an existing offer
 * GET /api/offers/:campaignId/publish
 */
offers.get('/campaign/:campaignId/publish', controller.publishCampaign);

/**
 * Create a new offer by offerCode, offerType, store and services data
 * POST /api/offers/synchronize-offer
 */
offers.post('/synchronize-offer', controller.synchronizeOffer);

/**
 * Get an existing offer history
 * GET /api/offers/history/:offerId
 */
offers.get('/history/:offerId', controller.getOfferHistory);

/**
 * Update last filter up to current GL retention rules config
 * PUT /api/offers/ghost-locker/rules
 */
offers.put('/ghost-locker/rules', controller.synchronizeFilters);

/**
 * Get two versions data of GL config
 * GET /api/offers/ghost-locker/versions
 */
offers.get('/ghost-locker/versions', controller.getGLConfigVersionsData);

/**
 * Not allowed handler
 */
offers.all('/', returnNotAllowed(['get', 'post']));
offers.all('/:offerId', returnNotAllowed(['get', 'put', 'delete']));
offers.all('/:offerId/validate', returnNotAllowed(['get']));
offers.all('/:offerId/publish', returnNotAllowed(['get']));
offers.all('/:offerId/uniqueCodes/generate', returnNotAllowed(['get']));
offers.all('/:offerId/uniqueCodes/export', returnNotAllowed(['get']));
offers.all('/:offerId/uniqueCodes/download', returnNotAllowed(['get']));
offers.all('/retention/rules', returnNotAllowed(['get', 'put']));
offers.all('/retention/filters/retire', returnNotAllowed(['put']));
offers.all('/retention/terms', returnNotAllowed(['get']));
offers.all('/dit/:offerId', returnNotAllowed(['get', 'put']));

export default offers;
