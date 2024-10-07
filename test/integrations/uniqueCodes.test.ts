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

const generateOfferCode = (name: string) => {
  return `samocqa_${name}_${new Date().getTime()}`;
};
const generateOfferPayload = (offerCode: string): OfferRequestPayload => {
  return {
    offerCode: offerCode,
    offerName: `Offer Integration Test-${offerCode}`,
    offerTypeId: OfferTypes.ACQUISITION,
    offerCodeType: CodeType.BULK_UNIQUE_CODE,
    discountType: DiscountType.FIXED_PRICE,
    planCode: 'flex',
    discountAmount: faker.random.number({ min: 1, max: 2 }),
    discountDurationUnit: 'month',
    discountDurationValue: faker.random.number({
      min: 1,
      max: 3,
    }),
    offerAppliedBannerText: `${faker.lorem.sentence(1)}`,
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

describe('unique codes controller', () => {
  const newCode = generateOfferCode('create_offer_int');
  const newOffer = generateOfferPayload(newCode);

  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should generate unique codes for an existing offer', async (done) => {
    newOffer.totalUniqueCodes = 10;
    const re = await request(server).post('/api/offers/create').send(newOffer);
    expect(re.status).toBe(201);

    const res = await request(server).get(
      `/api/offers/${newCode}/uniqueCodes/generate`,
    );
    expect(res.body.message).toMatch(`Generate unique codes started for`);
    expect(res.status).toBe(200);

    done();
  }, 100000);

  it('should not generate unique codes if it is not a bulk offer', async (done) => {
    const newCode2 = generateOfferCode('create_offer_int');
    const newOffer2 = generateOfferPayload(newCode2);
    newOffer2.offerCodeType = CodeType.SINGLE_CODE;
    const re = await request(server).post('/api/offers/create').send(newOffer2);
    expect(re.status).toBe(201);

    const res = await request(server).get(
      `/api/offers/${newCode2}/uniqueCodes/generate`,
    );
    expect(res.body.message).toMatch(
      `Offer '(${newCode2})' is not a bulk offer on`,
    );
    expect(res.status).toBe(400);
    done();
  }, 100000);

  it('should export the code to csv, and then be able to download it', async (done) => {
    const res = await request(server).get(
      `/api/offers/${newCode}/uniqueCodes/export`,
    );
    expect(res.body.message).toMatch('CSV export requested for');
    expect(res.status).toBe(200);

    // wait for a few second for the file to be exported
    await new Promise((re) => setTimeout(re, 10000));

    const res2 = await request(server).get(
      `/api/offers/${newCode}/uniqueCodes/download`,
    );
    expect(res2.status).toBe(200);
    await db.query(
      "DELETE FROM Offers WHERE offerCode LIKE 'samocqa_create_offer_int_%'",
    );
    done();
  }, 120000);

  afterEach(async (done) => {
    done();
  });

  afterAll((done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});
