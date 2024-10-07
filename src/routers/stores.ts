import * as controller from '../controllers/stores';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const stores = express.Router({ mergeParams: true });

/**
 * Get all stores
 * GET /api/stores
 */
stores.get('/', controller.getAllStores);

/**
 * Not allowed handler
 */
stores.all('/', returnNotAllowed(['get']));

export default stores;
