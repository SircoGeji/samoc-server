import * as controller from '../controllers/slack';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const slack = express.Router({ mergeParams: true });

/**
 * Get config for given slack bot
 * GET /api/slack/config
 */
slack.get('/config', controller.getSlackConfiguration);

/**
 * Save config for given slack bot
 * POST /api/slack/config/save
 */
slack.post('/config/save', controller.saveSlackConfiguration);

/**
 * Save config for given slack bot
 * PUT /api/slack/config/update
 */
slack.put('/config/update', controller.updateSlackConfiguration);

/**
 * Not allowed handler
 */
slack.all('/', returnNotAllowed(['get', 'post']));

export default slack;
