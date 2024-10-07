import * as controller from '../controllers/translations';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');

const translations = express.Router({ mergeParams: true });

/**
 * Get store translations
 * GET /api/translations
 */
translations.get('/', controller.getStoreTranslations);

/**
 * Update store translations
 * PUT /api/translations
 */
translations.put('/', controller.updateStoreTranslations);

/**
 * Rollback store translations
 * PUT /api/translations/rollback
 */
translations.put('/rollback', controller.rollbackStoreTranslations);

/**
 * Not allowed handler
 */
translations.all('/', returnNotAllowed(['get', 'put']));
translations.all('/rollback', returnNotAllowed(['put']));

export default translations;
