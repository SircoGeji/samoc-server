import pRetry from 'p-retry';
import { WebClient, LogLevel } from '@slack/web-api';
import { pRetryOptions } from '../util/utils';
import Logger from '../util/logger';
import { Env } from '../types/enum';
import { SlackError } from '../util/errorHandler';
import { SlackConfig } from '../models';
import { SlackConfigModel } from '../models/SlackConfig';
import { CONFIG_SET_ID } from './GhostLocker';
import { updateSpinnerText } from '../util/utils';
import { OfferModel } from 'src/models/Offer';
import { RetentionOfferModel } from 'src/models/RetentionOffer';
import { getOfferTypeLabel } from '../types/enum';
import { ExtensionOfferModel } from 'src/models/web/ExtensionOffer';

const logger = Logger(module);

const handleError = (err: any) => {
  logger.error(`Slack: Operation failed, ${err.message}`, err);
  let msg = err.message;
  if (err.response && err.response.status && err.response.status === 401) {
    msg = 'GhostLocker Error - Invalid API Key, unauthorized.';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    msg = 'GhostLocker is busy';
  }
  throw new SlackError(
    `GhostLocker operation failed, ${msg}`,
    err.statusCode ? err.statusCode : 500,
  );
};

export const getSlackBotConfig = async (): Promise<any[]> => {
  const slackConfigModels: SlackConfigModel[] = await SlackConfig.findAll();
  let slackConfigFormatted: any[] = [];
  let allUsersInfo: any[] = [];
  for (var model of slackConfigModels) {
    const data = JSON.parse(JSON.stringify(model.data));
    const client = new WebClient(model.apiKey, {
      // LogLevel can be imported and used to make debugging simpler
      logLevel: LogLevel.DEBUG,
    });
    updateSpinnerText('Getting slack channels info...');
    const channels = await getSlackChannelsInfo(
      data.channelsId,
      client,
      model.apiKey,
    );
    updateSpinnerText('Getting slack channel members info...');
    const usersListInfo = await getSlackChannelMembersInfo(
      model.id,
      allUsersInfo,
    );
    slackConfigFormatted.push({
      id: model.id,
      name: model.name,
      enabled: model.enabled,
      type: model.type,
      data: {
        channels,
        mentions: data.mentionsId,
        usersListInfo,
      },
    });
  }
  return slackConfigFormatted;
};

export const getSlackBotConfigById = async (
  id: number,
): Promise<SlackConfigModel> => {
  return await SlackConfig.findByPk(id);
};

export const getSlackChannelsInfo = async (
  channelsId: [],
  client: WebClient,
  key: string,
): Promise<any[]> => {
  let channelDetails = [];
  for (var channel of channelsId) {
    const channelInfo = await client.conversations.info({
      token: key,
      channel: channel,
    });
    if (!!channelInfo && channelInfo.ok) {
      channelDetails.push({
        name: channelInfo.channel.name,
        id: channel,
        valid: true,
      });
    } else {
      channelDetails.push({ id: channel, name: '', valid: false });
    }
  }
  return channelDetails;
};

// Post a message to a channel your app is in using ID and message text
export const publishSlackMessage = async (
  slackBotModel: SlackConfigModel,
  message: string,
) => {
  const slackBotData = JSON.parse(JSON.stringify(slackBotModel.data));
  const client = new WebClient(slackBotModel.apiKey, {
    logLevel: LogLevel.DEBUG,
  });
  logger.debug('Starting slack publish with message: ' + message);
  let mentionsId = '';
  if (!slackBotData.mentionsId || slackBotData.mentionsId.length < 1) {
    mentionsId = '<!channel>, ';
  } else {
    for (var mentionId of slackBotData.mentionsId) {
      mentionsId = mentionsId + '<@' + mentionId + '>, ';
    }
  }
  const publishOp = async () => {
    logger.debug(
      `Beginning publish message to SLACK under '${slackBotModel.name}' SLACK bot`,
    );
    let result;
    for (var channel of slackBotData.channelsId) {
      result = await client.chat.postMessage({
        token: slackBotData.key,
        channel: channel,
        text: mentionsId + message,
      });
    }
  };
  try {
    return await pRetry(publishOp, pRetryOptions);
  } catch (err) {
    logger.error('Failed with error: ' + err);
    handleError(err);
  }
};

