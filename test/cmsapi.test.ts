import { Env } from '../src/types/enum';
import nock from 'nock';
import * as cmsapi from '../src/services/CmsApi';
import * as playauth from '../src/services/PlayAuth';
import {
  AppError,
  CmsApiError,
  ValidateGhostLockerError,
} from '../src/util/errorHandler';
import { SKIP_CLEARCMSAPICACHE } from '../src/util/config';

const fakeResp = (offerCode: string) => {
  return {
    title: `[SAMOC] ${offerCode} - Acquisition`,
    country: ['us'],
    couponCode: [offerCode],
    offerTitle: `Offer Header for ${offerCode} goes here`,
    offerDescription: `Offer Body Text for ${offerCode} goes here.`,
    bannerText: '$x/MONTH FOR y MONTHS PROMO APPLIED',
    offerPrice: 3.99,
    billingFrequency: 'month',
    total: '<span>$3.99/month for 2 months, 7-days free trial</span>',
    commitmentUnit: '1 months',
    offerTerms:
      'Limited time offer. Offer available ONLY to new FLEX App subscribers that subscribe via flex.com. Unless canceled prior to expiration of free trial, after completion of 3 month offer, service automatically rolls to month-to-month at the then current price unless cancelled. Subscription is non-refundable.',
    backgroundImages: [
      {
        title: `backgroundImg-${offerCode}`,
        country: ['us'],
        path:
          'https://flex.imgix.net/BuyFlex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560',
        environments: ['Dev'],
        sysId: `backgroundImg-${offerCode}`,
      },
    ],
    freeTrial: false,
    environments: ['Dev'],
    sysId: offerCode,
  };
};

