import request from 'supertest';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import { stageOffer } from '../fixtures/offers';

const generateOfferCode = (name: string) => {
  return `samocqa_${name}_${new Date().getTime()}`;
};

describe('validator controller', () => {
  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should validate plan and fail with a wrong store code', async (done) => {
    const storeCode = 'invalid-flex-web-us';
    const planCode = 'flex';
    const res = await request(server).get(
      `/api/validator/plan/${storeCode}/${planCode}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(
      `Store '${storeCode}' not found or invalid, unable to verify.`,
    );
    done();
  });

  it('should validate plan and fail with wrong plan code on recurly', async (done) => {
    const storeCode = 'flex-web-us';
    const planCode = 'invalid-flex';
    const res = await request(server).get(
      `/api/validator/plan/${storeCode}/${planCode}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(
      `Couldn't find Plan with code = ${planCode}`,
    );
    done();
  });

  it('should validate offer and fail with offer in db', async (done) => {
    await Offer.create(stageOffer);
    const of = await Offer.findByPk(stageOffer.offerCode);
    expect(of.offerCode).toBe(stageOffer.offerCode);

    const storeCode = 'flex-web-us';
    const res2 = await request(server).get(
      `/api/validator/offer/${storeCode}/${stageOffer.offerCode}`,
    );

    expect(res2.status).toBe(409);
    expect(res2.body.message).toMatch(
      `Offer code '${stageOffer.offerCode}' already exists in the database`,
    );
    done();
  }, 100000);

  it('should validate offerCode and succeed', async (done) => {
    const storeCode = 'flex-web-us';
    const offerCode1 = generateOfferCode('create_offer_int');
    const res = await request(server).get(
      `/api/validator/offer/${storeCode}/${offerCode1}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(
      `Offer code '${offerCode1}' is valid and good to use.`,
    );
    done();
  }, 100000);

  afterEach(async (done) => {
    await db.query(
      "DELETE FROM Offers WHERE offerCode LIKE 'samocqa_create_offer_int_%'",
    );
    done();
  });

  afterAll((done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});
