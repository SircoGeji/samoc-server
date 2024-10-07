import * as controller from '../controllers/health';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const health = express.Router({ mergeParams: true });

// root is /health or /ping

/**
 * Get current health status
 */
health.get('/', controller.getStatus);

/**
 * Not allowed handler
 */
health.all('/', returnNotAllowed(['get']));

export default health;
