import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import * as cmsapi from '../../src/services/CmsApi';
import {
  CodeType,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../src/types/enum';
import { OfferRequestPayload } from '../../src/types/payload';
import { CmsApiError } from '../../src/util/errorHandler';
import * as validateController from '../../src/controllers/offers/validateOffer';

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
      'https://flex.imgix.net/BuyFlex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
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

describe('get all offers integration test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('list view should not update status to retired when an offer fails in another controller and rollback successfully', async (done) => {
    // create offer
    jest.spyOn(cmsapi, 'clearCmsApiCache').mockImplementationOnce(jest.fn());
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.status).toBe(201);

    // mock check bamboo is busy
    // fail cmsapi
    jest.spyOn(validateController, 'checkBambooIsBusy').mockImplementation(
      async (): Promise<boolean> => {
        return false;
      },
    );
    jest
      .spyOn(cmsapi, 'verifyOffer')
      .mockImplementationOnce((a: string, b: Env) => {
        throw new CmsApiError('mocked failed error for cms api verify offer');
      });
    const res2 = await request(server).get(
      `/api/offers/${testOffer.offerCode}/validate`,
    );
    expect(res2.body.message).toMatch(
      /Validation failed on STG: CmsAPI validation for Offer/,
    );
    const offer = await Offer.findByPk(testOffer.offerCode);
    expect(offer.statusId).toBe(StatusEnum.STG_VALDN_FAIL);

    await request(server).get('/api/offers?store=flex-web-us');
    const offer2 = await await Offer.findByPk(testOffer.offerCode);
    expect(offer2.statusId).toBe(StatusEnum.STG_VALDN_FAIL);

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
