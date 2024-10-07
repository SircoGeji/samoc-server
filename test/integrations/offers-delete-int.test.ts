import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import { StoreModel } from '../../src/models/Store';
import * as cmsapi from '../../src/services/CmsApi';
import * as recurly from '../../src/services/Recurly';
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
} from '../../src/types/payload';
import { CmsApiError, RecurlyError } from '../../src/util/errorHandler';

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

describe('Delete Offer Integration Test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should have rollback failed status when rolling back', async (done) => {
    // create offer
    jest.spyOn(cmsapi, 'clearCmsApiCache').mockImplementationOnce(jest.fn());
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    expect(res.status).toBe(201);

    // delete offer
    // fail step 5 clear aws cache
    // fail rollback restore coupon
    jest
      .spyOn(cmsapi, 'clearCmsApiCache')
      .mockImplementation((targetEnv: Env) => {
        throw new CmsApiError('mocked failed clear cached cms api error');
      });
    jest
      .spyOn(recurly, 'restoreCoupon')
      .mockImplementation(
        (a: OfferRecurlyPayload, b: string, c: StoreModel, d: Env) => {
          throw new RecurlyError('mocked failed recurly restore coupon error');
        },
      );
    const res2 = await request(server).delete(
      `/api/offers/${testOffer.offerCode}`,
    );
    expect(res2.body.message).toMatch(/Rollback failed for Retire Offer/);
    expect(res2.body.message).toMatch(
      /mocked failed recurly restore coupon error/,
    );
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
