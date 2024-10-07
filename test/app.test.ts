import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';

describe('App Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('GET /', () => {
    it('should return 404', async () => {
      await request(app).post('/').expect(404);
    });
  });

  describe('GET /health', () => {
    it('should return 200', async () => {
      await request(app).get('/health').expect(200);
    });

    it('should return 405', async () => {
      await request(app).post('/health').expect(405);
    });
  });

  describe('GET /ping', () => {
    it('should return 200', async () => {
      await request(app).get('/ping').expect(200);
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
