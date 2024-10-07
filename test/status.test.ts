import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import { StatusModel } from '../src/models/Status';

beforeAll(() => {
  return db.sync();
});

describe('Status Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('api/status', () => {
    it('Should return 13 status', async () => {
      const response = await request(app).get('/api/status');
      expect(response.body.status).toBe(200);
      expect(response.body.data.length).toBe(27);
      expect(
        response.body.data.every((status: StatusModel) => status.title),
      ).toBeTruthy();
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
