import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { PlanModel } from '../../models/Plan';
import { Env, StatusEnum } from '../../types/enum';
import { retWithSuccess } from '../../models/SamocResponse';
import { AppError } from '../../util/errorHandler';
import { getPlanModel, updateSpinnerText } from '../../util/utils';
import Logger from '../../util/logger';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Publish Plan Controller:`;
  } else {
    return `Publish Plan Controller:`;
  }
};
/**
 * GET /api/plans/:planCode/publish
 * Publish an existing plan to production by PlanCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const publishPlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - publishPlan');
    updateSpinnerText('Publishing plan...');
    try {
      const { planCode } = req.params;
      const resultPlan: PlanModel = await _internalPublishPlan(planCode);

      if (
        resultPlan.statusId === StatusEnum.STG ||
        resultPlan.statusId === StatusEnum.PROD
      ) {
        retWithSuccess(req, res, {
          message: `Plan (${planCode}) published successfully`,
          data: resultPlan,
        });
      } else {
        throw new AppError(
          `Plan (${planCode}) publish failed. Invalid status (${resultPlan.statusId})`,
          500,
        );
      }
    } catch (err) {
      // TODO: rollback on error
      logger.error(
        `${logPrefix(Env.PROD)} publishPlan failed, ${err.message}`,
        err,
      );
      let errMsg =
        'Internal server error. The plan could not be published. Please try again later.';
      if (err.name.startsWith('Recurly')) {
        // recurly error
        errMsg = `${errMsg} Recurly Error: ${err.message}`;
      } else if (err.isAxiosError) {
        // PlayAuth or GhostLocker errors
        errMsg = `${errMsg} PlayAuth/GhostLocker Error: ${err.message}`;
      } else {
        // unknown error
        errMsg = `${errMsg} Error: ${err.message}`;
      }
      return next(new AppError(errMsg, 500));
    }
  },
);
/**
 * Common function to publish plan to Recurly, and then update plan to published status
 * The current plan status determines publish target:
 * - Current plan status = DRAFT --> publish to ClientDev
 * - Current plan status = VALIDATED | APPROVED --> publish to PROD
 * @returns PLanModel - plan with updated publish status
 * @param planCode
 */
export const _internalPublishPlan = async (
  planCode: string,
): Promise<PlanModel> => {
  // get associated plan with Brand, Region, and Store info
  const plan: PlanModel = await getPlanModel(planCode);
  // check status
  let targetStatus;
  if (plan.statusId === StatusEnum.DFT) {
    targetStatus = { statusId: StatusEnum.STG };
    // create plan in Recurly ClientDev
    /* [CR2/SAMOC-135] Disable plan management on Recurly/GL/PA
        const recurlyPlan = await Recurly.createPlan(plan, Env.STG);
        if (recurlyPlan) {
          logger.debug(`Plan (${recurlyPlan.name}) created in Recurly ClientDev`);
        }
        await PlayAuth.deletePlanCache(Env.STG);
        if (!planCode.includes('nft') && !planCode.includes('internal')) {
          await PlayAuth.clearPlanCache(planCode, false, Env.STG);
        }
         */
  } else if (plan.statusId === StatusEnum.APV_APRVD) {
    targetStatus = { statusId: StatusEnum.PROD };
    // create plan in Recurly Prod
    /* [CR2/SAMOC-135] Disable plan management on Recurly/GL/PA
        const recurlyPlan = await Recurly.createPlan(plan, Env.PROD);
        if (recurlyPlan) {
          logger.debug(`Plan (${recurlyPlan.name}) created in Recurly PROD`);
        }
        await PlayAuth.deletePlanCache(Env.PROD);
        if (!planCode.includes('nft') && !planCode.includes('internal')) {
          await PlayAuth.clearPlanCache(planCode, false, Env.PROD);
        }
         */
  } else {
    throw new AppError(
      `Plan (${plan.planCode}) cannot be published due to invalid status: ${plan.statusId}`,
      406,
    );
  }
  // update plan in DB with target status
  return await plan.update(targetStatus);
};
