import * as logform from 'logform';
import {
  LOG_DATE_PATTERN,
  LOG_FILE,
  LOG_FOLDER,
  LOG_LEVEL,
  NODE_ENV,
} from './config';
import { createLogger, format, transports } from 'winston';
import { Request } from 'express';
import path from 'path';
import * as Transport from 'winston-transport';
import * as httpContext from 'express-http-context';
import DailyRotateFile from 'winston-daily-rotate-file';

const {
  combine,
  colorize,
  timestamp,
  label,
  json,
  simple,
  prettyPrint,
  errors,
} = format;

const getModulePath = (callingModule: NodeModule): string => {
  const parts: string[] = callingModule.filename.split(path.sep);
  return path.join(parts[parts.length - 2], parts.pop());
};

const getTransports = (): Transport[] | Transport => {
  const tArray = [];
  let logLevel = LOG_LEVEL;

  if (!logLevel) {
    if (NODE_ENV === 'prod' || NODE_ENV === 'stage') {
      logLevel = 'info';
    } else if (NODE_ENV === 'test') {
      logLevel = 'error';
    } else {
      logLevel = 'debug';
    }
  }

  const consoleTransport = new transports.Console({
    level: logLevel,
  });

  const fileTransport = new DailyRotateFile({
    filename: LOG_FOLDER + LOG_FILE,
    datePattern: LOG_DATE_PATTERN,
    zippedArchive: true,
    // maxSize: '20m',
    maxFiles: '14d',
    level: logLevel,
  });

  tArray.push(consoleTransport);
  tArray.push(fileTransport);

  if (
    process.env.SPLUNK_HOST &&
    process.env.SPLUNK_TOKEN &&
    process.env.SPLUNK_INDEX &&
    process.env.SPLUNK_SOURCETYPE
  ) {
    /* eslint-disable  @typescript-eslint/no-var-requires */
    const SplunkStreamEvent = require('winston-splunk-httplogger');
    const splunkSettings = {
      host: process.env.SPLUNK_HOST,
      token: process.env.SPLUNK_TOKEN,
      index: process.env.SPLUNK_INDEX,
      sourcetype: process.env.SPLUNK_SOURCETYPE,
      // protocol: 'https',
    };
    const httpTransport = new SplunkStreamEvent({
      level: logLevel,
      splunk: splunkSettings,
    });
    tArray.push(httpTransport);
  }

  return tArray;
};

let gReq: Request;
/**
 * Add a header entry to the info object to be appended to logger
 *
 * @param info
 * @param keys
 */
const addHeaders = (info: any, ...keys: string[]) => {
  for (const k of keys) {
    if (gReq && gReq.headers && gReq.get(k)) {
      info[k] = gReq.get(k);
    }
  }
};

/**
 * Add any metadata to the logger here
 */
const addMeta = format((info: any) => {
  const xId = httpContext.get('xId');
  if (!info['xId'] && xId) {
    info['xId'] = xId;
  }
  const offerCode = httpContext.get('offerCode');
  if (!info['offerCode'] && offerCode) {
    info['offerCode'] = offerCode;
  }
  const planCode = httpContext.get('planCode');
  if (!info['planCode'] && planCode) {
    info['planCode'] = planCode;
  }
  const env = httpContext.get('env');
  if (!info['env'] && env) {
    info['env'] = env;
  }
  return info;
});

const getFormats = (callingModule: NodeModule): logform.Format => {
  if (NODE_ENV === 'prod' || NODE_ENV === 'stage') {
    // is prod/stage
    return combine(
      timestamp(),
      label({ label: getModulePath(callingModule) } as any),
      addMeta(),
      json(),
    );
  } else {
    // is local/dev
    return combine(
      errors({ stack: true }), // <-- use errors format
      colorize(),
      timestamp(),
      label({ label: getModulePath(callingModule) } as any),
      addMeta(),
      prettyPrint(),
    );
  }
};

export default (callingModule: NodeModule) => {
  return createLogger({
    // defaultMeta: { app: 'samoc-server' },
    format: getFormats(callingModule),
    transports: getTransports(),
  });
};
