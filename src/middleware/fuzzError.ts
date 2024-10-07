import { NextFunction, Request, Response } from 'express';
import { AppError } from '../util/errorHandler';
import { FUZZ_ERROR_PROBABILITY, FUZZ_ERROR_URL_REGEX } from '../util/config';

export const fuzzError = (req: Request, res: Response, next: NextFunction) => {
  if (
    FUZZ_ERROR_URL_REGEX &&
    req.url.match(FUZZ_ERROR_URL_REGEX) &&
    Math.random() * 100 < FUZZ_ERROR_PROBABILITY
  ) {
    return next(new AppError(`Fuzz error in ${req.url} request`, 500));
  }
  return next();
};
