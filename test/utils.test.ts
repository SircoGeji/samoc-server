import server, { io } from '../src/server';
import { Offer, Plan, Store } from '../src/models';
import * as utils from '../src/util/utils';
import { prodOffer, draftOffer, stageOffer } from './fixtures/offers';
import { CodeType, Env, StatusEnum } from '../src/types/enum';
import {
  compareDates,
  compareRankings,
  updateSpinnerText,
} from '../src/util/utils';
import * as httpContext from 'express-http-context';

describe('Utils', () => {
  beforeAll(async (done) => {
    //start the server before any test
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    jest.resetAllMocks();
    done();
  });

  describe('getStoreModel', () => {
    it('should return a store model', async (done) => {
      const store = await Store.findOne({
        where: { storeCode: 'flex-web-us' },
      });
      const spy = jest.spyOn(Store, 'findByPk');
      const res = await utils.getStoreModel('flex-web-us');
      expect(spy).toBeCalledTimes(1);
      expect(res.rlyApiKeyStg).toEqual(store.rlyApiKeyStg);
      done();
    });
  });

  describe('getPlanModel', () => {
    it('should return a plan model', async (done) => {
      const plan = await Plan.findOne({ where: { planCode: 'flex' } });
      const spy = jest.spyOn(Plan, 'findByPk');
      const res = await utils.getPlanModel('flex');
      expect(spy).toBeCalledTimes(1);
      expect(res.planId).toEqual(plan.planId);
      done();
    });
  });

  describe('generateOfferUrl', () => {
    it('should generate offer url', async (done) => {
      const offer = await Offer.build({
        offerCode: 'samocqa_test',
        offerTypeId: 1,
        planCode: 'flex',
        statusId: StatusEnum.PROD_VALDN_PASS,
      });

      let result = utils.generateOfferUrl(offer, CodeType.SINGLE_CODE);
      expect(result).toEqual(
        'https://flexcom-dev.flex.com/us/en/offers?c=b21hY3NxYV90ZXN0',
      );

      offer.statusId = StatusEnum.STG_VALDN_PASS;
      result = utils.generateOfferUrl(offer, CodeType.SINGLE_CODE);
      expect(result).toEqual(
        'https://flexcom-dev3.flex.com/us/en/offers?c=b21hY3NxYV90ZXN0',
      );
      done();
    });

    it('should generate a blank offer url due to CodeType', async (done) => {
      const offer = await Offer.build({
        offerCode: 'samocqa_test',
        offerTypeId: 1,
        planCode: 'flex',
        statusId: StatusEnum.PROD_VALDN_PASS,
      });

      let result = utils.generateOfferUrl(offer, CodeType.BULK_UNIQUE_CODE);
      expect(result).toEqual('');
      offer.statusId = StatusEnum.STG_VALDN_PASS;
      result = utils.generateOfferUrl(offer, CodeType.BULK_UNIQUE_CODE);
      expect(result).toEqual('');
      done();
    });

    it('should generate a blank offer url due to Status', async (done) => {
      const offer = await Offer.build({
        offerCode: 'samocqa_test',
        offerTypeId: 1,
        planCode: 'flex',
        statusId: StatusEnum.PROD,
      });
      let result = utils.generateOfferUrl(offer, CodeType.SINGLE_CODE);
      expect(result).toEqual('');
      offer.statusId = StatusEnum.STG;
      result = utils.generateOfferUrl(offer, CodeType.SINGLE_CODE);
      expect(result).toEqual('');
      done();
    });
  });

  describe('getFlexSiteUrl', () => {
    it('should generate site url', async (done) => {
      let result = utils.getFlexSiteUrl(Env.PROD);
      expect(result).toEqual('https://flexcom-dev.flex.com');
      result = utils.getFlexSiteUrl(Env.STG);
      expect(result).toEqual('https://flexcom-dev3.flex.com');
      done();
    });
    it('should generate site url with path', async (done) => {
      let result = utils.getFlexSiteUrl(Env.PROD, '/a/b/c');
      expect(result).toEqual('https://flexcom-dev.flex.com/a/b/c');
      result = utils.getFlexSiteUrl(Env.STG, '/d/e/f');
      expect(result).toEqual('https://flexcom-dev3.flex.com/d/e/f');
      done();
    });
    it('should generate site url with blank path', async (done) => {
      let result = utils.getFlexSiteUrl(Env.PROD, '');
      expect(result).toEqual('https://flexcom-dev.flex.com');
      result = utils.getFlexSiteUrl(Env.STG, '');
      expect(result).toEqual('https://flexcom-dev3.flex.com');
      result = utils.getFlexSiteUrl(Env.PROD, null);
      expect(result).toEqual('https://flexcom-dev.flex.com');
      result = utils.getFlexSiteUrl(Env.STG, null);
      expect(result).toEqual('https://flexcom-dev3.flex.com');
      done();
    });
  });

  describe('getCmsApiEndpoint', () => {
    it('should generate CmsApi endpoint on PROD env', async (done) => {
      let result = utils.getCmsApiEndpoint(
        'prod',
        Env.PROD,
        'us',
        'en',
        'offerCode1',
      );
      expect(result).toEqual('/sapi/cms/Prod/us/en/specialOffer/offerCode1');
      result = result = utils.getCmsApiEndpoint(
        'prod',
        Env.STG,
        'us',
        'en',
        'offerCode2',
      );
      expect(result).toEqual('/sapi/cms/Dev/us/en/specialOffer/offerCode2');
      done();
    });
    it('should generate CmsApi endpoint on DEV env', async (done) => {
      let result = utils.getCmsApiEndpoint(
        'dev',
        Env.PROD,
        'us',
        'en',
        'offerCode3',
      );
      expect(result).toEqual('/sapi/cms/Dev/us/en/specialOffer/offerCode3');
      result = result = utils.getCmsApiEndpoint(
        'dev',
        Env.STG,
        'us',
        'en',
        'offerCode4',
      );
      expect(result).toEqual('/sapi/cms/Dev/us/en/specialOffer/offerCode4');
      done();
    });
    it('should generate CmsApi endpoint on LOCAL env with random region/lang', async (done) => {
      let result = utils.getCmsApiEndpoint(
        'local',
        Env.PROD,
        'aa',
        'bb',
        'offerCode5',
      );
      expect(result).toEqual('/sapi/cms/Dev/aa/bb/specialOffer/offerCode5');
      result = result = utils.getCmsApiEndpoint(
        'local',
        Env.STG,
        'cc',
        'dd',
        'offerCode6',
      );
      expect(result).toEqual('/sapi/cms/Dev/cc/dd/specialOffer/offerCode6');
      done();
    });
  });

  describe('getConstellationApiUrl', () => {
    it('should generate Constellation ApiUrl endpoint on PROD env', async (done) => {
      let result = utils.getConstellationApiUrl('prod', Env.PROD);
      expect(result).toEqual(
        'https://constellation.flex.com/api/contentful-data/flex/Prod/specialOffer',
      );
      result = utils.getConstellationApiUrl('prod', Env.STG);
      expect(result).toEqual(
        'https://constellation-dev.flex.com/api/contentful-data/flex/Dev/specialOffer',
      );
      done();
    });
    it('should generate Constellation ApiUrl endpoint on DEV env', async (done) => {
      let result = utils.getConstellationApiUrl('dev', Env.PROD);
      expect(result).toEqual(
        'https://constellation-dev.flex.com/api/contentful-data/flex/Dev/specialOffer',
      );
      result = utils.getConstellationApiUrl('dev', Env.STG);
      expect(result).toEqual(
        'https://constellation-dev.flex.com/api/contentful-data/flex/Dev/specialOffer',
      );
      done();
    });
  });

  describe('getOfferModel', () => {
    it('should return an offer model', async (done) => {
      const of = await Offer.create(stageOffer);
      const spy = jest.spyOn(Offer, 'findByPk');
      const res = await utils.getOfferModel(of.offerCode);
      expect(spy).toBeCalledTimes(1);
      expect(res.couponId).toBe(of.couponId);
      await Offer.destroy({ where: { offerCode: of.offerCode }, force: true });
      done();
    });
  });

  describe('getTargetEnvFromStatusId', () => {
    it('should return the proper env from status id', async (done) => {
      const dft = await utils.getTargetEnvFromStatusId(StatusEnum.DFT);
      expect(dft).toBe(Env.DB);
      const stg = await utils.getTargetEnvFromStatusId(StatusEnum.STG);
      expect(stg).toBe(Env.STG);
      const stg2 = await utils.getTargetEnvFromStatusId(StatusEnum.STG_ERR_CRT);
      expect(stg2).toBe(Env.STG);
      const prd = await utils.getTargetEnvFromStatusId(StatusEnum.PROD);
      expect(prd).toBe(Env.PROD);
      const prd2 = await utils.getTargetEnvFromStatusId(
        StatusEnum.PROD_ERR_PUB,
      );
      expect(prd2).toBe(Env.PROD);
      done();
    });
  });

  describe('getTargetEnv', () => {
    it('should return the proper target env from the offer model', async (done) => {
      const dft1 = await Offer.create(draftOffer);
      const re = utils.getTargetEnv(dft1);
      await Offer.destroy({
        where: { offerCode: dft1.offerCode },
        force: true,
      });
      expect(re).toBe(Env.DB);

      const stg2 = await Offer.create(stageOffer);
      const re2 = utils.getTargetEnv(stg2);
      expect(re2).toBe(Env.STG);
      await Offer.destroy({
        where: { offerCode: stg2.offerCode },
        force: true,
      });

      const prd = await Offer.create(prodOffer);
      const res3 = utils.getTargetEnv(prd);
      expect(res3).toBe(Env.PROD);
      await Offer.destroy({
        where: { offerCode: prd.offerCode },
        force: true,
      });

      done();
    });
  });

  describe('formatStringWithTokens', () => {
    it('should return formatted string by replacing the correct token placement', async (done) => {
      const str =
        'https://3yekapt5yd.execute-api.us-east-1.amazonaws.com/Stage/elb-instances/dev/post?path={0}&ip=';
      const token1 = 'cache/update/model_content_flex-us_en-US';
      const final =
        'https://3yekapt5yd.execute-api.us-east-1.amazonaws.com/Stage/elb-instances/dev/post?path=cache/update/model_content_flex-us_en-US&ip=';
      const re = utils.formatStringWithTokens(str, token1);
      expect(re).toEqual(final);
      done();
    });

    it('will ignore extra tokens passed in', async (done) => {
      const str =
        'https://3yekapt5yd.execute-api.us-east-1.amazonaws.com/Stage/elb-instances/dev/post?path={0}&ip=';
      const token1 = 'cache/update/model_content_flex-us_en-US';
      const token2 = 'this-should-be-ignored-1';
      const token3 = 'this-should-be-ignored-2';
      const final =
        'https://3yekapt5yd.execute-api.us-east-1.amazonaws.com/Stage/elb-instances/dev/post?path=cache/update/model_content_flex-us_en-US&ip=';
      const re = utils.formatStringWithTokens(str, token1, token2, token3);
      expect(re.includes(token2)).toBe(false);
      expect(re.includes(token3)).toBe(false);
      expect(re).toEqual(final);
      done();
    });
  });

  describe('generateRandomAlphanumericString', () => {
    it('should return random string length equal to the arg passed in', async (done) => {
      const re = utils.generateRandomAlphanumericString(3);
      expect(re.length).toBe(3);
      const re2 = utils.generateRandomAlphanumericString(128);
      expect(re2.length).toBe(128);
      done();
    });

    it('should not return a string with any special character', async (done) => {
      const re = utils.generateRandomAlphanumericString(32);
      expect(/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g.test(re)).toBe(false);
      done();
    });
  });

  describe('compareRankings and compareDates', () => {
    it('should return sorted ranking, than dates in desc order with null first', async (done) => {
      const data = [
        {
          id: 'E',
          endDateTime: '2021-12-20T18:00:00.000Z',
          Status: {
            sortPriority: 2,
          },
        },
        {
          id: 'H',
          endDateTime: '2020-12-20T18:00:00.000Z',
          Status: {
            sortPriority: 1,
          },
        },
        {
          id: 'G',
          endDateTime: null,
          Status: {
            sortPriority: 1,
          },
        },
        {
          id: 'F',
          endDateTime: '2020-12-20T18:00:00.000Z',
          Status: {
            sortPriority: 2,
          },
        },
        {
          id: 'A',
          endDateTime: null,
          Status: {
            sortPriority: 3,
          },
        },
        {
          id: 'D',
          endDateTime: null,
          Status: {
            sortPriority: 2,
          },
        },
        {
          id: 'C',
          endDateTime: '2020-12-20T18:00:00.000Z',
          Status: {
            sortPriority: 3,
          },
        },
        {
          id: 'B',
          endDateTime: '2020-12-31T18:00:00.000Z',
          Status: {
            sortPriority: 3,
          },
        },
      ];
      const results = data.sort((a, b) => {
        return (
          compareRankings(a.Status.sortPriority, b.Status.sortPriority) ||
          compareDates(a.endDateTime, b.endDateTime)
        );
      });

      expect(results[0].id).toBe('A');
      expect(results[1].id).toBe('B');
      expect(results[2].id).toBe('C');
      expect(results[3].id).toBe('D');
      expect(results[4].id).toBe('E');
      expect(results[5].id).toBe('F');
      expect(results[6].id).toBe('G');
      expect(results[7].id).toBe('H');

      done();
    });
  });

  describe('getLatestUpdatedAt', () => {
    it('should sort dates, 1 date', async (done) => {
      const d1 = new Date('2021-01-01T00:00:00');
      const result = utils.getLatestUpdatedAt(d1);
      expect(result.length).toEqual(1);
      expect(result).toContain(d1);
      done();
    });
    it('should sort dates, 2 dates', async (done) => {
      const d1 = new Date('2021-01-01T00:00:00');
      const d2 = new Date('2021-02-01T00:00:00');
      let result = utils.getLatestUpdatedAt(d1, d2);
      expect(result.length).toEqual(2);
      expect(result).toEqual([d2, d1]);
      result = utils.getLatestUpdatedAt(d2, d1);
      expect(result).toEqual([d2, d1]);
      done();
    });
    it('should sort dates, 3 dates', async (done) => {
      const d1 = new Date('2021-01-01T00:00:00');
      const d2 = new Date('2021-02-01T00:00:00');
      const d3 = new Date('2021-03-01T00:00:00');
      let result = utils.getLatestUpdatedAt(d1, d2, d3);
      expect(result.length).toEqual(3);
      expect(result).toEqual([d3, d2, d1]);
      result = utils.getLatestUpdatedAt(d1, d3, d2);
      expect(result).toEqual([d3, d2, d1]);
      result = utils.getLatestUpdatedAt(d2, d1, d3);
      expect(result).toEqual([d3, d2, d1]);
      result = utils.getLatestUpdatedAt(d2, d3, d1);
      expect(result).toEqual([d3, d2, d1]);
      result = utils.getLatestUpdatedAt(d3, d1, d2);
      expect(result).toEqual([d3, d2, d1]);
      result = utils.getLatestUpdatedAt(d3, d2, d1);
      expect(result).toEqual([d3, d2, d1]);
      done();
    });
    it('should sort dates, 2 dates with a null', async (done) => {
      const d1 = new Date('2021-01-01T00:00:00');
      const d2: Date = null;
      const result = utils.getLatestUpdatedAt(d1, d2);
      expect(result.length).toEqual(1);
      expect(result).toEqual([d1]);
      done();
    });
    it('should sort dates, 2 dates with an invalid', async (done) => {
      const d1 = new Date('2021-01-01T00:00:00');
      const d2 = new Date('2021102-01T00:00:00');
      const result = utils.getLatestUpdatedAt(d1, d2);
      expect(result.length).toEqual(1);
      expect(result).toEqual([d1]);
      done();
    });
  });

  describe('updateSpinnerText tests', () => {
    it('updateSpinnerText - testcase #2', async (done) => {
      Object.defineProperty(httpContext, 'socketIoId', {
        get: jest.fn(() => {
          return null;
        }),
        set: jest.fn(),
      });
      const spy2 = jest.spyOn(io, 'emit').mockImplementation(jest.fn());
      updateSpinnerText('msg');
      expect(spy2).toHaveBeenCalledTimes(0);
      done();
    });
  });

  afterEach(async (done) => {
    done();
  });

  afterAll((done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});
