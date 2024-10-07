import { NextFunction, Request, Response } from 'express';
import { processOfferError, sleep } from '../../util/utils';
import { retWithSuccess } from '../../models/SamocResponse';
import asyncHandler from 'express-async-handler';
import * as crypto from 'crypto';
import axios from 'axios';
import { getSecret } from '../../services/SecretManager';
import { Env } from '../../types/enum';
import Logger from '../../util/logger';
import { DPEConfig } from '../../models';

const logger = Logger(module);

/**
 * GET /api/dpe/config
 * Send test post request
 * @param {Request}     req
 * @param {Response}    res
 */
export const getDPEConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const regionCode = req.query.regionCode as string;
    try {
      // const { stgUrl, stgKey, prodUrl, prodKey } = await getSecret();
      const { url, key } = await getSecret();
      const timestamp = new Date();
      const timestampEpochSeconds = Math.floor(timestamp.getTime() / 1000);
      const baseSignatureString = `v1_0:${timestampEpochSeconds}:`;
      const signature = `v1_0=${crypto
        .createHmac('sha256', key)
        .update(baseSignatureString)
        .digest('hex')}`;

      logger.debug(`SAMOC DPE ${process.env.NODE_ENV} request:`, {
        url,
        headers: {
          'x-conky-request-timestamp': timestampEpochSeconds.toString(),
          'x-conky-signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
      });
      const response: any = await axios.get(url, {
        headers: {
          'x-conky-request-timestamp': timestampEpochSeconds.toString(),
          'x-conky-signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
      });
      logger.debug(`SAMOC DPE ${process.env.NODE_ENV} response:`, {
        response,
      });

      let data: any = {};
      const foundDPEConfig = await DPEConfig.findOne({
        where: { regionCode },
      });
      if (response.status === 200 && foundDPEConfig) {
        const latestEntry = response.data[0][0].LATEST_ENTRY;
        const stgFilterState = (foundDPEConfig.data as any).filterState;
        const prodFilterState = latestEntry.value.filterState;
        if (stgFilterState.stgVer !== stgFilterState.prodVer) {
          data.isStgEqualProd = false;
          data.timestampUtc = foundDPEConfig.timestampUtc;
          data.value = foundDPEConfig.data;
        } else {
          data.isStgEqualProd = true;
          data.timestampUtc = latestEntry.timestampUtc;
          data.value = latestEntry.value;
        }
      } else if (!foundDPEConfig) {
        const latestEntry = response.data[0][0].LATEST_ENTRY;
        await DPEConfig.create({
          regionCode,
          timestampUtc: latestEntry.timestampUtc,
          data: latestEntry.value,
        });
        data = latestEntry.value;
      }

      retWithSuccess(req, res, {
        message: 'DPE config found',
        status: !!response ? response.status : 200,
        data,
      });
    } catch (err) {
      logger.error('GET DPE config failed: ', err);
      return next(processOfferError(err));
    }
  },
);

/**
 * POST /api/dpe/config
 * Send test post request
 * @param {Request}     req
 * @param {Response}    res
 */
export const postDPEConfig = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const body = JSON.stringify(req.body);
    const regionCode = req.query.regionCode as string;
    const env = req.query.env as Env;
    try {
      let message;
      let status;
      let data;
      const foundDPEConfig = await DPEConfig.findOne({
        where: { regionCode },
      });

      if (env === Env.STG) {
        // save config in DB
        foundDPEConfig.set('timestampUtc', new Date().toISOString());
        foundDPEConfig.set('data', JSON.parse(body));
        await foundDPEConfig.save();

        message = `DPE config updated successfully in DB`;
        status = 200;
        data = foundDPEConfig.data;
      } else if (env === Env.PROD) {
        const { url, key } = await getSecret();
        const timestamp = new Date();
        const timestampEpochSeconds = Math.floor(timestamp.getTime() / 1000);
        const baseSignatureString = `v1_0:${timestampEpochSeconds}:${body}`;

        const signature = `v1_0=${crypto
          .createHmac('sha256', key)
          .update(baseSignatureString)
          .digest('hex')}`;
        await axios.post(url, body, {
          headers: {
            'x-conky-request-timestamp': timestampEpochSeconds.toString(),
            'x-conky-signature': signature,
            'Content-Type': 'application/json',
          },
          timeout: 300000,
        });
        // save config in DB
        foundDPEConfig.set('timestampUtc', new Date().toISOString());
        foundDPEConfig.set('data', JSON.parse(body));
        await foundDPEConfig.save();

        message = `DPE config updated successfully on ${env.toUpperCase()}`;
        status = 200;
        data = JSON.parse(body);
      }

      retWithSuccess(req, res, {
        message,
        status,
        data,
      });
    } catch (err) {
      return next(processOfferError(err));
    }
  },
);

/**
 * GET /api/dpe/config/sync?regionCode
 * Send test post request
 * @param {Request}     req
 * @param {Response}    res
 */
export const rollbackDPEConfigToProd = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const regionCode = req.query.regionCode as string;
    try {
      // const { stgUrl, stgKey, prodUrl, prodKey } = await getSecret();
      const { url, key } = await getSecret();
      const timestamp = new Date();
      const timestampEpochSeconds = Math.floor(timestamp.getTime() / 1000);
      const baseSignatureString = `v1_0:${timestampEpochSeconds}:`;
      const signature = `v1_0=${crypto
        .createHmac('sha256', key)
        .update(baseSignatureString)
        .digest('hex')}`;

      logger.debug(`SAMOC DPE ${process.env.NODE_ENV} request:`, {
        url,
        headers: {
          'x-conky-request-timestamp': timestampEpochSeconds.toString(),
          'x-conky-signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
      });
      const response: any = await axios.get(url, {
        headers: {
          'x-conky-request-timestamp': timestampEpochSeconds.toString(),
          'x-conky-signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 300000,
      });
      logger.debug(`SAMOC DPE ${process.env.NODE_ENV} response:`, {
        response,
      });

      let data: any = {};
      const foundDPEConfig = await DPEConfig.findOne({
        where: { regionCode },
      });
      const latestEntry = response.data[0][0].LATEST_ENTRY;
      if (response.status === 200 && foundDPEConfig) {
        foundDPEConfig.set('timestampUtc', new Date().toISOString());
        foundDPEConfig.set('data', latestEntry.value);
        await foundDPEConfig.save();
      } else if (!foundDPEConfig) {
        await DPEConfig.create({
          regionCode,
          timestampUtc: latestEntry.timestampUtc,
          data: latestEntry.value,
        });
      }
      data = latestEntry.value;

      retWithSuccess(req, res, {
        message: 'DPE config synchronized successfully',
        status: !!response ? response.status : 200,
        data,
      });
    } catch (err) {
      logger.error('Rollback DPE config failed: ', err);
      return next(processOfferError(err));
    }
  },
);
