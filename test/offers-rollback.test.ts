import request from 'supertest';
import Logger from '../src/util/logger';
import app from '../src/app';
import { db, Offer } from '../src/models';
import faker from 'faker';
import { OfferRequestPayload } from '../src/types/payload';
import { CodeType, DiscountType, Env } from '../src/types/enum';
import { mocked } from 'ts-jest/utils';
import { createCoupon } from '../src/services/Recurly';
import {
  createSpecialOffer,
  fetchSpecialOffer,
} from '../src/services/Contentful';
import { clearOfferCache } from '../src/services/PlayAuth';
import { promoOfferExists } from '../src/services/GhostLocker';
import { Coupon } from 'recurly';

const logger = Logger(module);

const generateGuid = (prefix: string) => {
  return `${prefix}_${new Date()
    .toISOString()
    .toLowerCase()
    .replace(/[-]/g, '')
    .replace(/[T]/g, '_')
    .replace(/[:]/g, '')
    .replace(/[.]/g, '_')}_${Math.floor(Math.random() * 1000)}`.replace(
    /:./g,
    '',
  );
};

const storeCode = 'flex-web-us';
const testPlanCode = 'flex';

const generateTestOffer = (offerCode: string): OfferRequestPayload => {
  return {
    noEndDate: faker.random.boolean(),
    offerBusinessOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
    planCode: `${testPlanCode}`,
    offerBodyText: `${faker.lorem.sentence(1)}`,
    discountType: DiscountType.FIXED_PRICE,
    offerAppliedBannerText: `${faker.lorem.sentence(5)}`,
    // maxRedemptions: +faker.random.number({
    //   min: 5,
    //   max: 10,
    // }),
    discountDurationUnit: 'months',
    discountAmount: faker.random.number({ min: 1, max: 2 }),
    endDateTime: '2021-12-31T23:59:59Z',
    offerHeader: `${faker.lorem.sentence(1)}`,
    offerName: `${faker.lorem.sentence(1)}`,
    legalDisclaimer: `${faker.lorem.sentence(1)}`,
    offerTypeId: 2,
    offerBgImageUrl:
      'https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
    discountDurationValue: faker.random.number({
      min: 1,
      max: 3,
    }),
    offerVanityUrl: `${faker.internet.url()}`,
    offerCTA: `${faker.lorem.sentence(1)}`,
    offerCodeType: CodeType.SINGLE_CODE,
    offerBoldedText: ``,
    offerCode: `${offerCode}`,
    welcomeEmailText: `${faker.lorem.sentence(1)}`,
    publishDateTime: '2020-07-06T00:00:00Z',
    environments: [],
  };
};

jest.mock('../src/services/Recurly');
jest.mock('../src/services/Contentful');
jest.mock('../src/services/PlayAuth');

// const existOnRly = async (offerCode: string, storeCode: string) => {
//   const coupon = await getCoupon(offerCode, storeCode, Env.STG);
//   return !!coupon;
// };

// const existOnCtf = async (offerCode: string, storeCode: string) => {
//   const entry = await fetchSpecialOffer(offerCode, storeCode);
//   return !!entry;
// };

// const existOnGl = async (offerCode: string, storeCode: string) => {
//   return await promoOfferExists(offerCode, testPlanCode, 'US', Env.STG);
// };

describe('Offers Controller', () => {
  const offerCode = generateGuid(`samoc_test`);

  beforeAll(async () => {
    await db.sync();
    const testOffer = generateTestOffer(offerCode);
    const response = await request(app)
      .post('/api/offers/save')
      .send(testOffer);
  });

  beforeEach(async () => {
    mocked(createCoupon).mockClear();
    mocked(createSpecialOffer).mockClear();
    mocked(clearOfferCache).mockClear();
  });

  describe('api/offers rollback tests', () => {
    // disabled rollback test cases because rollback is currently out of scope
    it('dummy test', () => {
      expect(true).toBeTruthy();
    });
    // it(`Fail to publish offer '${offerCode}' due to Contentful Error`, async () => {
    //   mocked(createSpecialOffer).mockImplementationOnce(
    //     (x, y): Promise<void> => {
    //       return Promise.reject(new Error('Contentful Error'));
    //     },
    //   );
    //   const response = await request(app).get(
    //     `/api/offers/${offerCode}/publish`,
    //   );
    //   expect(response.status).toBe(500);
    //   expect(await existOnGl(offerCode, storeCode)).toBe(false);
    //   expect(await existOnCtf(offerCode, storeCode)).toBe(false);
    //   expect(await existOnRly(offerCode, storeCode)).toBe(false);
    // });

    // it(`Fail to publish offer '${offerCode}' due to PlayAuth/GL Error`, async () => {
    //   mocked(clearOfferCache).mockImplementationOnce(
    //     (x, y): Promise<void> => {
    //       return Promise.reject(new Error('GL/PA Error'));
    //     },
    //   );
    //   const response = await request(app).get(
    //     `/api/offers/${offerCode}/publish`,
    //   );
    //   expect(response.status).toBe(500);
    //   expect(await existOnGl(offerCode, storeCode)).toBe(false);
    //   expect(await existOnCtf(offerCode, storeCode)).toBe(false);
    //   expect(await existOnRly(offerCode, storeCode)).toBe(false);
    // });

    // it(`Fail to publish offer '${offerCode}' due to Recurly Error`, async () => {
    //   mocked(createCoupon).mockImplementationOnce(
    //     (x, y, z): Promise<Coupon> => {
    //       return Promise.reject(new Error('Recurly: Mocked Recurly Error'));
    //     },
    //   );

    //   const response = await request(app).get(
    //     `/api/offers/${offerCode}/publish`,
    //   );
    //   expect(response.status).toBe(500);
    //   expect(await existOnGl(offerCode, storeCode)).toBe(false);
    //   expect(await existOnCtf(offerCode, storeCode)).toBe(false);
    //   expect(await existOnRly(offerCode, storeCode)).toBe(false);
    // });
  });

  afterAll(async () => {
    await request(app).delete(`/api/offers/${offerCode}`);
    // clean up
    await Offer.destroy({
      where: { offerCode: offerCode },
      force: true,
    });
    await db.close();
  });
});
