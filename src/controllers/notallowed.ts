import { Request, Response } from 'express';

/**
 * Controller to return with 405: not allowed
 * Include Allowed header with the methods accepted on the resource
 */
export const returnNotAllowed = (allowedMethods: string[]) => (
  req: Request,
  res: Response,
) => {
  res.set('Allowed', allowedMethods.join(',').toUpperCase());
  return res.sendStatus(405);
};
