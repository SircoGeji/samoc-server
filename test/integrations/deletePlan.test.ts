import request from 'supertest';
import server from '../../src/server';
import { db } from '../../src/models';
import { Plan, Offer } from '../../src/models';
import { PlanModel } from '../../src/models/Plan';
import { stageOffer } from '../fixtures/offers';

const generatePlanCode = (name: string) => {
  return `integration_test_code_${name}_${new Date().getTime()}`;
};

const planPayload = () => {
  return {
    planId: 'asdlfj23',
    planCode: generatePlanCode('1'),
    storeCode: 'flex-web-us',
    statusId: 70,
  };
};

describe('delete plan controller', () => {
  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should soft delete plan with status on prod', async (done) => {
    const payload = planPayload();
    await Plan.create(payload);
    const plan = await Plan.findByPk(payload.planCode);
    expect(plan.planCode).toBe(payload.planCode);

    const res = await request(server).delete(`/api/plans/${payload.planCode}`);
    expect(res.status).toBe(200);
    const plan2: PlanModel[] = await Plan.findAll({
      where: {
        planCode: payload.planCode,
      },
      paranoid: false,
    });
    expect(plan2[0].isSoftDeleted()).toBe(true);
    done();
  });

  it('should not be able to delte when plan code is in used by an offer', async (done) => {
    const payload = planPayload();
    await Plan.create(payload);
    const plan = await Plan.findByPk(payload.planCode);
    expect(plan.planCode).toBe(payload.planCode);

    const offerPayload = stageOffer;
    offerPayload.planCode = payload.planCode;
    await Offer.create(offerPayload);
    const of = await Offer.findByPk(offerPayload.offerCode);
    expect(of.planCode).toBe(payload.planCode);

    const res = await request(server).delete(`/api/plans/${payload.planCode}`);
    expect(res.body.message).toMatch(
      `cannot be retired when in use by other offers`,
    );
    expect(res.status).toBe(406);
    done();
  });

  afterEach(async (done) => {
    await db.query(
      "DELETE FROM Offers WHERE offerCode LIKE 'samocqa_create_offer_int_%'",
    );
    await db.query(
      "DELETE FROM Plans WHERE planCode LIKE 'integration_test_code_%'",
    );
    done();
  });

  afterAll((done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});
