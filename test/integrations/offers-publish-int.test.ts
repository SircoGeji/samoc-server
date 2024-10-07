import request from 'supertest';
import faker from 'faker';
import server from '../../src/server';
import { db } from '../../src/models';
import { Offer } from '../../src/models';
import {
  CodeType,
  DiscountType,
  Env,
  OfferTypes,
  StatusEnum,
} from '../../src/types/enum';
import { OfferRequestPayload } from '../../src/types/payload';
import { CmsApiError, GhostLockerError } from '../../src/util/errorHandler';
import * as CmsApi from '../../src/services/CmsApi';
import * as GhostLocker from '../../src/services/GhostLocker';
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

describe('Publish Offer Integration Test', () => {
  const offerCode = generateOfferCode('create_offer_int');
  const testOffer = generateOfferPayload(offerCode);

  const offerCode2 = generateOfferCode('create_offer_int');
  const testOffer2 = generateOfferPayload(offerCode2);

  beforeAll(async (done) => {
    //start the server before any test
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  it('should fail during publish, then fails the rollback with correct status', async (done) => {
    const newCode = generateOfferCode('create_offer_int');
    const newOffer = generateOfferPayload(newCode);
    const re = await request(server).post('/api/offers/create').send(newOffer);
    expect(re.status).toBe(201);
    await Offer.update(
      { statusId: StatusEnum.STG_VALDN_PASS },
      { where: { offerCode: newCode } },
    );

    jest.spyOn(CmsApi, 'clearCmsApiCache').mockImplementation((env: Env) => {
      throw new CmsApiError('mocked cms api clearCmsApiCache failure');
    });
    jest
      .spyOn(GhostLocker, 'rollbackToVersion')
      .mockImplementation((glSet: GLSet, a: string, b: number, c: Env) => {
        throw new GhostLockerError(
          'mocked ghostlocker rollbackToVersion failure',
        );
      });

    const res1 = await request(server).get(`/api/offers/${newCode}/publish`);
    expect(res1.body.message).toMatch(/Rollback failed for Publish Offer/);
    expect(res1.body.message).toMatch(
      /mocked ghostlocker rollbackToVersion failure/,
    );
    const of = await Offer.findByPk(newCode);
    expect(of.statusId).toBe(StatusEnum.PROD_RB_FAIL);
    await of.destroy();
    done();
  }, 120000);

  it('should not allow a second GhostLocker connection and thus fail on the second publish post, and rollback to PROD_FAIL', async (done) => {
    // create two offers
    const re1 = await request(server)
      .post('/api/offers/create')
      .send(testOffer);
    const re2 = await request(server)
      .post('/api/offers/create')
      .send(testOffer2);
    expect(re1.status).toBe(201);
    expect(re2.status).toBe(201);

    // change offer status to staging validation passed
    await Offer.update(
      { statusId: StatusEnum.STG_VALDN_PASS },
      { where: { offerCode: offerCode } },
    );
    await Offer.update(
      { statusId: StatusEnum.STG_VALDN_PASS },
      { where: { offerCode: offerCode2 } },
    );

    // two request to publish offer
    const res1 = request(server).get(`/api/offers/${offerCode}/publish`);
    const res2 = request(server).get(`/api/offers/${offerCode2}/publish`);
    const promises = [res1, res2];

    const results = await Promise.allSettled(promises);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const firstRequest = results[0].value;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const secondRequest = results[1].value;
    if (firstRequest.status === 200) {
      const offer = await Offer.findByPk(
        secondRequest.req.path.split('/api/offers/')[1].split('/publish')[0],
      );
      expect(secondRequest.body.message).toMatch('GhostLocker is busy');
      expect(secondRequest.status).toBe(500);
      expect(offer.statusId).toBe(StatusEnum.PROD_FAIL);
    } else {
      const offer = await Offer.findByPk(
        firstRequest.req.path.split('/api/offers/')[1].split('/publish')[0],
      );
      expect(secondRequest.status).toBe(200);
      expect(firstRequest.body.message).toMatch('GhostLocker is busy');
      expect(firstRequest.status).toBe(500);
      expect(offer.statusId).toBe(StatusEnum.PROD_FAIL);
    }
    done();
  }, 120000);

  afterEach(async (done) => {
    done();
  });

  afterAll(async (done) => {
    //close the server after all tests
    await db.query(
      "DELETE FROM Offers WHERE offerCode LIKE 'samocqa_create_offer_int_%'",
    );
    server.listening ? server.close(() => done()) : done();
  });
});
