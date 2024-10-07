import * as controller from '../controllers/db';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');
import { checkDbApiKey } from '../controllers/db';

const dbRouter = express.Router({ mergeParams: true });

/**
 * Drops all tables
 *
 * /db/wipe
 */
dbRouter.delete('/wipe', checkDbApiKey, controller.wipe);

/**
 * Cleanup stale Offers that have _VALDN_FAIL or _FAIL status
 *
 * /db/cleanup
 */
dbRouter.delete('/cleanup', checkDbApiKey, controller.cleanUp);

/**
 * Initialize data from db/db_init.sql
 *
 * /db/init
 */
dbRouter.get('/init', checkDbApiKey, controller.init);

/**
 * Initialize data from db/db_{store}{platformName}_init.sql
 *
 * /db/platform-init
 */
dbRouter.get('/platform-init/:store/:platformName', controller.platformInit);

/**
 * Drop entries / tables from db/db_{store}{platformName}_drop.sql
 *
 * /db/platform-drop
 */
dbRouter.delete('/platform-drop/:store/:platformName', controller.platformDrop);

/**
 * Initialize data from db/db_state_init.sql
 *
 * /db/state-init
 */
dbRouter.get('/state-init', controller.stateInit);

/**
 * Initialize data from db/db_state_init.sql
 *
 * /db/state-init
 */
dbRouter.get('/state-init', controller.stateInit);

/**
 * Getting all pending migrations
 *
 * /db/migrations/pending
 */
dbRouter.get(
  '/migrations/pending',
  checkDbApiKey,
  controller.getPendingMigrations,
);

/**
 * Getting all executed migrations
 *
 * /db/migrations/executed
 */
dbRouter.get(
  '/migrations/executed',
  checkDbApiKey,
  controller.getExecutedMigrations,
);

/**
 * Execute pending migrations
 *
 * /db/migrations/up
 */
dbRouter.get('/migrations/up', checkDbApiKey, controller.migrationsUp);

/**
 * Rollback last executed migration
 *
 * /db/migrations/down
 */
dbRouter.delete('/migrations/down', checkDbApiKey, controller.migrationsDown);

/**
 * Not allowed handler
 */
dbRouter.all('/wipe', returnNotAllowed(['delete']));
dbRouter.all('/init', returnNotAllowed(['get']));
dbRouter.all('/cleanup', returnNotAllowed(['delete']));
dbRouter.all('/migrations/pending', returnNotAllowed(['get']));
dbRouter.all('/migrations/executed', returnNotAllowed(['get']));
dbRouter.all('/migrations/up', returnNotAllowed(['get']));
dbRouter.all('/migrations/down', returnNotAllowed(['delete']));

export default dbRouter;
