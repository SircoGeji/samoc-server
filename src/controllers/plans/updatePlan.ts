import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import {
  getPlanModel,
  getTargetEnvFromStatusId,
  updateSpinnerText,
} from '../../util/utils';
import { AppError } from '../../util/errorHandler';
import { Env, StatusEnum } from '../../types/enum';
import { PlanAttributes, PlanModel } from '../../models/Plan';
import { PlanRequestPayload } from '../../types/payload';
import { retWithSuccess } from '../../models/SamocResponse';
import Logger from '../../util/logger';
import {
  getPayloadFromModel,
  mapFullPlanModelFromPayload,
  mapRestrictedPlanModelFromPayload,
} from './index';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Update Plan Controller:`;
  } else {
    return `Update Plan Controller:`;
  }
};
/**
 * PUT /api/plans/:planCode
 * Update an existing plan by PlanCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const updatePlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - updatePlan');
    updateSpinnerText('Updating plan...');
    let targetEnv: Env;
    try {
      const { planCode } = req.params;
      const foundPlan = await getPlanModel(planCode);
      if (!foundPlan) {
        throw new AppError(`Plan (${planCode}) not found`, 404);
      }

      targetEnv = getTargetEnvFromStatusId(foundPlan.statusId);

      // valid status, continue...
      // Prepare the update model
      const updatePlanModel: PlanAttributes = getUpdatePlanModel(
        req.body as PlanRequestPayload,
        foundPlan.statusId,
      );
      if (targetEnv === Env.STG || targetEnv === Env.PROD) {
        // Recurly update
        /* [CR2/SAMOC-135] Disable plan management on Recurly/GL/PA
                const recurlyPlan = await Recurly.updatePlan(
                  foundPlan,
                  updatePlanModel,
                  targetEnv,
                );
                if (recurlyPlan) {
                  logger.debug(
                    `Plan (${recurlyPlan.name}) with code (${recurlyPlan.code}) and id (${recurlyPlan.id}) updated in Recurly`,
                  );
                }
                 */
      }

      // Proceed to update db last
      const updateResult: PlanModel = await foundPlan.update(updatePlanModel);

      if (updateResult.statusId === foundPlan.statusId) {
        // status shouldn't change on update
        retWithSuccess(req, res, {
          message: `Plan (${planCode}) updated successfully`,
          data: getPayloadFromModel(updateResult),
        });
      } else {
        throw new AppError(
          `Plan (${planCode}) was not updated, update result: ${updateResult}`,
          500,
        );
      }
    } catch (err) {
      // TODO: rollback on error
      logger.error(
        `${logPrefix(targetEnv)} updatePlan failed, ${err.message}`,
        err,
      );
      let errMsg =
        'Internal server error. The plan could not be updated. Please try again later.';
      if (err.name.startsWith('Recurly')) {
        // recurly error
        errMsg = `${errMsg} Recurly Error: ${err.message}`;
      } else {
        // unknown error
        errMsg = `${errMsg} Error: ${err.message}`;
      }
      return next(new AppError(errMsg, 500));
    }
  },
);

const getUpdatePlanModel = (
  payload: PlanRequestPayload,
  statusId: StatusEnum,
): PlanAttributes => {
  if (statusId === StatusEnum.DFT) {
    // allow to edit all fields for draft only
    return {
      ...mapFullPlanModelFromPayload(payload),
      lastModifiedBy: 1, // TODO: get current user
    };
  }
  // cannot edit billing period fields once published
  return {
    ...mapRestrictedPlanModelFromPayload(payload),
    lastModifiedBy: 1, // TODO: get current user
  };
};