export const getRetentionOffersSlackChatMessage = (
  stage: string,
  regionCodes: string,
  updateResponse: any,
  updatedBy: string,
  isProd: boolean,
  firstVersion: number,
  secondVersion: number,
): string => {
  const splunkUrl = getSplunkLogUrl(updateResponse, isProd);
  const samocDiffUrl = getSamocVersionsDiffLink(
    isProd ? 'prod' : 'dev',
    firstVersion,
    secondVersion,
  );
  return `samoc *${process.env.NODE_ENV.toUpperCase()}* instance's GhotsLocker config _${
    CONFIG_SET_ID[1]
  }_ was changed for *${stage.toUpperCase()}* state for ${regionCodes} region.
  \n*UPDATED CONFIGURATION:*
  \n<${splunkUrl}|Show results in Splunk>
  \n<${samocDiffUrl}|Show detailed JSON difference in samoc>
  \n_Updated by ${updatedBy}_ on ${new Date().toString()}`;
};

const getSplunkLogUrl = (response: any, isProd: boolean) => {
  const splunkUrl = 'https://flex.splunkcloud.com';
  const index = getCurrentInstanceGLIndex(isProd);
  const correlationId = response.headers[
    'x-ghostlocker-correlationid'
  ] as string;
  const currenTime = Date.now().toString().slice(0, 10);
  const startTime = parseInt(currenTime) - 43200;
  const endTime = parseInt(currenTime) + 43200; //Date range, +- 12 hours to avoid time issues
  return `${splunkUrl}/en-US/app/search/search?q=search%20index%3D%22${index}%22%20Id%3D${correlationId}%20ApiRe*&display.page.search.mode=smart&dispatch.sample_ratio=1&earliest=${startTime}&latest=${endTime}`;
};

const getSamocVersionsDiffLink = (
  env: string,
  firstVersion: number,
  secondVersion: number,
) => {
  const baseUrl = getsamocHost();
  return `${baseUrl}/filter-diff?env=${env}&firstVersion=${firstVersion}&secondVersion=${secondVersion}`;
};

const getsamocHost = () => {
  const nodeEnv = process.env.NODE_ENV;
  switch (nodeEnv) {
    case 'local':
      return 'http://localhost:4200/#';
    case 'dev':
      return 'https://samoc-dev.flex.com/#';
    case 'qa':
      return 'https://samoc-qa.flex.com/#';
    case 'prod':
      return 'https://samoc.flex.com/#';
  }
};

const getCurrentInstanceGLIndex = (isProd: boolean) => {
  if (isProd) {
    return process.env.NODE_ENV === Env.PROD
      ? 'ghostlocker_prod'
      : 'ghostlocker_clientdev';
  } else {
    return process.env.NODE_ENV === Env.PROD
      ? 'ghostlocker_clientdev'
      : 'ghostlocker_qa04';
  }
};

export const getSlackChannelMembersInfo = async (
  slackModelId: number,
  allUsersInfo: any[],
) => {
  let result: any = {};
  const slackConfigModel: SlackConfigModel = await SlackConfig.findByPk(
    slackModelId,
  );
  const channelMembers = await getBotChannelsMembers(slackConfigModel);
  for (let [channelId, members] of Object.entries(channelMembers)) {
    let channelMembersInfo: any[] = [];
    for (let memberId of members as any[]) {
      const foundMember = !!allUsersInfo.length
        ? allUsersInfo.find((user) => user.id === memberId)
        : null;
      let memberInfo: any = null;
      if (!!foundMember) {
        memberInfo = foundMember;
      } else {
        memberInfo = await getUserInfo(slackConfigModel, memberId);
        allUsersInfo.push(memberInfo);
      }
      const filteredMemberInfo = {
        id: memberInfo.id,
        name: memberInfo.profile.real_name,
        image: memberInfo.profile.image_48,
      };
      if (!filteredMemberInfo.name.includes('App')) {
        channelMembersInfo.push(filteredMemberInfo);
      }
    }
    channelMembersInfo.sort((a, b) => a.name.localeCompare(b.name));
    result = { ...result, [channelId]: channelMembersInfo };
  }
  return result;
};

