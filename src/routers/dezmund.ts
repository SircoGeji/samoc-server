import * as controller from '../controllers/dezmund';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const DezmundRouter = express.Router({ mergeParams: true });

/**
 * GET /api/dezmund/content
 * Get Dezmund content
 */
DezmundRouter.get('/content', controller.getOriginalsContent);

/**
 * Not allowed handler
 */
DezmundRouter.all('/', returnNotAllowed(['get', 'post']));

export default DezmundRouter;
