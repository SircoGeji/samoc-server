import * as controller from '../controllers/bamboo';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const bambooRouter = express.Router({ mergeParams: true });

/**
 * Webhook for Bamboo to call to send build results
 *
 * /bamboo/webhook
 */
bambooRouter.post('/webhook', controller.webhook);

/**
 * Not allowed handler
 */
bambooRouter.all('/webhook', returnNotAllowed(['post']));

export default bambooRouter;
