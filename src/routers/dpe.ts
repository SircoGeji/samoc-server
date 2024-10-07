import * as controller from '../controllers/dpe';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const dpe = express.Router({ mergeParams: true });

/**
 * Get DPE service config
 * GET /api/dpe/config
 */
dpe.get('/config', controller.getDPEConfig);

/**
 * Post DPE service config
 * POST /api/dpe/config
 */
dpe.post('/config', controller.postDPEConfig);

/**
 * Rollback DPE config to PROD version
 * GET /api/dpe/config/sync
 */
dpe.get('/config/sync', controller.rollbackDPEConfigToProd);

/**
 * Not allowed handler
 */
dpe.all('/', returnNotAllowed(['get', 'post']));

export default dpe;
