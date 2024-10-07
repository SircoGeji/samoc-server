import { Offer, RetentionOffer } from '../src/models';
import request from 'supertest';
import server from '../src/server';
import { StatusEnum } from '../src/types/enum';
import { MockDbOfferAtt } from './fixtures/offers';
import { getOfferModel, getRetentionOfferModel } from '../src/util/utils';
import * as validateController from '../src/controllers/offers/validateOffer';
import {
  MockDbRetentionOfferAtt,
  mockRetentionOffer,
  Stage,
} from './fixtures/retention-offers';

const stgOfferId = `samocqa_bamboo_int_stg_${new Date().getTime()}`;
const prodOfferId = `samocqa_bamboo_int_prod_${new Date().getTime()}`;

const stubOffer = (
  offerCode: string,
  statusId: StatusEnum,
  buildKey: string,
): MockDbOfferAtt => {
  return {
    couponId: 'nt82li6d5dop',
    offerCode: offerCode,
    offerTypeId: 2,
    planCode: 'flex',
    cta: 'offer cta',
    businessOwner: 'business owner',
    vanityUrl: 'vanity url',
    onTime: new Date('2021-11-03 09:00:00'),
    statusId: statusId,
    createdBy: 1,
    lastModifiedBy: 1,
    bambooBuildKey: buildKey,
    draftData: JSON.parse('{}'),
    createdAt: '2020-11-04T20:36:19.426Z',
    updatedAt: '2020-11-04T20:36:19.426Z',
    deletedAt: null,
  };
};

const bambooPayload = (buildKey: string, status: string) => {
  return {
    id: '407da811-0ba0-4977-a1ca-a1ea1086eb0e',
    time: '2020-09-29T18:12:43.705Z',
    plan: {
      name: 'VerifyPromoCode',
      key: 'SAMOC-VERP',
      url: `https://bamboo.flex.com/browse/SAMOC-OVCYDEV`,
    },
    build: {
      key: buildKey,
      number: 436,
      trigger: 'Manual build',
      url: `https://bamboo.flex.com/browse/${buildKey}`,
      status: status,
      summary: 'Manual build',
      stages: [
        {
          name: 'Default Stage',
          jobs: [
            {
              name: 'Default Job',
              url: `https://bamboo.flex.com/browse/${buildKey}`,
              status: status,
              duration: '0:04:53',
              summary: '1 of 1 failed',
            },
          ],
        },
      ],
      custom_build: true,
      branch_build: false,
    },
    project_name: 'SAMOC',
  };
};

describe('Bamboo Controller', () => {
  beforeAll(async (done) => {
    //start the server before any test
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    await Offer.create(
      stubOffer(stgOfferId, StatusEnum.STG, 'SAMOC-OVCYDEV-436'),
    );
    await Offer.create(
      stubOffer(prodOfferId, StatusEnum.PROD, 'SAMOC-OVCYDEV-437'),
    );
    done();
  });

  describe('/bamboo/webhook tests', () => {
    it('Send build result to webhook - offer status updated to STG_VALDN_PASS', async (done) => {
      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload('SAMOC-OVCYDEV-436', 'SUCCESS'));
      expect(res.status).toBe(200);

      const offer = await getOfferModel(stgOfferId);
      expect(offer.statusId).toBe(StatusEnum.STG_VALDN_PASS);
      done();
    });

    it('Send build result to webhook - offer status updated to PROD_VALDN_PASS', async (done) => {
      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload('SAMOC-OVCYDEV-437', 'SUCCESS'));
      expect(res.status).toBe(200);

      const offer = await getOfferModel(prodOfferId);
      expect(offer.statusId).toBe(StatusEnum.PROD_VALDN_PASS);
      done();
    });

    // generate a fake project id
    it('Send build result to webhook - offer status updated to STG_VALDN_FAIL', async (done) => {
      jest
        .spyOn(validateController, 'rollbackOfferForValidate')
        .mockImplementation(jest.fn());

      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload('SAMOC-OVCYDEV-436', 'FAIL'));
      expect(res.status).toBe(200);

      const offer = await getOfferModel(stgOfferId);
      expect(offer.statusId).toBe(StatusEnum.STG_VALDN_FAIL);
      done();
    });

    it('Send build result to webhook - offer status updated to PROD_VALDN_FAIL', async (done) => {
      jest
        .spyOn(validateController, 'rollbackOfferForValidate')
        .mockImplementation(jest.fn());

      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload('SAMOC-OVCYDEV-437', 'FAIL'));
      expect(res.status).toBe(200);

      const offer = await getOfferModel(prodOfferId);
      expect(offer.statusId).toBe(StatusEnum.PROD_VALDN_FAIL);
      done();
    });
  });

  afterEach(async (done) => {
    // clean up
    await Offer.destroy({
      where: { offerCode: stgOfferId },
      force: true,
    });
    await Offer.destroy({
      where: { offerCode: prodOfferId },
      force: true,
    });
    done();
  });

  afterAll(async (done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});

