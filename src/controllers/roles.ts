import { Request, Response } from 'express';
import Logger from '../util/logger';
import { retWithSuccess } from '../models/SamocResponse';
import { Role } from '../models';
import asyncHandler from 'express-async-handler';

const logger = Logger(module);

/**
 * GET /api/roles
 * Get all roles
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllRoles = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Roles Controller - getAllRoles');
  const results = await Role.findAll();
  let message: string;
  if (results && results.length > 0) {
    message = 'Roles found';
  } else {
    message = 'No role found';
  }
  retWithSuccess(req, res, {
    message: message,
    data: results,
  });
});
