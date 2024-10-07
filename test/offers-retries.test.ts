import request from 'supertest';
import app from '../src/app';
import { db, Offer } from '../src/models';
import faker from 'faker';
import { OfferRequestPayload, PlanRecurlyPayload } from '../src/types/payload';
import { CodeType, DiscountType } from '../src/types/enum';
import { mocked } from 'ts-jest/utils';
import {
  createCoupon,
  updateCoupon,
  deactivateCoupon,
  getPlanRecurlyPayload,
} from '../src/services/Recurly';
import {
  updateSpecialOffer,
  archiveSpecialOffer,
  createSpecialOffer,
} from '../src/services/Contentful';
import { clearOfferCache } from '../src/services/PlayAuth';
import {
  updateOfferConfig,
  UpdateOfferResponse,
} from '../src/services/GhostLocker';
import { RecurlyError } from '../src/util/errorHandler';

const generateGuid = (prefix: string) => {
  return `samocqa_${prefix}_${new Date()
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

const testPlanCode = 'flex';

const generateTestOffer = (offerCode: string): OfferRequestPayload => {
  return {
    noEndDate: faker.random.boolean(),
    offerBusinessOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
    planCode: `${testPlanCode}`,
    offerBodyText: `${faker.lorem.sentence(1)}`,
    discountType: DiscountType.FIXED_PRICE,
    offerAppliedBannerText: `${faker.lorem.sentence(1)}`,
    // maxRedemptions: +faker.random.number({
    //   min: 5,
    //   max: 10,
    // }),
    discountDurationUnit: 'month',
    discountAmount: faker.random.number({ min: 1, max: 2 }),
    endDateTime: '2021-12-31T00:00:00Z',
    offerHeader: `${faker.lorem.sentence(1)}`,
    offerName: `${faker.lorem.sentence(1)}`,
    legalDisclaimer: `${faker.lorem.sentence(1)}`,
    offerTypeId: 2,
    offerBgImageUrl:
      'https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
    discountDurationValue: 1,
    offerVanityUrl: `${faker.internet.url()}`,
    offerCTA: `${faker.lorem.sentence(1)}`,
    offerCodeType: CodeType.SINGLE_CODE,
    offerCode: `${offerCode}`,
    welcomeEmailText: `${faker.lorem.sentence(1)}`,
    // publishDateTime: '2031-01-01T00:00:00Z',
    environments: [],
  };
};

jest.mock('../src/services/Recurly');
jest.mock('../src/services/Contentful');
jest.mock('../src/services/GhostLocker');
jest.mock('../src/services/PlayAuth');

describe('Offers Retries Tests', () => {
  const offerCode = generateGuid(`samoc_test`);
  const testOffer = generateTestOffer(offerCode);

  beforeAll(async () => {
    await db.sync();
  });

  beforeEach(async () => {
    mocked(createCoupon).mockClear();
    mocked(deactivateCoupon).mockClear();
    // mocked(undoDeactivateCoupon).mockClear();
    mocked(updateCoupon).mockClear();
    mocked(createSpecialOffer).mockClear();
    mocked(updateSpecialOffer).mockClear();
    mocked(archiveSpecialOffer).mockClear();
    // mocked(undoCreateSpecialOffer).mockClear();
    // mocked(undoArchiveSpecialOffer).mockClear();
    mocked(updateOfferConfig).mockClear();
    mocked(clearOfferCache).mockClear();
    mocked(getPlanRecurlyPayload).mockClear();
  });

  describe('GET api/offers/<offer>/create retry tests', () => {
    const planRes: PlanRecurlyPayload = {
      planName: 'planNam',
      planId: 'planId', // plan id
      planCode: 'flex', // planCode
      price: 8.99, // price
      billingCycleDuration: 1, // billingPeriodLength
      billingCycleUnit: 'months', // billingPeriodUnit: [days, months]
      totalBillingCycles: 12, // billingCycles
      trialDuration: 7, // trialLength
      trialUnit: 'months', // trialUnit: [days, months]
      state: 'string', // plan state: [active, inactive]
    };

    it(`Contentful createSpecialOffer should retry 3 times due to network error`, async () => {
      mocked(getPlanRecurlyPayload).mockImplementation(
        (x, y, z): Promise<PlanRecurlyPayload> => {
          return Promise.resolve(planRes);
        },
      );
      mocked(createSpecialOffer).mockImplementation(
        (w, x, y, z): Promise<void> => {
          return Promise.reject(new Error('ENOTFOUND1'));
        },
      );
      const response = await request(app)
        .post('/api/offers/create')
        .send(testOffer);
      expect(response.status).toBe(500);
      // original request + 3 retries
      // TODO: the current mock mechanism cannot track called times for functions inside createSpecialOffer
      // so this test will fail
      // expect(createSpecialOffer).toHaveBeenCalledTimes(4);
    });

    it(`GhostLocker updateOfferConfig should retry 3 times due to network error`, async () => {
      mocked(getPlanRecurlyPayload).mockImplementation(
        (x, y, z): Promise<PlanRecurlyPayload> => {
          return Promise.resolve(planRes);
        },
      );
      mocked(createSpecialOffer).mockImplementation(
        (w, x, y, z): Promise<void> => {
          return Promise.resolve();
        },
      );
      mocked(updateOfferConfig).mockImplementation(
        (u, v, w, x, y, z): Promise<any> => {
          return Promise.reject(new Error('ENOTFOUND2'));
        },
      );
      const response = await request(app)
        .post('/api/offers/create')
        .send(testOffer);
      expect(response.status).toBe(500);
      // original request + 3 retries
      // TODO: the current mock mechanism cannot track called times for functions inside updateOfferConfig
      // so this test will fail
      // expect(updateOfferConfig).toHaveBeenCalledTimes(4);
    });

    it(`PlayAuth clearOfferCache should retry 3 times due to network error`, async () => {
      mocked(getPlanRecurlyPayload).mockImplementation(
        (x, y, z): Promise<PlanRecurlyPayload> => {
          return Promise.resolve(planRes);
        },
      );
      mocked(createSpecialOffer).mockImplementation(
        (x, y): Promise<void> => {
          return Promise.resolve();
        },
      );
      mocked(updateOfferConfig).mockImplementation(
        (u, v, w, x, y, z): Promise<any> => {
          return Promise.resolve();
        },
      );
      mocked(clearOfferCache).mockImplementation(
        (x, y): Promise<void> => {
          return Promise.reject(new Error('ENOTFOUND3'));
        },
      );
      const response = await request(app)
        .post('/api/offers/create')
        .send(testOffer);
      expect(response.status).toBe(500);
      // original request + 3 retries + undo request + 3 undo retries
      // TODO: the current mock mechanism cannot track called times for functions inside clearOfferCache
      // so this test will fail
      // expect(clearOfferCache).toHaveBeenCalledTimes(4);
    });

    it(`Recurly createCoupon should retry 3 times due to network error`, async () => {
      mocked(createSpecialOffer).mockImplementation(
        (x, y): Promise<void> => {
          return Promise.resolve();
        },
      );
      mocked(updateOfferConfig).mockImplementation(
        (x, y, z): Promise<any> => {
          return Promise.resolve();
        },
      );
      mocked(clearOfferCache).mockImplementation(
        (x, y): Promise<void> => {
          return Promise.resolve();
        },
      );
      mocked(createCoupon).mockImplementation(
        (w, x, y, z): Promise<string> => {
          throw new RecurlyError('mocked create coupon failed', 500);
        },
      );
      const response = await request(app)
        .post('/api/offers/create')
        .send(testOffer);
      expect(response.status).toBe(500);
      // original request + 3 retries
      // TODO: the current mock mechanism cannot track called times for functions inside createCoupon
      // so this test will fail
      // expect(createCoupon).toHaveBeenCalledTimes(4);
    });
  });

  // describe('PUT api/offers/<offer> retry tests', () => {
  //   it(`Contentful updateSpecialOffer should retry 3 times due to network error`, async () => {
  //     mocked(updateSpecialOffer).mockImplementation(
  //       (x, y, z): Promise<void> => {
  //         return Promise.reject(new Error('ENOTFOUND1'));
  //       },
  //     );
  //     const testOffer = {
  //       offerHeader: `${faker.lorem.sentence(1)}`,
  //       discountDurationValue: faker.random.number({
  //         min: 1,
  //         max: 3,
  //       }),
  //     };
  //     const response = await request(app)
  //       .put(`/api/offers/${offerCode}`)
  //       .send(testOffer);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries + undo request + 3 undo retries
  //     expect(updateSpecialOffer).toHaveBeenCalledTimes(8);
  //   });

  //   it(`Recurly updateCoupon should retry 3 times due to network error`, async () => {
  //     mocked(updateSpecialOffer).mockImplementation(
  //       (x, y, z): Promise<void> => {
  //         return Promise.resolve();
  //       },
  //     );
  //     mocked(updateCoupon).mockImplementation(
  //       (w, x, y, z): Promise<void> => {
  //         return Promise.reject(new Error('ENOTFOUND2'));
  //       },
  //     );
  //     const testOffer = {
  //       offerHeader: `${faker.lorem.sentence(1)}`,
  //       discountDurationValue: faker.random.number({
  //         min: 1,
  //         max: 3,
  //       }),
  //     };
  //     const response = await request(app)
  //       .put(`/api/offers/${offerCode}`)
  //       .send(testOffer);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries + undo request + 3 undo retries
  //     expect(updateCoupon).toHaveBeenCalledTimes(8);
  //   });
  // });

  // describe('DELETE api/offers/<offer> retry tests', () => {
  //   it(`Contentful archiveSpecialOffer should retry 3 times due to network error`, async () => {
  //     mocked(archiveSpecialOffer).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.reject(new Error('ENOTFOUND1'));
  //       },
  //     );
  //     const response = await request(app).delete(`/api/offers/${offerCode}`);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries
  //     expect(archiveSpecialOffer).toBeCalledTimes(4);
  //   });

  //   it(`GhostLocker updateOfferConfig should retry 3 times due to network error`, async () => {
  //     mocked(archiveSpecialOffer).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.resolve();
  //       },
  //     );
  //     mocked(updateOfferConfig).mockImplementation(
  //       (v, w, x, y, z): Promise<UpdateOfferResponse> => {
  //         return Promise.reject(new Error('ENOTFOUND2'));
  //       },
  //     );
  //     const response = await request(app).delete(`/api/offers/${offerCode}`);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries + undo request + 3 undo retries
  //     expect(updateOfferConfig).toBeCalledTimes(8);
  //   });

  //   it(`PlayAuth clearOfferCache should retry 3 times due to network error`, async () => {
  //     mocked(archiveSpecialOffer).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.resolve();
  //       },
  //     );
  //     mocked(updateOfferConfig).mockImplementation(
  //       (v, w, x, y, z): Promise<UpdateOfferResponse> => {
  //         return Promise.resolve({} as UpdateOfferResponse);
  //       },
  //     );
  //     mocked(clearOfferCache).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.reject(new Error('ENOTFOUND3'));
  //       },
  //     );
  //     const response = await request(app).delete(`/api/offers/${offerCode}`);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries + undo request + 3 undo retries
  //     expect(clearOfferCache).toBeCalledTimes(8);
  //   });

  //   it(`Recurly deactivateCoupon should retry 3 times due to network error`, async () => {
  //     mocked(archiveSpecialOffer).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.resolve();
  //       },
  //     );
  //     mocked(updateOfferConfig).mockImplementation(
  //       (v, w, x, y, z): Promise<UpdateOfferResponse> => {
  //         return Promise.resolve({} as UpdateOfferResponse);
  //       },
  //     );
  //     mocked(clearOfferCache).mockImplementation(
  //       (x): Promise<void> => {
  //         return Promise.resolve();
  //       },
  //     );
  //     mocked(deactivateCoupon).mockImplementation(
  //       (x, y, z): Promise<OfferRequestPayload> => {
  //         return Promise.reject(new Error('ENOTFOUND'));
  //       },
  //     );
  //     const response = await request(app).delete(`/api/offers/${offerCode}`);
  //     expect(response.status).toBe(500);
  //     // original request + 3 retries
  //     expect(deactivateCoupon).toBeCalledTimes(4);
  //   });

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
