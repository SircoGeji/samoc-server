import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Plan, Store } from '../../models';
import { retWithSuccess } from '../../models/SamocResponse';
import { Env } from '../../types/enum';
import Logger from '../../util/logger';
import { PLAN_QUERY_OPTS } from '../../util/utils';
import { getPlanResponsePayload } from './index';
import * as Recurly from '../../services/Recurly';
import { StoreModel } from '../../models/Store';
import { PlanResponsePayload } from '../../types/payload';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get All Plans Controller:`;
  } else {
    return `Get All Plans Controller:`;
  }
};

export const getPlansForStore = async (
  currentStore: StoreModel,
): Promise<PlanResponsePayload[]> => {
  const plans = await Plan.findAll({
    ...PLAN_QUERY_OPTS,
    where: { storeCode: currentStore.storeCode },
  });

  const results: PlanResponsePayload[] = [];
  if (plans && plans.length > 0) {
    const ids = plans.map((pl) => pl.planId);

    const recurlyPlans = await Recurly.getPlansRecurlyPayload(
      ids,
      currentStore,
      Env.PROD,
    );

    for (const plan of plans) {
      const recurlyPlan = recurlyPlans.find((rp) => rp.planId === plan.planId);
      if (!recurlyPlan || recurlyPlan.state === 'inactive') {
        await plan.destroy();
      } else {
        results.push(getPlanResponsePayload(recurlyPlan, plan));
      }
    }
  }
  return results;
};

/**
 * GET /api/plans?store=<storeCode>
 * Get all available plans
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllPlans = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - getAllPlans');
    const { store } = req.query;
    let storeModels;
    if (store) {
      const storeModel = await Store.findOne({
        where: {
          storeCode: store,
        },
      });
      storeModels = [storeModel];
    } else {
      storeModels = await Store.findAll();
    }

    let message = 'No plan found';
    const promises: Promise<PlanResponsePayload[]>[] = [];
    for (const currentStore of storeModels) {
      promises.push(getPlansForStore(currentStore));
    }
    const plans = (await Promise.all(promises)).flat();
    if (plans.length > 0) {
      message = 'Plans found';
    }
    retWithSuccess(req, res, {
      message: message,
      data: plans,
    });
  },
);
