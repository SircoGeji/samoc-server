import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import { StoreModel } from '../../src/models/Store';
import * as playauth from '../../src/services/PlayAuth';
import * as recurly from '../../src/services/Recurly';
import * as contentful from '../../src/services/Contentful';
import * as ghostlocker from '../../src/services/GhostLocker';
import {
  CodeType,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../src/types/enum';
import {
  OfferRecurlyPayload,
  OfferRequestPayload,
  PlanRecurlyPayload,
} from '../../src/types/payload';
import {
  GhostLockerError,
  RecurlyError,
  ValidateGhostLockerError,
} from '../../src/util/errorHandler';
import { GLSet } from '../../src/services/GhostLocker';

jest.mock('../../src/validators/Offer', () => ({
  offerValidationRules: jest.fn((method?: string) => {
    return [];
  }),
}));

const generateOfferCode = (name: string) => {
  return `samocqa_${name}_${new Date().getTime()}`;
};
const testPlanCode = 'flex';
const generateOfferPayload = (offerCode: string): OfferRequestPayload => {
  return {
    offerCode: offerCode,
    offerName: `Offer Integration Test-${offerCode}`,
    offerTypeId: OfferTypes.ACQUISITION,
    offerCodeType: CodeType.SINGLE_CODE,
    discountType: DiscountType.FIXED_PRICE,
    planCode: testPlanCode,
    discountAmount: faker.random.number({ min: 1, max: 2 }),
    discountDurationUnit: 'month',
    discountDurationValue: faker.random.number({
      min: 1,
      max: 3,
    }),
    offerAppliedBannerText: `${faker.lorem.sentence(5)}`,
    offerBgImageUrl:
      'https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
    offerBodyText: `${faker.lorem.sentence(1)}`,
    offerBoldedText: ``,
    offerBusinessOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
    offerCTA: `${faker.lorem.sentence(1)}`,
    offerHeader: `${faker.lorem.sentence(1)}`,
    offerVanityUrl: `${faker.internet.url()}`,
    legalDisclaimer: `${faker.lorem.sentence(1)}`,
    welcomeEmailText: `${faker.lorem.sentence(1)}`,
    publishDateTime: '2021-11-01T00:00:00Z',
    endDateTime: '2021-12-31T00:00:00Z',
    noEndDate: faker.random.boolean(),
    environments: [],
  };
};

describe('Create Offer Integration Test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  // let spy: jest.SpyInstance;
  beforeAll(async (done) => {
    //start the server before any test
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should not allow a second GhostLocker connection and thus fail on the second create post, and rollback to STG_FAIL', async (done) => {
    const offerCode2 = generateOfferCode('create_offer_int');
    const testOffer2 = generateOfferPayload(offerCode2);

    const res = request(server).post('/api/offers/create').send(testOffer);
    const res2 = request(server).post('/api/offers/create').send(testOffer2);
    const promises = [res, res2];

    const results = await Promise.allSettled(promises);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const firstRequest = results[0].value;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const secondRequest = results[1].value;
    if (firstRequest.status === 201) {
      const offer = await Offer.findByPk(secondRequest.request._data.offerCode);
      expect(secondRequest.body.message).toMatch('GhostLocker is busy');
      expect(secondRequest.status).toBe(500);
      expect(offer.statusId).toBe(StatusEnum.STG_FAIL);
    } else {
      const offer = await Offer.findByPk(firstRequest.request._data.offerCode);
      expect(secondRequest.status).toBe(201);
      expect(firstRequest.body.message).toMatch('GhostLocker is busy');
      expect(firstRequest.status).toBe(500);
      expect(offer.statusId).toBe(StatusEnum.STG_FAIL);
    }
    await Offer.destroy({ where: { offerCode: offerCode2 }, force: true });
    done();
  }, 120000);

  it('should fail to retrieve plan from Recurly', async (done) => {
    jest
      .spyOn(recurly, 'getPlanRecurlyPayload')
      .mockImplementation((x: string, y: StoreModel, z: Env) => {
        throw new RecurlyError('mocked retrieve recurly plan failed', 400);
      });
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.body.message).toMatch(/mocked retrieve recurly plan failed/);
    expect(res.status).toBe(400);
    done();
  });

  it('should fail to create coupon on Recurly', async (done) => {
    jest
      .spyOn(recurly, 'createCoupon')
      .mockImplementation(
        (
          w: OfferRecurlyPayload,
          x: PlanRecurlyPayload,
          y: StoreModel,
          z: Env,
          d?: StatusEnum,
        ) => {
          throw new RecurlyError('mocked create recurly coupon failed', 400);
        },
      );
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.body.message).toMatch(/mocked create recurly coupon failed/);
    expect(res.status).toBe(400);
    done();
  });

  it('should fail to validate GL and trigger a rollback', async (done) => {
    jest
      .spyOn(playauth, 'validateGl')
      .mockImplementation((w: string, x: Env, y: string, z: string) => {
        throw new ValidateGhostLockerError(
          'mocked cms api check offer code failed',
          404,
        );
      });
    const spy1 = jest.spyOn(contentful, 'archiveSpecialOffer');
    const spy2 = jest.spyOn(ghostlocker, 'rollbackToVersion');
    const spy3 = jest.spyOn(recurly, 'deactivateCoupon');
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.body.message).toMatch(/mocked cms api check offer code failed/);
    expect(spy1).toBeCalledTimes(0); // never made it to Contentful
    expect(spy2).toBeCalledTimes(1);
    expect(spy3).toBeCalledTimes(1);
    expect(res.status).toBe(404);
    done();
  });

  it('should fail to validate GL and trigger a rollback, then fails the GL rollback', async (done) => {
    jest
      .spyOn(playauth, 'validateGl')
      .mockImplementation((w: string, x: Env, y: string, z: string) => {
        throw new ValidateGhostLockerError(
          'mocked cms api check offer code failed',
          404,
        );
      });
    const spy1 = jest.spyOn(contentful, 'archiveSpecialOffer');
    const spy2 = jest
      .spyOn(ghostlocker, 'rollbackToVersion')
      .mockImplementation((glSet: GLSet, x: string, y: number, z: Env) => {
        throw new GhostLockerError(
          'mocked ghost locker rollbackToVersion error',
          400,
        );
      });
    const spy3 = jest.spyOn(recurly, 'deactivateCoupon');
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);

    expect(res.body.message).toMatch(/Rollback failed for Create Offer on/);
    expect(spy1).toBeCalledTimes(0); // never made it to Contentful
    expect(spy2).toBeCalledTimes(1);
    expect(spy3).toBeCalledTimes(0);
    expect(res.status).toBe(400);
    done();
  });

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
