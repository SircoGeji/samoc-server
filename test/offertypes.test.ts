import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import { OfferTypeModel } from '../src/models/OfferType';

describe('OfferTypes Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('GET api/offertypes', () => {
    it('Should return 4 offer type', async () => {
      const response = await request(app).get('/api/offertypes');
      expect(response.body.status).toBe(200);
      expect(response.body.data.length).toBe(4);
      expect(
        response.body.data.every(
          (offerType: OfferTypeModel) => offerType.title,
        ),
      ).toBeTruthy();
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