describe('Cms API Services', () => {
  beforeAll(async () => {});

  beforeEach(async () => {
    nock.cleanAll();
    jest.resetAllMocks();
  });

  it('clearCmsApiCache should succeed - STG', async (done) => {
    nock('https://constellation-dev.flex.com')
      .post('/api/contentful-data/flex/Dev/specialOffer')
      .reply(200, {});
    const result = await cmsapi.clearCmsApiCache(Env.STG);
    expect(result.status).toBe(200);
    done();
  });

  const skipClearCms = SKIP_CLEARCMSAPICACHE ? it.skip : it;
  skipClearCms('clearCmsApiCache should fail - STG', async (done) => {
    nock('https://constellation-dev.flex.com')
      .post('/api/contentful-data/flex/Dev/specialOffer')
      .replyWithError('Fake failure');
    let msg;
    try {
      await cmsapi.clearCmsApiCache(Env.STG);
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(
        'Clear Contentful cache unsuccessful on STG: Fake failure',
      );
      done();
    }
  });

  it('clearCmsApiCache should succeed - PROD', async (done) => {
    nock('https://constellation-dev.flex.com')
      .post('/api/contentful-data/flex/Dev/specialOffer')
      .reply(200, {});
    const result = await cmsapi.clearCmsApiCache(Env.PROD);
    expect(result.status).toBe(200);
    done();
  });

  skipClearCms('clearCmsApiCache should fail - PROD', async (done) => {
    nock('https://constellation-dev.flex.com')
      .post('/api/contentful-data/flex/Dev/specialOffer')
      .replyWithError('Fake failure');
    let msg;
    try {
      await cmsapi.clearCmsApiCache(Env.PROD);
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(
        'Clear Contentful cache unsuccessful on PROD: Fake failure',
      );
      done();
    }
  });

  it('fetchSpecialOffer should succeed - STG', async (done) => {
    nock('https://flexcom-dev3.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .reply(200, fakeResp('fakeOfferCode'));
    const resp = await cmsapi.fetchSpecialOffer(
      'fakeOfferCode',
      Env.STG,
      'us',
      'en',
    );
    expect(resp.status).toBe(200);
    done();
  });

  it('fetchSpecialOffer should succeed - PROD', async (done) => {
    nock('https://flexcom-dev.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .reply(200, fakeResp('fakeOfferCode'));
    const resp = await cmsapi.fetchSpecialOffer(
      'fakeOfferCode',
      Env.PROD,
      'us',
      'en',
    );
    expect(resp.status).toBe(200);
    done();
  });

  it('fetchSpecialOffer should fail with offer not found - STG', async (done) => {
    nock('https://flexcom-dev3.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .reply(200, fakeResp('fakeOfferCode-invalid'));
    let msg;
    try {
      await cmsapi.fetchSpecialOffer('fakeOfferCode', Env.STG, 'us', 'en');
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(`fetchSpecialOffer failed, (fakeOfferCode) not found`);
    }
    done();
  });

  it('fetchSpecialOffer should  fal with offer not found - PROD', async (done) => {
    nock('https://flexcom-dev.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .reply(200, fakeResp('fakeOfferCode-invalid'));
    let msg;
    try {
      await cmsapi.fetchSpecialOffer('fakeOfferCode', Env.PROD, 'us', 'en');
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(`fetchSpecialOffer failed, (fakeOfferCode) not found`);
    }
    done();
  });

  it('fetchSpecialOffer should fail with error - STG', async (done) => {
    nock('https://flexcom-dev3.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .replyWithError('fakeErrorMsg');
    let msg;
    try {
      await cmsapi.fetchSpecialOffer('fakeOfferCode', Env.STG, 'us', 'en');
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(`fetchSpecialOffer failed, fakeErrorMsg`);
    }
    done();
  });

  it('fetchSpecialOffer should fail with error - PROD', async (done) => {
    nock('https://flexcom-dev.flex.com')
      .get('/sapi/cms/Dev/us/en/specialOffer/fakeOfferCode')
      .replyWithError('fakeErrorMsg');
    let msg;
    try {
      await cmsapi.fetchSpecialOffer('fakeOfferCode', Env.STG, 'us', 'en');
    } catch (err) {
      msg = err.message;
    } finally {
      expect(msg).toBe(
        `fetchSpecialOffer failed, Request failed with status code 500`,
      );
    }
    done();
  });

  it('verifyOffer should succeed - STG', async (done) => {
    const spy1 = jest
      .spyOn(playauth, 'validateGl')
      .mockImplementationOnce(jest.fn());
    const spy2 = jest
      .spyOn(cmsapi, 'fetchSpecialOffer')
      .mockImplementationOnce(jest.fn());

    await cmsapi.verifyOffer('offerCode', Env.STG);

    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();

    done();
  });

  it('verifyOffer should fail with validateGl failure - STG', async (done) => {
    const spy1 = jest
      .spyOn(playauth, 'validateGl')
      .mockImplementationOnce(
        (
          siteUrl: string,
          targetEnv: Env,
          offerCode: string,
          uniqueOfferCode?: string,
        ) => {
          throw new ValidateGhostLockerError('mocked validateGl failed error');
        },
      );
    const spy2 = jest
      .spyOn(cmsapi, 'fetchSpecialOffer')
      .mockImplementationOnce(jest.fn());
    let msg;
    try {
      await cmsapi.verifyOffer('offerCode', Env.STG);
    } catch (err) {
      msg = err.message;
    } finally {
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalledTimes(0);
      console.log('msg', msg);
      expect(msg).toMatch('mocked validateGl failed error');
    }
    done();
  });

  it('verifyOffer should fail with fetchSpecialOffer failure - STG', async (done) => {
    const spy1 = jest
      .spyOn(playauth, 'validateGl')
      .mockImplementationOnce(jest.fn());
    const spy2 = jest
      .spyOn(cmsapi, 'fetchSpecialOffer')
      .mockImplementationOnce(
        (offerCode: string, targetEnv: Env, region: string, lang: string) => {
          throw new AppError('mocked fetchSpecialOffer failed error');
        },
      );
    let msg;
    try {
      await cmsapi.verifyOffer('offerCode', Env.STG);
    } catch (err) {
      msg = err.message;
    } finally {
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      console.log('msg', msg);
      expect(msg).toMatch('mocked fetchSpecialOffer failed error');
    }
    done();
  });

  afterEach(async () => {});

  afterAll(async () => {});
});
