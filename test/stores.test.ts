import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';

describe('Stores Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('api/stores', () => {
    it('Should return all stores with nested regions, brands, and platforms', async () => {
      const response = await request(app).get('/api/stores');
      expect(response.body.status).toBe(200);
      // expect(response.body.data.us.brands.pantaya.platforms.web.storeCode).toBe(
      //   'pantaya-web-us',
      // );
      // expect(
      //   response.body.data.es.brands.flexplay.platforms.web.storeCode,
      // ).toBe('flexplay-web-es');
      // expect(
      //   response.body.data.gb.brands.flexplay.platforms.web.storeCode,
      // ).toBe('flexplay-web-gb');
      // expect(
      //   response.body.data.it.brands.flexplay.platforms.web.storeCode,
      // ).toBe('flexplay-web-it');
      // expect(
      //   response.body.data.mx.brands.flexplay.platforms.web.storeCode,
      // ).toBe('flexplay-web-mx');
      expect(response.body.data.us.brands.flex.platforms.web.storeCode).toBe(
        'flex-web-us',
      );
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
