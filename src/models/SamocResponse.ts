import { Request, Response } from 'express';
import Logger from '../util/logger';
// import { stopTimerLogPerformance } from '../performance';
const logger = Logger(module);

interface SamocResponse {
  success: boolean;
  status: number;
  message: string;
}

interface Error extends SamocResponse {
  code: number;
  description?: string;
}

export interface ValidateError extends Error {
  errors: FieldError[];
}

export interface FieldError extends Error {
  field: string;
}

export interface SuccessResponse extends SamocResponse {
  data: any;
  meta?: any;
}

interface RetWithSuccessOptions {
  status?: number;
  message?: string;
  data: any;
  meta?: any;
}

const retResponse = (res: Response, samocRes: SamocResponse) => {
  res.status(samocRes.status).send(samocRes).end();
};

export const retWithSuccess = (
  req: Request,
  res: Response,
  arg: RetWithSuccessOptions,
): void => {
  // log performance data
  // stopTimerLogPerformance(req, 'performance_data_success');

  const samocRes: SuccessResponse = {
    success: true,
    status: arg.status || 200,
    message: arg.message || 'OK',
    data: arg.data || undefined,
    meta: arg.meta || undefined,
  };

  retResponse(res, samocRes);
};
