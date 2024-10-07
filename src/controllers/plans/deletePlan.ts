import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { Offer, Plan } from '../../models';
import { getTargetEnvFromStatusId, updateSpinnerText } from '../../util/utils';
import { Env } from '../../types/enum';
import { retWithSuccess } from '../../models/SamocResponse';
import { AppError } from '../../util/errorHandler';
import Logger from '../../util/logger';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Retire Plan Controller:`;
  } else {
    return `Retire Plan Controller:`;
  }
};
/**
 * DELETE /api/plans/:planCode
 * Delete an plan by PlanCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const deletePlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - deletePlan');
    const { planCode } = req.params;
    updateSpinnerText('Retiring plan...');
    let targetEnv: Env;
    try {
      const planModel = await Plan.findByPk(planCode);
      if (planModel) {
        targetEnv = getTargetEnvFromStatusId(planModel.statusId);

        if (targetEnv === Env.STG || targetEnv === Env.PROD) {
          /* [CR2/SAMOC-135] Disable plan management on Recurly/GL/PA
                    // delete plan in Recurly
                    await Recurly.removePlan(planCode, planModel.storeCode, targetEnv);
                    // update PlayAuth plan cache
                    await PlayAuth.deletePlanCache(targetEnv);
                    if (!planCode.includes('nft') && !planCode.includes('internal')) {
                      await PlayAuth.clearPlanCache(planCode, true, targetEnv);
                    }
                     */
        }
        const offersCount = await Offer.count({
          where: {
            planCode: planModel.planCode,
          },
        });
        // if no offer associated with this plan, only then we can delete
        if (offersCount === 0) {
          // delete from DB
          if (targetEnv === Env.PROD) {
            // soft delete when plan is pushed to prod
            await planModel.destroy();
          } else {
            // hard delete if plan is not in prod
            await planModel.destroy({ force: true });
          }
        } else {
          throw new AppError(
            `Plan (${planCode}) cannot be ${
              targetEnv === Env.PROD ? 'retired' : 'deleted'
            } when in use by other offers`,
            406,
          );
        }
        retWithSuccess(req, res, {
          message: `Plan (${planCode}) ${
            targetEnv === Env.PROD ? 'retired' : 'deleted'
          } successfully`,
          data: {},
        });
      } else {
        throw new AppError(`Plan (${planCode}) not found`, 404);
      }
    } catch (err) {
      logger.error(
        `${logPrefix(targetEnv)} deletePlan failed, ${err.message}`,
        err,
      );
      let errMsg =
        'Internal server error. The plan could not be deleted. Please try again later.';
      let status = 500;
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        // DB error - plan has been used by an offer
        errMsg = `The Plan could not be deleted. Plan (${planCode}) has associated offers.`;
        status = 406;
      } else if (err.name.startsWith('Recurly')) {
        // recurly error
        errMsg = `${errMsg} Recurly Error: ${err.message}`;
      } else if (err.statusCode === 406) {
        // association found not allowed
        errMsg = err.message;
        status = err.statusCode;
      } else if (err.isAxiosError) {
        // PlayAuth or GhostLocker errors
        errMsg = `${errMsg} PlayAuth/GhostLocker Error: ${err.message}`;
      } else {
        // unknown error
        errMsg = `${errMsg} Error: ${err.message}`;
      }
      return next(new AppError(errMsg, status));
    }
  },
);
