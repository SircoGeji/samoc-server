import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import { RoleModel } from '../src/models/Role';

describe('Roles Controller', () => {
  beforeAll(async () => {
    await db.sync();
  });

  describe('api/roles', () => {
    it('Should return 1 roles', async () => {
      const response = await request(app).get('/api/roles');
      expect(response.body.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(
        response.body.data.every((role: RoleModel) => role.title),
      ).toBeTruthy();
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
