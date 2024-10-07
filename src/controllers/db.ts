import { NextFunction, Request, Response } from 'express';
import Umzug from 'umzug';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { db } from '../models';
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs';
import { AppError, sendError } from '../util/errorHandler';
import { Env } from '../types/enum';
import { NODE_ENV } from '../util/config';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] DB Controller:`;
  } else {
    return `DB Controller:`;
  }
};

const initDb = async () => {
  try {
    await db.sync();
    logger.info(
      `DB connection with '${db.config.host}' has been established successfully.`,
    );
  } catch (err) {
    logger.error(
      `${logPrefix(Env.DB)} initDb '${db.config.host}' failed, ${err.message}`,
      err,
    );
    throw new AppError(
      `Database: Failed to initialize '${
        db.config.host
      }' on ${Env.DB.toUpperCase()}, ${err.message}`,
      500,
    );
  }
};

const seedData = async (dbInitSqlPath: string): Promise<number> => {
  let count = 0;
  if (fs.existsSync(dbInitSqlPath)) {
    try {
      const rawSql = fs.readFileSync(dbInitSqlPath).toString();

      if (rawSql) {
        //split queries
        const queries = rawSql
          .replace(/(\r\n|\n|\r)/gm, '') //remove line breaks;
          .replace(/;/gm, ';\n') //add line breaks after ;
          .match(/^.*;$/gm); //split each line
        for (const i in queries) {
          const aQuery = queries[i].trim();
          if (aQuery && aQuery.length > 0) {
            logger.debug(`aQuery: "${aQuery}"`);
            count = count + 1;
            await db.query(aQuery);
          }
        }
        logger.debug(
          `DB seeded successfully using '${dbInitSqlPath}', executed ${count} SQL statements.`,
        );
      } else {
        logger.warn(`${dbInitSqlPath} file is empty.`);
      }
      return count;
    } catch (err) {
      logger.error(
        `${logPrefix(Env.DB)} seedData '${dbInitSqlPath}' failed, ${
          err.message
        }`,
        err,
      );
      throw new AppError(
        `seedData error occurred processing "${dbInitSqlPath}": ${err.message}`,
        500,
      );
    }
  } else {
    logger.warn(`${dbInitSqlPath} file is not found.`);
  }
};

/**
 * Initialize DB migration library
 */
const initUmzug = () => {
  return new Umzug({
    migrations: { params: [db.getQueryInterface()] },
    storage: 'sequelize',
    storageOptions: {
      sequelize: db,
    },
  });
};

/**
 *  Request handle to validate DB API KEY
 */
export const checkDbApiKey = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (NODE_ENV !== 'local') {
      if (
        (process.env.DB_API_KEY === '' && process.env.NODE_ENV !== 'dev') ||
        (req.header('x-samoc-db-api-key') ?? '') !== process.env.DB_API_KEY
      ) {
        return sendError(
          new AppError('Not authorized to perform this operation', 401),
          res,
          next,
        );
      }
    }
    next();
  },
);

/**
 * GET /db/init - seed initial data from db_init.sql
 */
export const init = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const dbInitUsersPath = path.join(
      __dirname,
      `../../db/db_init_users_${NODE_ENV === 'prod' ? 'prod' : 'dev'}.sql`,
    );
    const dbInitSqlPath = path.join(__dirname, `../../db/db_init.sql`);
    let result: number;
    try {
      await initDb();
      result = await seedData(dbInitUsersPath);
      result = result + (await seedData(dbInitSqlPath));
    } catch (err) {
      return next(err);
    }

    retWithSuccess(req, res, {
      message: `DB initialized with initial data using '${dbInitUsersPath}' and ${dbInitSqlPath}'`,
      data: result,
    });
  },
);

/**
 * GET /db/state-init - seed initial data from db_state_init.sql
 */
