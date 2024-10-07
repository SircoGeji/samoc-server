import { NextFunction, Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { UserRequestPayload } from '../types/payload';
import asyncHandler from 'express-async-handler';
import { login } from '../services/Authentication';

const logger = Logger(module);

/**
 * POST /api/users/login
 * login with username and password
 * @param {Request}     req
 * @param {Response}    res
 */
export const userLogin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Users Controller - userLogin');
    const payload: UserRequestPayload = req.body as UserRequestPayload;

    try {
      const user = await login(payload.username, payload.password);
      retWithSuccess(req, res, {
        message: `User (${user.user.email}) authenticated successfully`,
        data: user,
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * GET /api/users/logout
 * logout from server
 * @param {Request}     req
 * @param {Response}    res
 */
export const userLogout = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Users Controller - userLogout');
  // TODO: actually logout from server
  retWithSuccess(req, res, {
    message: `User logout successfully`,
    data: null,
  });
});
