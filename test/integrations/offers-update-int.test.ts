import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import { PlanModel } from '../../src/models/Plan';
import * as cmsapi from '../../src/services/CmsApi';
import * as contentful from '../../src/services/Contentful';
import {
  CodeType,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../src/types/enum';
import {
  OfferContentfulPayload,
  OfferRequestPayload,
  PlanRecurlyPayload,
} from '../../src/types/payload';
import { CmsApiError } from '../../src/util/errorHandler';

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

describe('Update Offer Integration Test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should have rollback with failed status when rolling back', async (done) => {
    // create offer
    jest.spyOn(cmsapi, 'clearCmsApiCache').mockImplementation(jest.fn());
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.status).toBe(201);

    // mock contentful updateSpecialOffer to throw CmsApiError, which will
    // get called again in rollbackOffer if instanceof CmsApiError
    jest
      .spyOn(contentful, 'updateSpecialOffer')
      .mockImplementation(
        (
          w: OfferContentfulPayload,
          x: string,
          y: PlanModel,
          z: Env,
          a: PlanRecurlyPayload,
        ) => {
          throw new CmsApiError('mocked cms api check offer code failed', 404);
        },
      );
    testOffer.offerName = 'some random new name';
    const body = { ...testOffer };
    delete body.offerCode;
    delete body.planCode;
    const res2 = await request(server)
      .put(`/api/offers/${testOffer.offerCode}`)
      .send(body);
    expect(res2.body.message).toMatch(/Rollback failed for Update Offer/);
    expect(res2.body.message).toMatch(/mocked cms api check offer code failed/);
    const offer = await Offer.findByPk(testOffer.offerCode);
    expect(offer.statusId).toBe(StatusEnum.STG_RB_FAIL);

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
