import { NextFunction, Response } from 'express';
import { io } from '../server';
import Logger from './logger';
import { X_REQUEST_ID } from './constants';
import { NODE_ENV } from './config';

const logger = Logger(module);
const logPrefix = (msg: string) => {
  return `Error Handler: ${msg}`;
};

export class AppError extends Error {
  success: boolean;
  statusCode!: number;
  status!: string;
  //   readonly isOperational!: boolean;
  validationResult: any[];
  data?: any;

  constructor(message: string, statusCode?: number, validationResult?: any[]) {
    super(message || 'Something went wrong');

    this.statusCode = statusCode || 500;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.success = false;
    // this.isOperational = true;
    this.validationResult = validationResult;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BambooIsBusyError extends AppError {}

export class BambooIsOfflineError extends AppError {}

export class ContentfulError extends AppError {}

export class CmsApiError extends AppError {}

export class GhostLockerError extends AppError {}

export class PlayAuthError extends AppError {}

export class SlackError extends AppError {}

// error that indicates an issue occurred before updating remote systems
// this error is non-fatal that user should be allowed to retry
export class PreUpdateRemoteError extends AppError {}

export class RecurlyError extends AppError {}

export class ValidateGhostLockerError extends AppError {}

const sendErrorDev = (err: AppError, res: Response) => {
  const xId = res.getHeader(X_REQUEST_ID) as string;
  res.status(err.statusCode).json({
    success: err.success,
    status: err.status,
    message: `${err.message}\n\n(xId: ${xId})`,
    errors: err.validationResult || undefined,
    error: err,
    stack: err.stack,
    data: err.data || undefined,
    xId: xId,
  });
};

const sendErrorProd = (err: AppError, res: Response) => {
  const xId = res.getHeader(X_REQUEST_ID) as string;
  res.status(err.statusCode).json({
    status: err.status,
    message: `${err.message}\n\n(xId: ${xId})`,
    errors: err.validationResult || undefined,
    data: err.data || undefined,
    xId: xId,
  });
};

export const sendError = (
  err: AppError,
  res: Response,
  next: NextFunction,
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  err.success = false;

  if (
    err.statusCode === 401 ||
    err.message.toLowerCase().indexOf('invalid api') > -1 ||
    err.message.toLowerCase().indexOf('unauthorized') > -1
  ) {
    io.emit('health-status-update', {
      err,
    });
  }

  logger.error(logPrefix(err.message), err);
  if (NODE_ENV === 'prod') {
    sendErrorProd(err, res);
  } else {
    sendErrorDev(err, res);
  }
};
