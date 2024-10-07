import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import faker from 'faker';
import { OfferRequestPayload } from '../src/types/payload';
import { CodeType, DiscountType, StatusEnum } from '../src/types/enum';
import { Offer } from '../src/models';

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

const testStoreCode = 'flex-web-us';
const testPlanCode = 'flex';
const duplicatedOfferCode = generateGuid(`samoc_test_dup`);
// const duplicatedOfferHeader = generateGuid(`samoc_test_offer_header`);
const clndevOfferCode = generateGuid('samoc_clndev');
const insecureUrlOfferCode = generateGuid(`samoc_test_insecure`);

const generateTestOffer = (offerCode: string): OfferRequestPayload => {
  return {
    noEndDate: faker.random.boolean(),
    offerBusinessOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
    planCode: `${testPlanCode}`,
    offerBodyText: `${faker.lorem.sentence(1)}`,
    discountType: DiscountType.FIXED_PRICE,
    offerAppliedBannerText: `${faker.lorem.sentence(5)}`,
    totalUniqueCodes: +faker.random.number({
      min: 5,
      max: 10,
    }),
    discountDurationUnit: 'month',
    discountAmount: faker.random.number({ min: 1, max: 2 }),
    endDateTime: '2021-12-31T00:00:00Z',
    offerHeader: `${faker.lorem.sentence(1)}`,
    offerName: `${faker.lorem.sentence(1)}`,
    legalDisclaimer: `${faker.lorem.sentence(1)}`,
    offerTypeId: 2,
    offerBgImageUrl:
      'https://flex.imgix.net/BuyFlex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
    discountDurationValue: faker.random.number({
      min: 1,
      max: 3,
    }),
    offerVanityUrl: `${faker.internet.url()}`,
    offerCTA: `${faker.lorem.sentence(1)}`,
    offerCodeType: CodeType.BULK_UNIQUE_CODE,
    offerBoldedText: ``,
    offerCode: `${offerCode}`,
    welcomeEmailText: `${faker.lorem.sentence(1)}`,
    environments: [],
  };
};

const invalidTestOffer = {
  noEndDate: true,
  offerBusinessOwner: `${faker.name.firstName()} ${faker.name.lastName()}`,
  planCode: `Invalid-//-Code`,
  offerBodyText: `${faker.lorem.sentence(1)}`,
  offer: 'price',
  offerAppliedBannerText: `${faker.lorem.sentence(5)}`,
  totalUniqueCodes: '10A',
  totalRedemptions: '0A',
  offerDurationUnit: 'day',
  discountAmount: '3.99A',
  endDateTime: '2020-07-20T00:00:00Z',
  legalDisclaimer: `${faker.lorem.sentence(5)}`,
  offerTypeId: '2A',
  offerBgImageUrl:
    'https://flex.imgix.net/BuyFlex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max',
  offerDurationValue: '0A',
  offerVanityUrl: `${faker.internet.url()}`,
  offerCTA: `${faker.lorem.sentence(5)}`,
  offerCodeType: CodeType.SINGLE_CODE,
  offerBoldedText: ``,
  offerCode: `abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz`,
  welcomeEmailText: `${faker.lorem.sentence(1)}`,
};

const generateTestOfferPayLoadForUpdate = (
  offerCode: string,
): OfferRequestPayload => {
  const testOffer = generateTestOffer(offerCode);
  // remove invalid fields
  testOffer.offerCode = undefined;
  testOffer.planCode = undefined;
  return testOffer;
};

