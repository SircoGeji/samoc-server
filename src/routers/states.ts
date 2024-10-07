import * as controller from '../controllers/states';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const states = express.Router({ mergeParams: true });

/**
 * Get all states by regionCode
 * GET /api/states?region=<regionCode>
 */
states.get('/', controller.getAllStates);

/**
 * Not allowed handler
 */
states.all('/', returnNotAllowed(['get']));

export default states;
