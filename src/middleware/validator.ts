import { validationResult } from 'express-validator';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../util/errorHandler';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty() || !!req.query.skipValidation) {
    return next();
  }
  const extractedErrors: any = [];
  errors.array().map((err) => extractedErrors.push({ [err.param]: err.msg }));

  return next(new AppError('Validation failed', 422, extractedErrors));
};
