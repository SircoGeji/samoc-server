import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';
import { LoginResponsePayload } from '../src/types/payload';
import { SuccessResponse } from '../src/models/SamocResponse';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MGY1MzZkNS01YzljLTQyMWUtODVhYi1iNGIyYWQ5NzdlZTkiLCJzdWIiOiJ1c2VybmFtZSIsImVtYWlsIjoidXNlcm5hbWVAdGVzdC5jb20iLCJyb2xlIjpbIlJHLU9NQUNTLVVzZXJzIl0sImV4cCI6MTYyMjg0NjU1NSwiaXNzIjoiTWVkaWFGb3JnZSIsImF1ZCI6Ik1lZGlhRm9yZ2UifQ.msEgOp6_mvwEC4iwgR-cL2ioA2xkrR5J0uvtpbBU-jg';
const INVALID_ROLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MGY1MzZkNS01YzljLTQyMWUtODVhYi1iNGIyYWQ5NzdlZTkiLCJzdWIiOiJ1c2VybmFtZSIsImVtYWlsIjoidXNlcm5hbWVAdGVzdC5jb20iLCJyb2xlIjpbXSwiZXhwIjoxNjIyODQ2NTU1LCJpc3MiOiJNZWRpYUZvcmdlIiwiYXVkIjoiTWVkaWFGb3JnZSJ9.BJCgtFLIx6cYlHjY87R7WL7wuVXWNgLBgpNI0WCXUHc';
const TEST_USERNAME = 'username';
const INVALID_ROLE_USERNAME = 'invalid_role_username';
const TEST_PASSWORD = 'password';
const TEST_EMAIL = 'username@test.com';

describe('Users Controller', () => {
  beforeAll(async () => {
    const mock = new MockAdapter(axios);
    mock
      .onPost(`${process.env.AUTHENTICATION_ENDPOINT}/api/v1/Users/JsonToken`)
      .reply((config) => {
        const data = JSON.parse(config.data);
        if (data.username === TEST_USERNAME && data.password == TEST_PASSWORD) {
          return [
            200,
            { token: TEST_TOKEN, expiration: '2021-06-04T22:42:35Z' },
          ];
        }
        if (
          data.username === INVALID_ROLE_USERNAME &&
          data.password == TEST_PASSWORD
        ) {
          return [
            200,
            { token: INVALID_ROLE_TOKEN, expiration: '2021-06-04T22:42:35Z' },
          ];
        }
        return [
          401,
          {
            Message: 'Unauthorized access',
            StatusCode: 401,
            ExceptionMessage: 'Authorization failed.',
          },
        ];
      });
    mock
      .onPost(`${process.env.AUTHENTICATION_ENDPOINT}/api/v1/Users/Auth`)
      .reply((config) => {
        if (config.params.token === TEST_TOKEN) {
          return [
            200,
            {
              jti: '60f536d5-5c9c-421e-85ab-b4b2ad977ee9',
              sub: 'username',
              email: 'username@test.com',
              role: [process.env.ADMIN_ROLE],
              exp: 1722846555,
              iss: 'MediaForge',
              aud: 'MediaForge',
            },
          ];
        }
        if (config.params.token === INVALID_ROLE_TOKEN) {
          return [
            200,
            {
              jti: '60f536d5-5c9c-421e-85ab-b4b2ad977ee9',
              sub: 'username',
              email: 'username@test.com',
              role: [],
              exp: 1722846555,
              iss: 'MediaForge',
              aud: 'MediaForge',
            },
          ];
        }
        return [
          401,
          {
            Message: 'Unauthorized access',
            StatusCode: 401,
            ExceptionMessage: 'Authorization failed.',
          },
        ];
      });
  });

  describe('GET /users', () => {
    it('should return 405', async () => {
      await request(app).get('/users').expect(405);
    });
  });

  describe('GET /users/login', () => {
    it('should return 405', async () => {
      await request(app).get('/users/login').expect(405);
    });
  });

  describe('POST /users/login', () => {
    it('should login successfully', async () => {
      const response = await request(app)
        .post('/users/login')
        .send({
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
        })
        .set('Content-Type', 'application/json');
      const successResponse = response.body as SuccessResponse;
      expect(successResponse.status).toBe(200);
      expect(successResponse.success).toBe(true);
      const loginResponse = successResponse.data as LoginResponsePayload;
      expect(loginResponse.token).toBe(TEST_TOKEN);
      expect(loginResponse.user.sub).toBe(TEST_USERNAME);
      expect(loginResponse.user.email).toBe(TEST_EMAIL);
    });

    it('should fail to log in with invalid role message', async () => {
      const response = await request(app)
        .post('/users/login')
        .send({
          username: INVALID_ROLE_USERNAME,
          password: TEST_PASSWORD,
        })
        .set('Content-Type', 'application/json');
      const successResponse = response.body as SuccessResponse;
      expect(response.status).toBe(401);
      expect(successResponse.success).toBe(false);
      expect(successResponse.message).toContain(
        `is not a member of ${process.env.ADMIN_ROLE} group`,
      );
    });

    it('should fail with unauthorized message', async () => {
      const response = await request(app)
        .post('/users/login')
        .send({
          username: 'bad_' + TEST_USERNAME,
          password: 'bad_' + TEST_PASSWORD,
        })
        .set('Content-Type', 'application/json');
      const successResponse = response.body as SuccessResponse;
      expect(response.status).toBe(401);
      expect(successResponse.success).toBe(false);
      expect(successResponse.message).toContain('Unauthorized access');
    });

    it('should fail validation', async () => {
      const response = await request(app)
        .post('/users/login')
        .send({
          username: ``,
          password: ``,
        })
        .set('Content-Type', 'application/json');
      const successResponse = response.body as SuccessResponse;
      expect(response.status).toBe(401);
      expect(successResponse.success).toBe(false);
    });
  });

  describe('GET /users/logout', () => {
    it('should return 200', async () => {
      request(app).get('/users/logout').expect(200);
    });
  });

  describe('POST /users/logout', () => {
    it('should return 405', async () => {
      request(app).post('/users/logout').expect(405);
    });
  });

  afterAll(async () => {
    await db.close();
  });
});
