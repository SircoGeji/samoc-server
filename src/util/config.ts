import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import winston from 'winston';

const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

dotenv.config();

/**
 * Get version from package.json
 */
const packageJsonFilePath = path.join(__dirname, '../../package.json');
if (!fs.existsSync(packageJsonFilePath)) {
  logger.error('The package.json file is missing.');
  process.exit(1);
}
export const appInfo = {
  version: JSON.parse(fs.readFileSync(packageJsonFilePath).toString()).version,
};

if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else if (process.env.NODE_ENV === undefined) {
  logger.error('The .env file is missing.');
  process.exit(1);
}

// export const CERT_PATH = process.env.CERT_PATH;
export const EXPRESS_PORT = process.env.EXPRESS_PORT;
if (!EXPRESS_PORT) {
  logger.info('EXPRESS_PORT is missing from .env, default to 1337');
}
// export const KEY_PATH = process.env.KEY_PATH;
export const LOG_LEVEL = process.env.LOG_LEVEL;
if (!LOG_LEVEL) {
  logger.info('LOG_LEVEL is missing from .env, default to debug');
}
export const NODE_ENV = process.env.NODE_ENV;
export const LOG_FOLDER = process.env.LOG_FOLDER;
export const LOG_FILE = process.env.LOG_FILE;
export const LOG_DATE_PATTERN = process.env.LOG_DATE_PATTERN;

// debugging
export const CACHE_DELAY: number = parseInt(process.env.CACHE_DELAY) || 0;
export const DISABLE_ROLLBACK: boolean =
  process.env.DISABLE_ROLLBACK?.toLocaleLowerCase() === 'true' || false;
export const DISABLE_CAMPAIGN_ROLLBACK: boolean =
  process.env.DISABLE_CAMPAIGN_ROLLBACK?.toLocaleLowerCase() === 'true' || true;
export const IGNORE_CMS_API_ERRORS: boolean =
  process.env.IGNORE_CMS_API_ERRORS?.toLocaleLowerCase() === 'true' || true;

export const SKIP_CLEARCMSAPICACHE: boolean =
  process.env.SKIP_CLEARCMSAPICACHE?.toLocaleLowerCase() === 'true' || false;
export const SKIP_GL_PROD_VALIDATION: boolean =
  process.env.SKIP_GL_PROD_VALIDATION?.toLocaleLowerCase() === 'true' || false;
export const USE_PARALLEL_VALIDATION: boolean =
  process.env.USE_PARALLEL_VALIDATION?.toLocaleLowerCase() === 'true' || false;

export const FUZZ_ERROR_PROBABILITY: number =
  parseInt(process.env.FUZZ_ERROR_PROBABILITY) || 0;
export const FUZZ_ERROR_URL_REGEX: string =
  process.env.FUZZ_ERROR_URL_REGEX || '';

logger.info(`SAMOC Configurations`, {
  NODE_ENV,
  LOG_FOLDER,
  LOG_FILE,
  LOG_DATE_PATTERN,
  CACHE_DELAY,
  DISABLE_ROLLBACK,
});
