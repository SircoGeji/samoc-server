import * as Ghost from '../src/services/GhostLocker';
import nock from 'nock';
import { Env } from '../src/types/enum';

const tokenData = {
  application: 'thirdparty',
  token: 'take-token',
  expiresAt: '2030-12-31T23:59:59.999Z',
};
const currentConfigData: Ghost.OfferConfiguration = {
  configurationSetId: 'configSetId',
  application: 'thirdparty',
  configurationVersion: 1,
  configurationValue:
    '{"receiptType":"Recurly","countries":[{"country":"US","promotionOffers":[{"storeOfferId":"offer","isForNewUser":true,"planCode":"qamonthly"}]},{"country":"GB","promotionOffers":[{"storeOfferId":"qaacquisition","isForNewUser":true,"planCode":"qamonthly"}]}]}',
  lastUpdateDateTime: new Date('2020-10-10T00:00:00Z'),
  lastChangedBy: 'user',
  comments: 'comment',
  contentType: 'application/json',
  cacheDurationSeconds: 10,
};

describe('GhostLocker tests', () => {
  beforeEach(async () => {
    nock.cleanAll();
  });

  it('should return offer not found error', async () => {
    nock('https://ghostlocker-qa04.flex.com/api/v1')
      .post('/Auth/client')
      .reply(200, { ...tokenData })
      .get(/\/current/)
      .reply(200, { ...currentConfigData })
      .post(/validateOnly=true/)
      .reply(200, {})
      .post(/\/offers:promotion:iap:recurly/)
      .reply(200, { configurationVersion: 123 })
      .get(/\/current/)
      .reply(200, { ...currentConfigData });
    try {
      await Ghost.updateOfferConfig(
        'invalidOffer',
        1,
        'plan',
        'us',
        false,
        Env.STG,
      );
    } catch (err) {
      expect(err.message).toMatch(
        `Offer (invalidOffer) not found in Ghostlocker configuration`,
      );
    }
  });

  it('should add an offer to config', async () => {
    nock('https://ghostlocker-qa04.flex.com/api/v1')
      .post('/Auth/client')
      .reply(200, { ...tokenData })
      .get(/\/current/)
      .reply(200, { ...currentConfigData })
      .post(/validateOnly=true/)
      .reply(200, {})
      .post(/\/offers:promotion:iap:recurly/)
      .reply(200, { configurationVersion: 123 })
      .get(/\/current/)
      .reply(200, { ...currentConfigData });
    const result = await Ghost.updateOfferConfig(
      'offer',
      1,
      'plan',
      'us',
      false,
      Env.STG,
    );
    expect(result.configurationVersion).toBe(123);
  });

  it('cannot not obtain lock for 2nd update while the 1st one has the lock', async () => {
    nock('https://ghostlocker-qa04.flex.com/api/v1')
      .post('/Auth/client')
      .reply(200, { ...tokenData })
      .get(/\/current/)
      .reply(200, { ...currentConfigData })
      .post(/validateOnly=true/)
      .reply(200, {})
      .post(/\/offers:promotion:iap:recurly/)
      .replyWithError('GL update failed');
    try {
      await Ghost.updateOfferConfig('offer', 1, 'plan', 'us', false, Env.STG);
    } catch (e1) {
      expect(e1.message).toMatch(
        'GhostLocker operation failed on STG, GL update failed',
      );
    }
    nock('https://ghostlocker-qa04.flex.com/api/v1')
      .post('/Auth/client')
      .reply(200, { ...tokenData })
      .get(/\/current/)
      .reply(200, { ...currentConfigData })
      .post(/validateOnly=true/)
      .reply(200, {})
      .post(/\/offers:promotion:iap:recurly/)
      .replyWithError('GL update failed 2nd time');
    try {
      await Ghost.updateOfferConfig('offer', 1, 'plan', 'us', false, Env.STG);
    } catch (e2) {
      expect(e2.message).toMatch(
        'GhostLocker operation failed on STG, GhostLocker is busy',
      );
    }
  });

  // Per doc:  https://confluence.flex.com/pages/viewpage.action?pageId=179571852
  // Suggested not to remove entries from GL config, commenting it out for now.
  // it('should remove an offer from config', async () => {
  //   const tokenData = {
  //     application: 'thirdparty',
  //     token: 'take-token',
  //     expiresAt: '2030-12-31T23:59:59.999Z',
  //   };
  //   const currentConfigData: Ghost.OfferConfiguration = {
  //     configurationSetId: 'configSetId',
  //     application: 'thirdparty',
  //     configurationVersion: 1,
  //     configurationValue:
  //       '{"receiptType":"Recurly","countries":[{"country":"US","promotionOffers":[{"storeOfferId":"offer","isForNewUser":true,"planCode":"plan"}]}]}',
  //     lastUpdateDateTime: new Date('2020-10-10T00:00:00Z'),
  //     lastChangedBy: 'user',
  //     comments: 'comment',
  //     contentType: 'application/json',
  //     cacheDurationSeconds: 10,
  //   };
  //   nock('https://ghostlocker-qa04.flex.com/api/v1')
  //     .post('/Auth/client')
  //     .reply(200, { ...tokenData })
  //     .get(/\/current/)
  //     .reply(200, { ...currentConfigData })
  //     .post(/validateOnly=true/)
  //     .reply(200, {})
  //     .post(/\/offers:promotion:iap:recurly/)
  //     .reply(200, { configurationVersion: 456 });
  //   const result = await Ghost.updateOfferConfig(
  //     'offer',
  //     1,
  //     'plan',
  //     'us',
  //     true,
  //     Env.STG,
  //   );
  //   expect(result.configurationVersion).toBe(456);
  // });
});
