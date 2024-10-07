import {
  configUrl,
  getAccessToken,
  getConfigOfVersion,
  getHost,
  GLSet,
  readGhostLocker,
  updateGhostLocker,
} from './GhostLocker';
import { Env } from '../types/enum';
import axios from 'axios';
import Logger from '../util/logger';
import { GL_COR_ID } from '../util/constants';
import { format } from 'date-fns';

const CONFIG_NAME = 'offers:promotion:iap:store-translated';
const CONFIG_URL = `applications/playauth/configurations/${CONFIG_NAME}`;

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] GhostLocker:`;
  } else {
    return `GhostLocker:`;
  }
};

export const loadTranslations = async (env: Env) => {
  const token = await getAccessToken(env);

  const resp = await axios.get(`${getHost(env)}/${CONFIG_URL}/current`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  logger.debug(
    `${logPrefix(env)} Retrieved configuration with version (current)`,
    {
      'x-ghostlocker-correlationid': resp?.headers[GL_COR_ID] || 'Undefined',
    },
  );
  return resp.data;
};

export const updateTranslations = async (
  payload: any,
  env: Env,
  changedBy: string,
) => {
  const token = await getAccessToken(env);

  const config = await getConfigOfVersion(
    GLSet.PROMO_TRANSLATED,
    'current',
    token,
    env,
  );

  config.configurationValue = JSON.stringify(payload);
  config.comments = `SAMOC: Updated translations on ${format(
    new Date(),
    'yyyyMMdd-HHmmss',
  )}`;
  config.lastChangedBy = `FLEX-SAMOC on behalf of ${changedBy}`;

  // 4. validate config
  const validateResp = await readGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.PROMO_TRANSLATED)}?validateOnly=true`,
    config,
    token,
  );
  logger.debug(`${logPrefix(env)} Config Validated`, {
    'x-ghostlocker-correlationid':
      validateResp?.headers[GL_COR_ID] || 'Undefined',
  });
  // 5. update config
  const updateResp = await updateGhostLocker(
    `${getHost(env)}/${configUrl(GLSet.PROMO_TRANSLATED)}`,
    config,
    token,
    env,
  );
  return updateResp.data;
};
