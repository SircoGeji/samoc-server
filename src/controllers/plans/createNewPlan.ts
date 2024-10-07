import asyncHandler from 'express-async-handler';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../util/errorHandler';
import { PlanModel } from '../../models/Plan';
import {
  CreateAction,
  Env,
  RecurlyPlanState,
  StatusEnum,
} from '../../types/enum';
import { Plan } from '../../models';
import { PlanRequestPayload } from '../../types/payload';
import { retWithSuccess } from '../../models/SamocResponse';
import { getPayloadFromModel, mapFullPlanModelFromPayload } from './index';
import Logger from '../../util/logger';
import {
  getStoreModel,
  processPlanError,
  updateSpinnerText,
} from '../../util/utils';
import * as Recurly from '../../services/Recurly';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Create Plan Controller:`;
  } else {
    return `Create Plan Controller:`;
  }
};
/**
 * POST /api/plans/:action=[save,create]?store=<storeCode>
 * Create a new plan
 * @param {Request}     req
 * @param {Response}    res
 */
export const createNewPlan = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('Plans Controller - createNewPlan');
    updateSpinnerText('Adding plan...');
    let createPlanModel: PlanModel;
    try {
      const { store } = req.query;
      const payload = req.body as PlanRequestPayload;
      const storeModel = await getStoreModel(store as string);
      if (!store) {
        throw new AppError(`Invalid Store Code: ${store}`);
      }
      const { action } = req.params;
      if (action === CreateAction.SAVE || action === CreateAction.CREATE) {
        let recurlyPlanStage = null;
        let recurlyPlanProd = null;
        try {
          // check if it exists in Recurly stage
          recurlyPlanStage = await Recurly.getPlanRecurlyPayload(
            payload.planCode,
            storeModel,
            Env.STG,
          );
        } catch (err) {
          if (err.statusCode != 404) {
            throw new AppError(err, 400);
          }
        }
        try {
          // check if plan exists in Recurly Prod
          recurlyPlanProd = await Recurly.getPlanRecurlyPayload(
            payload.planCode,
            storeModel,
            Env.PROD,
          );
        } catch (err) {
          if (err.statusCode != 404) {
            throw new AppError(err, 400);
          }
        }

        if (!recurlyPlanStage && !recurlyPlanProd) {
          throw new AppError(
            `Plan (${payload.planCode}) not found in Recurly Stage and Recurly Prod`,
            400,
          );
        } else if (
          recurlyPlanStage?.state === RecurlyPlanState.INACTIVE &&
          recurlyPlanProd?.state === RecurlyPlanState.INACTIVE
        ) {
          throw new AppError(
            `Plan (${payload.planCode}) is inactive on Recurly Stage and Recurly Prod`,
            400,
          );
        } else if (!recurlyPlanStage) {
          throw new AppError(
            `Plan (${payload.planCode}) not found in Recurly Stage`,
            400,
          );
        } else if (recurlyPlanStage.state === RecurlyPlanState.INACTIVE) {
          throw new AppError(
            `Plan (${payload.planCode}) is inactive on Recurly Stage`,
            400,
          );
        } else if (!recurlyPlanProd) {
          throw new AppError(
            `Plan (${payload.planCode}) not found in Recurly Prod`,
            400,
          );
        } else if (recurlyPlanProd.state === RecurlyPlanState.INACTIVE) {
          throw new AppError(
            `Plan (${payload.planCode}) is inactive on Recurly Stage`,
            400,
          );
        }

        createPlanModel = await Plan.findByPk(payload.planCode, {
          paranoid: false,
        });
        if (createPlanModel) {
          await createPlanModel.restore();
          createPlanModel.set('planId', recurlyPlanProd.planId);
          await createPlanModel.save();
        } else {
          createPlanModel = await Plan.create({
            ...mapFullPlanModelFromPayload(payload),
            planId: recurlyPlanProd.planId,
            storeCode: store as string,
            statusId: StatusEnum.PROD,
            createdBy: 1,
          });
        }
      } else {
        throw new AppError(
          `Plan cannot be saved. Invalid or not supported action: ${action}`,
          405,
        );
      }

      // if (action === CreateAction.CREATE) {
      //   // SAVE then CREATE (PUBLISH TO STG)
      //   createPlanModel = await _internalPublishPlan(createPlanModel.planCode);

      //   if (createPlanModel.statusId === StatusEnum.STG) {
      //     retWithSuccess(req, res, {
      //       message: `Plan (${createPlanModel.planCode}) published successfully`,
      //       status: 201,
      //       data: getPayloadFromModel(createPlanModel),
      //     });
      //   } else {
      //     throw new AppError(
      //       `PLan (${createPlanModel.planCode}) creation failed. Invalid status (${createPlanModel.statusId})`,
      //       500,
      //     );
      //   }
      // } else if (action === CreateAction.SAVE) {
      retWithSuccess(req, res, {
        message: `Plan (${createPlanModel.planCode}) added successfully`,
        status: 201,
        data: getPayloadFromModel(createPlanModel),
      });
      // }
    } catch (err) {
      logger.error(
        `${logPrefix(Env.STG)} createNewPlan failed, ${err.message}`,
        err,
      );
      return next(processPlanError(err));
    }
  },
);
