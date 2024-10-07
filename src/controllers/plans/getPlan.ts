import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Plan } from '../../models';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import { getPlanResponsePayload } from './index';
import { AppError } from '../../util/errorHandler';
import { PLAN_QUERY_OPTS } from '../../util/utils';
import { PlanModel } from '../../models/Plan';
import * as Recurly from '../../services/Recurly';
import { Env } from '../../types/enum';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get Plan Controller:`;
  } else {
    return `Get Plan Controller:`;
  }
};
/**
 * GET /api/plans/:planCode
 * Get an existing plan by PlanCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const getPlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - getPlan');
    const { planCode } = req.params;
    const plan = await Plan.findByPk(planCode, PLAN_QUERY_OPTS);
    if (plan) {
      const model = plan as PlanModel;
      const recurlyPlan = await Recurly.getPlanRecurlyPayload(
        model.planCode,
        (model as PlanModel).Store,
        Env.PROD,
      );
      retWithSuccess(req, res, {
        message: `Plan (${plan.planCode}) found`,
        data: getPlanResponsePayload(recurlyPlan, model),
      });
    } else {
      return next(new AppError(`Plan (${planCode}) not found`, 404));
    }
  },
);
