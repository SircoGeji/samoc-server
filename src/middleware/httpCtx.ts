import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { X_REQUEST_ID } from '../util/constants';
import * as httpContext from 'express-http-context';
import { v4 } from 'uuid';

const logger = Logger(module);

export const setHttpCtx = (req: Request, res: Response, next: NextFunction) => {
  httpContext.set('socketIoId', req.header('Socket-Id'));
  next();
};
