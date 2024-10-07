import * as PlayAuth from '../src/services/PlayAuth';
import sinon from 'sinon';
import axios, { AxiosResponse, AxiosError } from 'axios';
import Axios from 'axios';
import { Env } from '../src/types/enum';
import { mocked } from 'ts-jest/utils';
import { createSpecialOffer } from '../src/services/Contentful';
import { OfferModel } from '../src/models/Offer';
import * as Ghost from '../src/services/GhostLocker';

// jest.mock('../src/services/PlayAuth');

describe('getAccessToken', () => {
  it('should get access token - part 1', async () => {
    const data = {
      application: 'thirdparty',
      token: 'valid-token',
      expiresAt: '2030-12-31T23:59:59.999Z',
    };
    const expectedResponse: AxiosResponse = {
      data: data,
      status: 200,
      statusText: 'ok',
      headers: {
        'x-play-correlation-id': 'fbad01ec713f40fa9ad246ffd5eddcc7',
      },
      config: null,
    };
    const stub = sinon
      .stub(axios, 'post')
      .resolves(Promise.resolve(expectedResponse));

    const val = await PlayAuth.getAccessToken(Env.STG);
    expect(val).toEqual('valid-token');
    expect(stub.getCalls()[0].args[0]).toEqual(
      'https://auth-qa04.flex.com/api/v4/Auth/client',
    );
    expect(stub.getCalls()[0].args[1]).toEqual(
      '"252188ad-5655-447d-a624-2b1e9540498f"',
    );
    stub.restore();
  });

  it('should get access token - part 2', async () => {
    const data = {
      application: 'thirdparty',
      token: 'valid-token',
      expiresAt: '2030-12-31T23:59:59.999Z',
    };
    const expectedResponse: AxiosResponse = {
      data: data,
      status: 200,
      statusText: 'ok',
      headers: null,
      config: null,
    };
    const stub = sinon
      .stub(axios, 'post')
      .resolves(Promise.resolve(expectedResponse));

    const val = await PlayAuth.getAccessToken(Env.STG);
    expect(val).toEqual('valid-token');
    expect(stub.getCalls()[0].args[0]).toEqual(
      'https://auth-qa04.flex.com/api/v4/Auth/client',
    );
    expect(stub.getCalls()[0].args[1]).toEqual(
      '"252188ad-5655-447d-a624-2b1e9540498f"',
    );
    stub.restore();
  });
});

// describe('getCacheSuffix', () => {
//   it('should get GhostLocker suffix', async () => {
//     const data = {
//       CurrentTime: '2020-07-17T21:31:39.4396511Z',
//       Status: 200,
//       HealthChecks: [
//         {
//           Name: 'Environment Configuration',
//           Status: 200,
//           Details: 'AWS PlayAuth Client Dev',
//           Results: [
//             { Name: 'Build Type', Status: 200, Details: 'RELEASE' },
//             { Name: '.Net Core Version', Status: 200, Details: '3.1.5' },
//             {
//               Name: 'Build Version',
//               Status: 200,
//               Details:
//                 'develop__1542__2a116f1dda058e3bf62d0580f983b7dbb1b4740f',
//             },
//             {
//               Name: 'GhostLocker Configuration Cache Suffix',
//               Status: 200,
//               Details: '_4.2.32',
//             },
//           ],
//         },
//       ],
//     };
//     const expectedResponse: AxiosResponse = {
//       data: data,
//       status: 200,
//       statusText: 'ok',
//       headers: null,
//       config: null,
//     };
//     const stub = sinon
//       .stub(axios, 'get')
//       .resolves(Promise.resolve(expectedResponse));
//
//     const val = await PlayAuth.getCacheSuffix(Env.STG);
//     expect(val).toEqual('_4.2.32');
//     expect(stub.getCalls()[0].args[0]).toEqual('undefinedhealth');
//   });
// });

// describe('sendDeleteRequest', () => {
//   it('should get GhostLocker suffix', async () => {
//     const stub = sinon.stub(axios, 'delete').resolves(Promise.resolve('test'));
//     await PlayAuth.deleteOfferCache('setId');
//     expect(stub.getCalls()[0].args[0]).toEqual(
//       'undefinedvundefined/admin/cache?prefix=DigitalLocker&key=setId_4.2.32',
//     );
//     expect(stub.getCalls()[0].args[1]).toEqual({
//       headers: { Authorization: 'Bearer undefined' },
//     });
//   });
// });
