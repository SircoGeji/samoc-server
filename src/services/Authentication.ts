import axios from 'axios';
import pRetry from 'p-retry';
import { pRetryOptions } from '../util/utils';
import { AppError } from '../util/errorHandler';
import { LoginResponsePayload, UserResponsePayload } from '../types/payload';

const AUTHENTICATION_ENDPOINT = process.env.AUTHENTICATION_ENDPOINT;
const JSON_TOKEN_ENDPOINT = `${AUTHENTICATION_ENDPOINT}/api/v1/Users/JsonToken`;
const USER_AUTH_ENDPOINT = `${AUTHENTICATION_ENDPOINT}/api/v1/Users/Auth`;
const ADMIN_ROLE = process.env.ADMIN_ROLE;

interface JsonTokenResponse {
  token: string;
  expiration: string;
}

const validateEmail = (email: string): boolean => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

export const login = async (
  username: string,
  password: string,
): Promise<LoginResponsePayload> => {
  const buildOp = async (): Promise<LoginResponsePayload> => {
    let token;
    let authResponse;
    try {
      const tokenResp = await axios.post(JSON_TOKEN_ENDPOINT, {
        username: username,
        password: password,
      });
      token = (tokenResp.data as JsonTokenResponse).token;
      authResponse = await axios({
        method: 'POST',
        url: USER_AUTH_ENDPOINT,
        params: {
          token,
        },
      });
    } catch (e) {
      if (validateEmail(username)) {
        // user entered a email address instead of username
        throw new AppError(
          'Please enter your FLEX domain username instead of email',
          401,
        );
      }
      throw new AppError('Unauthorized access', 401);
    }

    const user = authResponse.data as UserResponsePayload;
    if (!user.role.includes(ADMIN_ROLE)) {
      throw new AppError(
        `User ${user.sub} (${user.email}) is not a member of ${ADMIN_ROLE} group`,
        401,
      );
    }

    return { token: token, user: authResponse.data as UserResponsePayload };
  };
  return await pRetry(buildOp, pRetryOptions);
};
