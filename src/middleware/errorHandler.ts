import { AppError, sendError } from '../util/errorHandler';
import { NextFunction, Request, Response } from 'express';

export const handleServerError = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  sendError(err, res, next);
};

export default [handleServerError];