describe('Offers Controller', () => {
  const offerCode = generateGuid(`samoc_test`);

  beforeAll(async () => {
    await db.sync();
    // setup offer for duplicated test
    const duplicatedOffer = {
      offerCode: duplicatedOfferCode,
      offerTypeId: 2,
      planCode: testPlanCode,
      statusId: 1,
      draftData: JSON.parse(
        JSON.stringify({ ...generateTestOffer(duplicatedOfferCode) }),
      ),
    };
    await Offer.create(duplicatedOffer);
  });

  describe('api/offers', () => {
    // generate a fake project id

    it('Create new draft offer', async () => {
      const testOffer = generateTestOffer(offerCode);
      const response = await request(app)
        .post('/api/offers/save')
        .send(testOffer);
      expect(response.status).toBe(201);
    });

    it('should fail to create new offer - invalid action', async () => {
      const response = await request(app)
        .post('/api/offers')
        .send(generateTestOffer(''));
      expect(response.status).toBe(405);
    });

    it('should fail to create new offer - invalid offerCode', async () => {
      const response = await request(app)
        .post('/api/offers/save')
        .send(generateTestOffer(''));
      expect(response.status).toBe(422);
    });

    it('should fail to create new offer - fails payload verification', async () => {
      const response = await request(app)
        .post('/api/offers/save')
        .send(invalidTestOffer);
      expect(response.status).toBe(422);
      expect(response.body.error.validationResult.length).toBe(8);
    });

    it('should fail to create new offer - duplicated offer code', async () => {
      const duplicatedResponse = await request(app)
        .post('/api/offers/save')
        .send(generateTestOffer(duplicatedOfferCode));
      expect(duplicatedResponse.status).toBe(406);
      expect(duplicatedResponse.body.message).toMatch(
        'The Offer Code already exists. Please ensure it is unique.',
      );
    });

    // TODO: this is no longer valid because header is saved remotely (Recurly & Contentful)
    // it('should fail to create new offer - duplicated offer header', async () => {
    //   const offerWithDuplicatedHeader = generateTestOffer(
    //     duplicatedOfferHeader,
    //   );
    //   offerWithDuplicatedHeader.offerHeader = duplicatedOfferHeader;
    //   const duplicatedResponse = await request(app)
    //     .post('/api/offers/save')
    //     .send(offerWithDuplicatedHeader);
    //   expect(duplicatedResponse.status).toBe(406);
    //   expect(duplicatedResponse.body.message).toBe(
    //     'The Offer Code or Offer Header already exists. Please ensure it is unique.',
    //   );
    // });

    it('should fail to create new offer - insecure image url', async () => {
      const offerWithInsecureImageUrl = generateTestOffer(insecureUrlOfferCode);
      offerWithInsecureImageUrl.offerBgImageUrl =
        'http://www.image.com/image1.png';
      const insecureUrlResponse = await request(app)
        .post('/api/offers/save')
        .send(offerWithInsecureImageUrl);
      expect(insecureUrlResponse.status).toBe(422);
    });

    it('PUT request should return 405', (done) => {
      request(app).put('/api/offers').expect(405, done);
    });

    it('DELETE request should return 405', (done) => {
      request(app).delete('/api/offers').expect(405, done);
    });

    it('Get an offer by offer code', async () => {
      const response = await request(app).get(`/api/offers/${offerCode}`);
      expect(response.status).toBe(200);
      expect(response.body.data.offerCode).toBe(offerCode);
    });

    it('Should fail to update an offer in DRAFT by offer code', async () => {
      const testOffer = generateTestOfferPayLoadForUpdate(offerCode);
      testOffer.planCode = 'shouldnotincludeplancode';
      const response = await request(app)
        .put(`/api/offers/${offerCode}`)
        .send(testOffer);
      expect(response.status).toBe(422);
      expect(response.body.errors.length).toBe(2);
    });

    it('Update an offer in DRAFT only by offer code', async () => {
      const updateOfferPayload = generateTestOfferPayLoadForUpdate(offerCode);
      const response = await request(app)
        .put(`/api/offers/${offerCode}`)
        .send(updateOfferPayload);
      expect(response.status).toBe(200);
      const offer = await Offer.findByPk(offerCode);
      expect(offer.statusId).toBe(StatusEnum.DFT);
      expect(offer.offerTypeId).toBe(2);
      expect(offer.planCode).toBe(testPlanCode);
    });

    //TODO: Update this test case for PROD env
    // it('Update an offer on PROD by offer code', async () => {
    //   const response = await request(app)
    //       .put(`/api/offers/${offerCode}`)
    //       .send(generateTestOfferPayLoadForUpdate(offerCode));
    //   expect(response.status).toBe(200);
    //   expect(response.body.data[0]).toBe(1); // # of record changed
    // });

    //TODO: Not yet supported
    // it('Validate an offer by offer code', async () => {
    //   const response = await request(app).get(
    //     `/api/offers/${offerCode}/validate`,
    //   );
    //   expect(response.body.status).toBe(200);
    //   expect(response.body.data[0]).toBe(1); // # of record updated
    // });

    it('Get all offers', async () => {
      const response = await request(app).get(
        `/api/offers?store=${testStoreCode}`,
      );
      expect(response.body.status).toBe(200);
      expect(
        response.body.data.every((offer: any) => offer.offerCode),
      ).toBeTruthy();
    });

    // TODO: publish to prod is not yet supported
    // it(`Publish an offer ${offerCode} by offer code`, async () => {
    //   const response = await request(app).get(
    //     `/api/offers/${offerCode}/publish`,
    //   );
    //   expect(response.status).toBe(200);
    //   expect(response.body.data).toBeTruthy();
    // });

    it('Create an new offer on STG', async () => {
      const offerPayload = generateTestOffer(clndevOfferCode);
      const response = await request(app)
        .post(`/api/offers/create`)
        .send(offerPayload);
      expect(response.status).toBe(201);
    });

    it('Update an offer on STG by offer code', async () => {
      const updateOfferPayload = generateTestOfferPayLoadForUpdate(
        clndevOfferCode,
      );
      const newBusinessOwner = `${faker.name.firstName()} ${faker.name.lastName()}`;
      updateOfferPayload.offerBusinessOwner = newBusinessOwner;
      updateOfferPayload.discountType = 'trial';
      updateOfferPayload.discountAmount = undefined;
      updateOfferPayload.discountDurationUnit = 'day';
      updateOfferPayload.discountDurationValue = 10;
      const response = await request(app)
        .put(`/api/offers/${clndevOfferCode}`)
        .send(updateOfferPayload);

      expect(response.status).toBe(200);
    });

    it('Delete an offer by offer code', async () => {
      const response = await request(app).delete(`/api/offers/${offerCode}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully'); // # of record deleted
    });
  });

  afterAll(async () => {
    // clean up
    await Offer.destroy({
      where: { offerCode: duplicatedOfferCode },
      force: true,
    });
    await Offer.destroy({
      where: { offerCode: insecureUrlOfferCode },
      force: true,
    });
    await Offer.destroy({
      where: { offerCode: offerCode },
      force: true,
    });
    await db.close();
  });
});
