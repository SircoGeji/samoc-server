import * as controller from '../controllers/android/tardis';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const tardis = express.Router({ mergeParams: true });

/**
 * Get Tardis service record data
 * GET /api/tardis/record
 */
tardis.get('/record', controller.getRecord);

/**
 * Not allowed handler
 */
tardis.all('/', returnNotAllowed(['get', 'post']));

export default tardis;
