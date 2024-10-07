import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { X_REQUEST_ID } from '../util/constants';
import * as httpContext from 'express-http-context';
import { v4 } from 'uuid';

const logger = Logger(module);

export const decorateXRequestId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const xId = req.get(X_REQUEST_ID) || v4();
  res.setHeader(X_REQUEST_ID, xId);
  httpContext.set('xId', xId);
  next();
};
