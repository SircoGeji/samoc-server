import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import { PlanModel } from '../src/models/Plan';
import { PlanRequestPayload } from '../src/types/payload';
import faker from 'faker';
import { StatusEnum } from '../src/types/enum';

const storeCode = 'flex-web-us';
const planCode = `samoc_testplan_${new Date()
  .toISOString()
  .replace(/\..*Z/g, '')
  .replace(/[-]/g, '')
  .replace(/[T]/g, '_')
  .replace(/[:]/g, '')
  .replace(/[.]/g, '_')}_${Math.floor(Math.random() * 1000)}`.replace(
  /:./g,
  '',
);
const existingPlanCode = 'flexy';

const generateTestPlan = (testPlanCode: string): PlanRequestPayload => {
  return {
    planCode: testPlanCode,
    price: faker.random.number({ min: 10, max: 100, precision: 2 }),
    billingCycleDuration: faker.random.number({ min: 1, max: 3 }),
    billingCycleUnit: 'months',
    trialDuration: faker.random.number({ min: 1, max: 14 }),
    trialUnit: 'days',
  } as PlanRequestPayload;
};

describe('Plans Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('api/plans', () => {
    // disable plan creation test for now - we can only create plans that exist in STG & PROD
    // it('Fail to create new plan', async () => {
    //   const testPlan = generateTestPlan(planCode);
    //   testPlan.planCode = testPlan.planCode + 'A';
    //   testPlan.price = 12.345;
    //   const response = await request(app)
    //     .post(`/api/plans/save?store=${storeCode}`)
    //     .send(testPlan);
    //   expect(response.status).toBe(422);
    //   expect(response.body.errors.length).toBe(2);
    // });

    // it('Create new draft plan', async () => {
    //   const testPlan = generateTestPlan(planCode);
    //   const response = await request(app)
    //     .post(`/api/plans/save?store=${storeCode}`)
    //     .send(testPlan);
    //   expect(response.status).toBe(201);
    //   expect(response.body.data.planCode).toBe(planCode);
    // });

    it('GET all plans', async () => {
      const response = await request(app).get(`/api/plans?store=${storeCode}`);
      expect(response.status).toBe(200);
      expect(
        response.body.data.every((plan: PlanModel) => plan.planCode),
      ).toBeTruthy();
    });

    it('PUT should return 405', (done) => {
      request(app).put('/api/plans').expect(405, done);
    });

    it('DELETE should return 405', (done) => {
      request(app).delete('/api/plans').expect(405, done);
    });

    it('Get a plan by plan code', async () => {
      const response = await request(app).get(`/api/plans/${existingPlanCode}`);
      expect(response.status).toBe(200);
      expect(response.body.data.planCode).toBe(existingPlanCode);
    });

    it('Should fail to get a plan by an invalid plan code', async () => {
      const response = await request(app).get(
        `/api/plans/thisisaninvalidplancode`,
      );
      expect(response.status).toBe(404);
    });

    // update/delete plan are currently disabled
    // it(`Update a draft plan "${planCode}" by plan code`, async () => {
    //   const updatePlanPayload = generateTestPlan(planCode);
    //   updatePlanPayload.planCode = undefined;
    //   const response = await request(app)
    //     .put(`/api/plans/${planCode}`)
    //     .send(updatePlanPayload);
    //   expect(response.status).toBe(200);
    //   expect(response.body.data.planCode).toBe(planCode); // # of record changed
    //   expect(response.body.data.billingCycleDuration).toBe(
    //     updatePlanPayload.billingCycleDuration,
    //   );
    //   expect(response.body.data.billingCycleUnit).toBe(
    //     updatePlanPayload.billingCycleUnit,
    //   );
    //   expect(response.body.data.statusId).toBe(StatusEnum.DFT);
    // });

    // it(`Publish a plan "${planCode}" by plan code`, async () => {
    //   const response = await request(app).get(`/api/plans/${planCode}/publish`);
    //   expect(response.status).toBe(200);
    //   expect(response.body.data.planCode).toBe(planCode); // # of record updated
    //   expect(response.body.data.statusId).toBe(StatusEnum.STG);
    // });

    // it(`Update a published plan ${planCode} by plan code`, async () => {
    //   const updatePlanPayload = generateTestPlan(planCode);
    //   updatePlanPayload.planCode = undefined;
    //   updatePlanPayload.billingCycleDuration = 10;
    //   updatePlanPayload.billingCycleUnit = 'days';
    //   const response = await request(app)
    //     .put(`/api/plans/${planCode}`)
    //     .send(updatePlanPayload);
    //   expect(response.status).toBe(200);
    //   expect(response.body.data.planCode).toBe(planCode); // # of record changed
    //   expect(response.body.data.billingCycleDuration).not.toBe(
    //     updatePlanPayload.billingCycleDuration,
    //   );
    //   expect(response.body.data.billingCycleUnit).not.toBe(
    //     updatePlanPayload.billingCycleUnit,
    //   );
    //   expect(response.body.data.statusId).toBe(StatusEnum.STG);
    // });

    // it(`Delete a plan "${planCode}" by plan code`, async () => {
    //   const response = await request(app).delete(`/api/plans/${planCode}`);
    //   expect(response.status).toBe(200);
    //   expect(response.body.message).toContain('deleted successfully'); // # of record deleted
    // });
  });

  afterAll(async () => {
    await db.close();
  });
});
