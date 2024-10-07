import * as controller from '../controllers/validator';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const validator = express.Router({ mergeParams: true });

/**
 * Validator
 * GET /api/validator/plan/:storeId/:planCode
 * GET /api/validator/offer/:storeId/:offerCode
 */
validator.get('/plan/:storeId/:planCode', controller.validatePlan);
validator.get('/offer/:storeId/:offerCode', controller.validateOffer);

/**
 * Not allowed handler
 */
validator.all('/plan/:storeId/:planCode', returnNotAllowed(['get']));
validator.all('/offer/:storeId/:offerCode', returnNotAllowed(['get']));

export default validator;