export const stateInit = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const dbInitSqlPath = path.join(__dirname, `../../db/db_state_init.sql`);
    let result: number;
    try {
      await initDb();
      result = await seedData(dbInitSqlPath);
    } catch (err) {
      return next(err);
    }

    retWithSuccess(req, res, {
      message: `DB initialized with initial data using ${dbInitSqlPath}'`,
      data: result,
    });
  },
);

/**
 * GET /db/platform-init/:store/:platformName - init platform tables from db_{store}{platform}_init.sql
 */
export const platformInit = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { store, platformName } = req.params;
    let result: number;
    const [dbSqlPath, message] = getPlatformDBStrData(
      'init',
      store,
      platformName,
    );
    try {
      result = await seedData(dbSqlPath);
    } catch (err) {
      return next(err);
    }

    retWithSuccess(req, res, {
      message,
      data: result,
    });
  },
);

/**
 * DELETE /db/platform-drop/:store/:platformName - drop android tables from db_{store}{platform}_drop.sql
 */
export const platformDrop = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { store, platformName } = req.params;
    const [dbSqlPath, message] = getPlatformDBStrData(
      'drop',
      store,
      platformName,
    );
    let result: number;
    try {
      result = await seedData(dbSqlPath);
    } catch (err) {
      return next(err);
    }

    retWithSuccess(req, res, {
      message,
      data: result,
    });
  },
);

const getPlatformDBStrData = (
  action: string,
  store: string,
  platformName: string,
) => {
  const storeStr = !!Number(store) ? 'store_' : '';
  const dbSqlPath = path.join(
    __dirname,
    `../../db/db_${storeStr}${platformName}_${action}.sql`,
  );
  let message = '';
  if (action === 'drop') {
    message = `DB cleared ${
      !!storeStr ? 'store table entries' : 'from android tables'
    } with initial data using ${dbSqlPath}`;
  } else if (action === 'init') {
    message = `DB initialized with initial data using ${dbSqlPath}`;
  }
  return [dbSqlPath, message];
};

/**
 * DELETE /db/wipe
 */
export const wipe = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Performing database wipe');
    let result: unknown[];
    try {
      result = await db.drop();
    } catch (err) {
      return next(new AppError(`DB wipe failed: ${err.message}`, 500));
    }
    retWithSuccess(req, res, {
      message: `DB Wiped.`,
      data: result,
    });
  },
);

/**
 * DELETE /db/cleanup
 */
export const cleanUp = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const sqlPath = path.join(__dirname, `../../db/db_cleanup.sql`);
    let result: number;
    try {
      result = await seedData(sqlPath);
    } catch (err) {
      return next(err);
    }

    retWithSuccess(req, res, {
      message: `DB Cleaned up'`,
      data: result,
    });
  },
);

/**
 * GET /db/migrations/pending - getting all pending migrations
 */
export const getPendingMigrations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await initDb();
      const umzug = initUmzug();
      const result = await umzug.pending();
      retWithSuccess(req, res, {
        message: 'Pending Migrations',
        data: { migrations: result.map((m) => m.file) },
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * GET /db/migrations/executed - getting all executed migrations
 */
export const getExecutedMigrations = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const umzug = initUmzug();
      const result = await umzug.executed();
      retWithSuccess(req, res, {
        message: 'Executed migrations',
        data: { migrations: result.map((m) => m.file) },
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * GET /db/migrations/up - execute pending migrations
 */
export const migrationsUp = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await initDb();
      const umzug = initUmzug();
      const result = await umzug.up();
      retWithSuccess(req, res, {
        message: 'Successfully executed pending migrations',
        data: { migrations: result.map((m) => m.file) },
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * DELETE /db/migrations/down - rollback last executed migration
 */
export const migrationsDown = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await initDb();
      const umzug = initUmzug();
      const result = await umzug.down();
      retWithSuccess(req, res, {
        message: 'Successfully rolled back migrations',
        data: { migrations: result.map((m) => m.file) },
      });
    } catch (err) {
      return next(err);
    }
  },
);
