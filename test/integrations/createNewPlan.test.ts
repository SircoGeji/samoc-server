import request from 'supertest';
import server from '../../src/server';
import { db } from '../../src/models';

const generatePlanCode = (name: string) => {
  return `integration_test_code_${name}_${new Date().getTime()}`;
};

describe('create new plan controller', () => {
  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should fail to create new plan that is not on prod or stg', async (done) => {
    const storeCode = 'flex-web-us';
    const planCode = generatePlanCode('1');
    const res = await request(server)
      .post(`/api/plans/create?store=${storeCode}`)
      .send({ planCode: planCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(
      'not found in Recurly Stage and Recurly Prod',
    );
    done();
  });

  it('should return 201 when creating plan that already on prod and stg', async (done) => {
    const storeCode = 'flex-web-us';
    const planCode = 'flex';
    const res = await request(server)
      .post(`/api/plans/create?store=${storeCode}`)
      .send({ planCode: planCode });
    expect(res.status).toBe(201);
    done();
  });

  afterEach(async (done) => {
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
