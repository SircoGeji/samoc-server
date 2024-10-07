import * as controller from '../controllers/offers/filters';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const FiltersRouter = express.Router({ mergeParams: true });

/**
 * GET /api/filters/
 * Get GL Default configs
 */
FiltersRouter.get('/', controller.getDefaultGLConfigs);

/**
 * PUT /api/filters?regionCode&env
 * Update GL Default configs
 */
FiltersRouter.put('/', controller.updateDefaultGLConfigs);

/**
 * GET /api/filters/sync?regionCode
 * Rollback default GL configs to PROD
 */
FiltersRouter.get('/sync', controller.rollbackDefaultGLConfigsToProd);

/**
 * Not allowed handler
 */
FiltersRouter.all('/', returnNotAllowed(['get', 'post']));

export default FiltersRouter;