describe('Bamboo Controller (Retention offers)', () => {
  const STG_KEY = 'SAMOC-OVCYDEV-100';
  const PROD_KEY = 'SAMOC-OVCYDEV-200';
  let stgOffer: MockDbRetentionOfferAtt;
  let prodOffer: MockDbRetentionOfferAtt;

  beforeAll(async (done) => {
    //start the server before any test
    server.listen(1337, () => done());
  });

  beforeEach(async (done) => {
    stgOffer = mockRetentionOffer({
      prefix: 'stg',
      type: Stage.Stage,
      bambooBuildKey: STG_KEY,
    });
    await RetentionOffer.create(stgOffer);

    prodOffer = mockRetentionOffer({
      prefix: 'prod',
      type: Stage.Prod,
      bambooBuildKey: PROD_KEY,
    });
    await RetentionOffer.create(prodOffer);
    done();
  });

  describe('/bamboo/webhook tests', () => {
    it('Send build result to webhook - offer status updated to STG_VALDN_PASS', async (done) => {
      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload(STG_KEY, 'SUCCESS'));
      expect(res.status).toBe(200);

      const offer = await getRetentionOfferModel(stgOffer.offerCode);
      expect(offer.statusId).toBe(StatusEnum.STG_VALDN_PASS);
      done();
    });

    it('Send build result to webhook - offer status updated to PROD_VALDN_PASS', async (done) => {
      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload(PROD_KEY, 'SUCCESS'));
      expect(res.status).toBe(200);

      const offer = await getRetentionOfferModel(prodOffer.offerCode);
      expect(offer.statusId).toBe(StatusEnum.PROD_VALDN_PASS);
      done();
    });

    // generate a fake project id
    it('Send build result to webhook - offer status updated to STG_VALDN_FAIL', async (done) => {
      jest
        .spyOn(validateController, 'rollbackRetentionOfferForValidate')
        .mockImplementation(jest.fn());

      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload(STG_KEY, 'FAIL'));
      expect(res.status).toBe(200);

      const offer = await getRetentionOfferModel(stgOffer.offerCode);
      expect(offer.statusId).toBe(StatusEnum.STG_VALDN_FAIL);
      done();
    });

    it('Send build result to webhook - offer status updated to PROD_VALDN_FAIL', async (done) => {
      jest
        .spyOn(validateController, 'rollbackRetentionOfferForValidate')
        .mockImplementation(jest.fn());

      const res = await request(server)
        .post(`/bamboo/webhook`)
        .send(bambooPayload(PROD_KEY, 'FAIL'));
      expect(res.status).toBe(200);

      const offer = await getRetentionOfferModel(prodOffer.offerCode);
      expect(offer.statusId).toBe(StatusEnum.PROD_VALDN_FAIL);
      done();
    });
  });

  afterEach(async (done) => {
    // clean up
    await RetentionOffer.destroy({
      where: { offerCode: stgOffer.offerCode },
      force: true,
    });
    await RetentionOffer.destroy({
      where: { offerCode: prodOffer.offerCode },
      force: true,
    });
    done();
  });

  afterAll(async (done) => {
    //close the server after all tests
    server.listening ? server.close(() => done()) : done();
  });
});
