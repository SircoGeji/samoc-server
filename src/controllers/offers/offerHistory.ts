import { NextFunction, Request, Response } from 'express';
import Logger from '../../util/logger';
import { pRetryOptions, processOfferError } from '../../util/utils';
import { OfferHistory } from '../../models';
import { retWithSuccess } from '../../models/SamocResponse';
import { Env, StatusEnum } from '../../types/enum';
import asyncHandler from 'express-async-handler';
import pRetry from 'p-retry';
import * as httpContext from 'express-http-context';
import { OfferHistoryModel } from 'src/models/OfferHistory';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Get OfferHistory Controller:`;
  } else {
    return `Get OfferHistory Controller:`;
  }
};

export const createOfferHistoryInDb = async (
  offerModel: any,
  createdBy: string,
  updatedBy: string,
): Promise<OfferHistoryModel> => {
  let result: OfferHistoryModel = null;
  const prevOfferRecords = await OfferHistory.findAll({
    where: { storeCode: offerModel.storeCode, offerCode: offerModel.offerCode },
  });
  let prevOfferRecord: any = null;
  if (prevOfferRecords.length) {
    prevOfferRecord = prevOfferRecords.pop();
  }

  const dbOfferHistoryOp = async () => {
    const dbPayload = {
      storeCode: offerModel.storeCode,
      offerCode: offerModel.offerCode,
      createdBy: !!createdBy ? createdBy : '',
      createdAt: offerModel.CreatedAt,
      updatedBy: !!updatedBy ? updatedBy : '',
      updatedAt: offerModel.LastModifiedAt,
      statusId: offerModel.statusId,
      draftData: offerModel.draftData,
    };
    if (
      !prevOfferRecord ||
      (!!prevOfferRecord &&
        ((isExtensionOffer(offerModel.offerCode)
          ? !!getExtensionOfferHistoryFieldsChanges(
              prevOfferRecord.draftData,
              offerModel.draftData,
            )
          : !!getOfferHistoryFieldsChanges(
              prevOfferRecord.draftData,
              offerModel.draftData,
            )) ||
          (prevOfferRecord.statusId >= StatusEnum.STG &&
            prevOfferRecord.statusId !== StatusEnum.PROD &&
            offerModel.statusId === StatusEnum.PROD) ||
          offerModel.statusId === StatusEnum.STG_RETD ||
          offerModel.statusId === StatusEnum.PROD_RETD))
    ) {
      result = await OfferHistory.create(dbPayload);
    }
  };
  // setup retry mechanism
  await pRetry(dbOfferHistoryOp, pRetryOptions);
  return result;
};

/**
 * GET /api/offers/:offerId
 * Get an existing offer by OfferCode
 * @param {Request}     req
 * @param {Response}    res
 */
export const getOfferHistory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    logger.debug('OffersHistory Controller - getOfferHistory');
    const { offerId } = req.params;
    const { store } = req.query;
    const storeCode = store ? (store as string) : null;
    httpContext.set('offerCode', offerId);
    try {
      const models = await getOfferHistoryModels(storeCode, offerId);
      if (!models) {
        retWithSuccess(req, res, {
          message: `Offer (${offerId}) history not found`,
          data: null,
        });
      } else {
        retWithSuccess(req, res, {
          message: `Offer (${offerId}) history found`,
          data: models,
        });
      }
    } catch (err) {
      logger.error(
        `${logPrefix()} getOfferHistory failed, ${err.message}`,
        err,
      );
      return next(processOfferError(err));
    }
  },
);

export const getOfferHistoryModels = async (
  storeCode: string,
  offerCode: string,
): Promise<any> => {
  const offerHistoryModels = await OfferHistory.findAll({
    where: { storeCode, offerCode },
  });
  if (!offerHistoryModels.length) {
    return null;
  }
  let offerHistoryArr: any[] = [];
  offerHistoryModels.sort(
    (a, b) => new Date(a.updatedBy).getTime() - new Date(b.updatedBy).getTime(),
  );
  for (let [i, offerHistoryModel] of offerHistoryModels.entries()) {
    let prevOfferHistory = offerHistoryModels[i - 1]
      ? offerHistoryModels[i - 1]
      : null;
    let offerData: any = offerHistoryModel.draftData;
    const { action, changedFields } = getOfferHistoryAction(
      isExtensionOffer(offerCode),
      offerHistoryModel.statusId,
      !!prevOfferHistory ? prevOfferHistory : null,
      offerData,
    );
    let offerHistoryObj: any = {
      action,
      actionMadeBy: offerHistoryModel.updatedBy,
      actionMadeAt: offerHistoryModel.updatedAt,
    };
    offerHistoryObj.offerName = offerData.offerName;
    if (!!changedFields) {
      offerHistoryObj.changedFields = changedFields;
    }
    if (!!action) {
      offerHistoryArr.push(offerHistoryObj);
    }
  }
  return offerHistoryArr;
};

const getOfferHistoryAction = (
  isExtension: boolean,
  statusId: number,
  prevOffer: any,
  offerData: any,
): any => {
  let action = '';
  let changedFields = null;
  if (statusId === StatusEnum.STG_RETD || statusId === StatusEnum.PROD_RETD) {
    action = 'retired';
  } else if (statusId >= StatusEnum.PROD) {
    if (
      prevOffer === null ||
      (!!prevOffer &&
        prevOffer.statusId >= StatusEnum.STG &&
        prevOffer.statusId < StatusEnum.PROD)
    ) {
      action = 'published';
    } else {
      changedFields = isExtension
        ? getExtensionOfferHistoryFieldsChanges(prevOffer.draftData, offerData)
        : getOfferHistoryFieldsChanges(prevOffer.draftData, offerData);
      if (!!changedFields) {
        action = 'updated';
      } else {
        action = null;
      }
    }
  } else if (statusId >= StatusEnum.STG && prevOffer === null) {
    action = 'created';
  } else if (prevOffer !== null) {
    changedFields = isExtension
      ? getExtensionOfferHistoryFieldsChanges(prevOffer.draftData, offerData)
      : getOfferHistoryFieldsChanges(prevOffer.draftData, offerData);
    if (!!changedFields) {
      action = 'updated';
    } else {
      action = null;
    }
  }
  return { action, changedFields };
};

const getOfferHistoryFieldsChanges = (
  prevOfferData: any,
  offerData: any,
): string[] => {
  if (!prevOfferData) {
    return null;
  }
  let result: string[] = [];
  if (prevOfferData.offerName !== offerData.offerName) {
    result.push('offerName');
  }
  if (prevOfferData.offerHeader !== offerData.offerHeader) {
    result.push('offerHeader');
  }
  if (prevOfferData.offerBodyText !== offerData.offerBodyText) {
    result.push('offerBodyText');
  }
  if (offerData.claimOfferTerms) {
    if (prevOfferData.claimOfferTerms !== offerData.claimOfferTerms) {
      result.push('claimOfferTerms');
    }
  }
  if (prevOfferData.legalDisclaimer !== offerData.legalDisclaimer) {
    result.push('legalDisclaimer');
  }
  if (prevOfferData.offerBoldedText !== offerData.offerBoldedText) {
    result.push('offerBoldedText');
  }
  if (prevOfferData.welcomeEmailText !== offerData.welcomeEmailText) {
    result.push('welcomeEmailText');
  }
  if (prevOfferData.offerBusinessOwner !== offerData.offerBusinessOwner) {
    result.push('offerBusinessOwner');
  }
  if (
    prevOfferData.offerAppliedBannerText !== offerData.offerAppliedBannerText
  ) {
    result.push('offerAppliedBannerText');
  }
  if (offerData.offerBgImageUrl) {
    if (prevOfferData.offerBgImageUrl !== offerData.offerBgImageUrl) {
      result.push('offerBgImageUrl');
    }
  }
  if (
    (offerData.endDateTime !== undefined &&
      !offerData.noEndDate &&
      prevOfferData.endDateTime === undefined &&
      prevOfferData.noEndDate) ||
    (offerData.endDateTime === undefined &&
      offerData.noEndDate &&
      prevOfferData.endDateTime !== undefined &&
      !prevOfferData.noEndDate) ||
    (prevOfferData.endDateTime !== undefined &&
      offerData.endDateTime !== undefined &&
      prevOfferData.endDateTime !== offerData.endDateTime)
  ) {
    result.push('endDate');
  }
  return result.length ? result : null;
};

const getExtensionOfferHistoryFieldsChanges = (
  prevOfferData: any,
  offerData: any,
): string[] => {
  if (!prevOfferData) {
    return null;
  }
  let result: string[] = [];
  if (prevOfferData.offerTitle !== offerData.offerTitle) {
    result.push('offerTitle');
  }
  if (prevOfferData.offerDescription !== offerData.offerDescription) {
    result.push('offerDescription');
  }
  if (prevOfferData.offerTerms !== offerData.offerTerms) {
    result.push('offerTerms');
  }
  if (prevOfferData.bannerText !== offerData.bannerText) {
    result.push('bannerText');
  }
  if (prevOfferData.offerBusinessOwner !== offerData.offerBusinessOwner) {
    result.push('offerBusinessOwner');
  }
  return result.length ? result : null;
};

const isExtensionOffer = (offerCode: string): boolean => {
  return offerCode.includes('ext_');
};
