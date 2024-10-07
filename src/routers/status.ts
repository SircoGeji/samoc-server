import * as controller from '../controllers/status';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const status = express.Router({ mergeParams: true });

/**
 * Get all status
 * GET /api/status
 */
status.get('/', controller.getAllStatus);

/**
 * Not allowed handler
 */
status.all('/', returnNotAllowed(['get']));

export default status;
