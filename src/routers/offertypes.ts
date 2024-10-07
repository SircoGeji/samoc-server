import * as controller from '../controllers/offertypes';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const offertypes = express.Router({ mergeParams: true });

/**
 * Get all offer types
 * GET /api/offertypes
 */
offertypes.get('/', controller.getAllOfferTypes);

/**
 * Not allowed handler
 */
offertypes.all('/', returnNotAllowed(['get']));

export default offertypes;
