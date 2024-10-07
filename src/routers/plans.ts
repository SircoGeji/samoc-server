import * as controller from '../controllers/plans';
import { createNewPlan } from '../controllers/plans';
import { returnNotAllowed } from '../controllers/notallowed';
import planValidationRules from '../validators/Plan';
import { validate } from '../middleware/validator';
import express = require('express');

const plans = express.Router({ mergeParams: true });

/**
 * Get all plans
 * GET /api/plans
 */
plans.get('/', controller.getAllPlans);

/**
 * Get a new plan
 * POST /api/plans:action
 *
 * :action can be [save, create]
 *   - save   : save to db only
 *   - create : save and create on STG
 */
plans.post(
  '/:action',
  planValidationRules('createNewPlan'),
  validate,
  controller.createNewPlan,
);

/**
 * Get an existing plan
 * GET /api/plans/:planCode
 */
plans.get('/:planCode', controller.getPlan);

/**
 * Update an existing plan
 * PUT /api/plans/:planCode
 */
plans.put('/:planCode', controller.updatePlan);

/**
 * Delete an existing plan
 * DELETE /api/plans/:planCode
 */
plans.delete('/:planCode', controller.deletePlan);

/**
 * Publish an existing plan
 * GET /api/plans/:planCode/publish
 */
plans.get('/:planCode/publish', controller.publishPlan);

/**
 * Not allowed handler
 */
plans.all('/', returnNotAllowed(['get', 'post']));
plans.all('/:planCode', returnNotAllowed(['get', 'put', 'delete']));
plans.all('/:planCode/publish', returnNotAllowed(['get']));

export default plans;
