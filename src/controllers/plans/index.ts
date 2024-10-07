import {
  PlanRecurlyPayload,
  PlanRequestPayload,
  PlanResponsePayload,
} from '../../types/payload';
import { PlanModel } from '../../models/Plan';
/* [CR2/SAMOC-135] Disable plan management on Recurly/GL/PA
import * as Recurly from '../services/Recurly';
import * as PlayAuth from '../services/PlayAuth';
 */

export const mapFullPlanModelFromPayload = (payload: PlanRequestPayload) => {
  // all fields are editable for draft only
  return {
    ...mapRestrictedPlanModelFromPayload(payload),
    billingPeriodLength: payload.billingCycleDuration,
    billingPeriodUnit: payload.billingCycleUnit,
  };
};

export const mapRestrictedPlanModelFromPayload = (
  payload: PlanRequestPayload,
) => {
  // only these fields are editable once published
  return {
    planCode: payload.planCode,
    price: payload.price,
    termLength: 1, // TODO: get term length from payload
    trialLength: payload.trialDuration,
    trialUnit: payload.trialUnit,
  };
};

export const getPayloadFromModel = (model: any): PlanResponsePayload => {
  return {
    planCode: model.planCode,
    price: model.price,
    billingCycleDuration: model.billingPeriodLength,
    billingCycleUnit: model.billingPeriodUnit,
    trialDuration: model.trialLength,
    trialUnit: model.trialUnit,
    numberOfUsers: 0,
    statusId: model.statusId,
  };
};

export const getPlanResponsePayload = (
  recurlyPlan: PlanRecurlyPayload,
  model: PlanModel,
): PlanResponsePayload => {
  return {
    ...recurlyPlan,
    numberOfUsers: 0,
    storeCode: model.storeCode,
    statusId: model.statusId,
    Status: {
      id: model.Status.statusId,
      title: model.Status.title,
      description: model.Status.description,
    },
  };
};

export { createNewPlan } from './createNewPlan';
export { deletePlan } from './deletePlan';
export { getAllPlans } from './getAllPlans';
export { getPlan } from './getPlan';
export { publishPlan } from './publishPlan';
export { updatePlan } from './updatePlan';