export const getBotChannelsMembers = async (
  slackConfigModel: SlackConfigModel,
) => {
  const data = JSON.parse(JSON.stringify(slackConfigModel.data));
  const client = new WebClient(slackConfigModel.apiKey, {
    logLevel: LogLevel.DEBUG,
  });
  const channelMembersOp = async () => {
    let channelResult: any = {};
    for (let channelId of data.channelsId) {
      logger.debug(
        `Getting members of SLACK channel '${channelId}' under '${slackConfigModel.name}' SLACK bot`,
      );
      const channelMembers = await client.conversations.members({
        token: slackConfigModel.apiKey,
        channel: channelId,
      });
      if (!!channelMembers.ok) {
        channelResult = {
          ...channelResult,
          [channelId]: channelMembers.members,
        };
      }
    }
    return channelResult;
  };
  try {
    return await pRetry(channelMembersOp, pRetryOptions);
  } catch (err) {
    logger.error('Failed with error: ' + err);
    handleError(err);
  }
};

export const getAllUsersInfo = async (slackConfigModel: SlackConfigModel) => {
  const client = new WebClient(slackConfigModel.apiKey, {
    logLevel: LogLevel.DEBUG,
  });
  const usersListOp = async () => {
    logger.debug(
      `Getting users list under '${slackConfigModel.name}' SLACK bot`,
    );
    const usersInfoRes = await client.users.list({
      token: slackConfigModel.apiKey,
    });
    return !!usersInfoRes.ok ? usersInfoRes.members : null;
  };
  try {
    return await pRetry(usersListOp, pRetryOptions);
  } catch (err) {
    logger.error('Failed with error: ' + err);
    handleError(err);
  }
};

export const getUserInfo = async (
  slackConfigModel: SlackConfigModel,
  userId: string,
) => {
  const client = new WebClient(slackConfigModel.apiKey, {
    logLevel: LogLevel.DEBUG,
  });
  const usersListOp = async () => {
    logger.debug(
      `Getting users list under '${slackConfigModel.name}' SLACK bot`,
    );
    const userInfoRes = await client.users.info({
      token: slackConfigModel.apiKey,
      user: userId,
    });
    return !!userInfoRes.ok ? userInfoRes.user : null;
  };
  try {
    return await pRetry(usersListOp, pRetryOptions);
  } catch (err) {
    logger.error('Failed with error: ' + err);
    handleError(err);
  }
};

export const getExpireOfferSlackChatMessage = (
  offerModel: OfferModel | RetentionOfferModel | ExtensionOfferModel,
  updatedBy: string,
): string => {
  return `samoc *${process.env.NODE_ENV.toUpperCase()}* instance's *${offerModel.storeCode
    .slice(-2)
    .toUpperCase()}* ${getOfferTypeLabel(
    offerModel.draftData.offerTypeId,
  ).toLowerCase()} offer [${offerModel.draftData.offerName}] (${
    offerModel.offerCode
  }) was expired!
  \n_Updated by ${updatedBy}_ on ${new Date().toString()}`;
};

export const getFailedDITSlackChatMessage = (
  offerModel: OfferModel | RetentionOfferModel,
  errorMessage: string,
): string => {
  return `samoc *${process.env.NODE_ENV.toUpperCase()}* instance's *${offerModel.storeCode
    .slice(-2)
    .toUpperCase()}* ${getOfferTypeLabel(
    offerModel.draftData.offerTypeId,
  ).toLowerCase()} offer [${offerModel.draftData.offerName}] (${
    offerModel.offerCode
  }) data integrity test failed:
  \n\`\`\`${errorMessage}\`\`\``;
};
