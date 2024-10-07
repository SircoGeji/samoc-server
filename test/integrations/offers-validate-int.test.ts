import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import * as cmsapi from '../../src/services/CmsApi';
import * as ghostlocker from '../../src/services/GhostLocker';
import {
  CodeType,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../src/types/enum';
import { OfferRequestPayload } from '../../src/types/payload';
import { CmsApiError, GhostLockerError } from '../../src/util/errorHandler';
import * as validateController from '../../src/controllers/offers/validateOffer';
import { GLSet } from '../../src/services/GhostLocker';

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

describe('Validate Offer Integration Test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  beforeAll(async (done) => {
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should rollback and rollback successfully', async (done) => {
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
    done();
  });

  it('should rollback due to validation fail with ghostlocker and rollback successfully', async (done) => {
    const newCode = generateOfferCode('create_offer_int');
    const newOffer = generateOfferPayload(newCode);
    // create offer
    jest.spyOn(cmsapi, 'clearCmsApiCache').mockImplementationOnce(jest.fn());
    const res = await request(server).post('/api/offers/create').send(newOffer);
    expect(res.status).toBe(201);

    jest.spyOn(validateController, 'checkBambooIsBusy').mockImplementation(
      async (): Promise<boolean> => {
        return false;
      },
    );
    jest
      .spyOn(ghostlocker, 'promoOfferExists')
      .mockImplementationOnce((a: string, b: string, c: Env) => {
        throw new GhostLockerError(
          'mocked ghost locker error for promoOfferExists',
        );
      });

    const res2 = await request(server).get(
      `/api/offers/${newOffer.offerCode}/validate`,
    );
    expect(res2.body.message).toMatch(
      /mocked ghost locker error for promoOfferExists/,
    );
    const offer = await Offer.findByPk(newOffer.offerCode);
    expect(offer.statusId).toBe(StatusEnum.STG_VALDN_FAIL);
    done();
  });

  it('should rollback and failed during rollback', async (done) => {
    const code = generateOfferCode('create_offer_int');
    const testOffer2 = generateOfferPayload(code);
    // create offer
    jest.spyOn(cmsapi, 'clearCmsApiCache').mockImplementationOnce(jest.fn());
    const res = await request(server)
      .post('/api/offers/create')
      .send(testOffer2);
    expect(res.status).toBe(201);

    // mock check bamboo is busy
    // fail cmsapi
    // fail rollback
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
    jest
      .spyOn(ghostlocker, 'rollbackToVersion')
      .mockImplementation((glSet: GLSet, a: string, b: number, c: Env) => {
        throw new GhostLockerError(
          'mocked ghost locker roll back to version failed',
        );
      });
    const res2 = await request(server).get(
      `/api/offers/${testOffer2.offerCode}/validate`,
    );
    expect(res2.body.message).toMatch(/Rollback failed for Validate Offer on/);
    const offer = await Offer.findByPk(testOffer2.offerCode);
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
