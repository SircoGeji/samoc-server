import asyncHandler from 'express-async-handler';
import { Request, Response } from 'express';
import { Region, State } from '../models';
import { retWithSuccess } from '../models/SamocResponse';
import Logger from '../util/logger';
import { StateModel } from 'src/models/State';

const logger = Logger(module);

/**
 * GET /api/states?region=<regionCode>
 * Get all states
 * @param {Request}     req
 * @param {Response}    res
 */
export const getAllStates = asyncHandler(async (req: Request, res: Response) => {
  logger.debug('States Controller - getAllStates');
  const { region } = req.query;
  const regionCode = region as string;
  let regionModels;
  if (regionCode) {
    const regionModel = await Region.findOne({
      where: {
        title: regionCode,
      },
    });
    regionModels = [regionModel];
  } else {
    regionModels = await Region.findAll();
  }
  const data: any[] = await getDBStates(regionModels);
  if (data.length) {
    retWithSuccess(req, res, {
      message: `States found for ${ regionCode ? `region (${region})`: 'all regions' }`,
      data,
    });
  } else {
    retWithSuccess(req, res, {
      message: `No state found for ${ regionCode ? `region (${region})`: 'all regions' }`,
      data: null,
    });
  }
});

const getDBStates = async (regionModels: any[]): Promise<any> => {
  let results: any[] = [];
  for (let regionModel of regionModels) {
    const states: StateModel[] = await State.findAll({
      where: { regionCode: regionModel.title },
    });
    if (states.length) {
      for (let state of states) {
        results.push({
          regionCode: state.regionCode,
          stateId: state.stateId,
          stateName: state.stateName,
          stateAbbr: state.stateAbbr,
          stateCode: state.stateCode,
        });
      }
    }
  }
  return results;
};
