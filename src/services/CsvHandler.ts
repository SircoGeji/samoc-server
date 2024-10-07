import Logger from '../util/logger';
import { OfferModel } from '../models/Offer';
import stringify from 'csv-stringify';
import { Env, WorkflowAction } from '../types/enum';
import {
  addOfferToWorkflowQueue,
  createRecurlyClient,
  getRecurlyCredential,
  removeOfferFromWorkflowQueue,
} from '../util/utils';
import { RecurlyCredential } from '../types/recurly';
import { io } from '../server';
import * as fs from 'fs';
import { generateCsvFileName, rmFile } from '../controllers/offers';
import { AppError } from '../util/errorHandler';

const logger = Logger(module);
const logPrefix = (env?: Env) => {
  if (env) {
    return `[${env.toUpperCase()}] Csv Handler:`;
  } else {
    return `Csv Handler:`;
  }
};
export const listUniqueCodes = async (
  offer: OfferModel,
  res: any,
  env: Env,
) => {
  try {
    await addOfferToWorkflowQueue(offer.offerCode, WorkflowAction.EXPORT_CSV);

    const fileName = generateCsvFileName(offer.storeCode, offer.offerCode, env);
    const csvRoot = process.env.CSV_ROOT;
    const fullPath = csvRoot + `/` + fileName;
    rmFile(fullPath);

    const rlyCred: RecurlyCredential = await getRecurlyCredential(
      offer.Plan.Store,
      env,
    );
    const rlyClient = await createRecurlyClient(rlyCred.apiKey);
    const codes = rlyClient.listUniqueCouponCodes(`code-${offer.offerCode}`);
    const bulkCodes: Array<any> = [];

    for await (const code of codes.each()) {
      if (code.state === 'redeemable') {
        bulkCodes.push({ bulkCode: offer.offerCode, code: code.code });
      }
    }

    stringify(
      bulkCodes,
      {
        header: true,
        columns: {
          bulkCode: 'bulk_coupon_prefix',
          code: 'unique_coupon_code',
        },
      },
      function (err, output) {
        fs.writeFile(fullPath, output, function (err) {
          if (err) {
            throw err;
          } else {
            // Removing this for now, seems redundant, but leaving it in here
            // for now, in case it breaks something else and need to revert quickly
            // io.emit('show-snackbar', {
            //   action: 'OK',
            //   msg: `CSV Export for '${offer.offerCode}' completed`,
            //   offerCode: offer.offerCode,
            //   event: 'enableDownloadBtn',
            // });
          }
        });
      },
    );
  } catch (err) {
    io.emit('show-snackbar', {
      action: 'ERROR',
      msg: `CSV export failed for ${offer.offerCode}`,
      event: 'exportCsvFailed',
    });
    logger.error(
      `${logPrefix(env)} listUniqueCodes failed for '${offer.offerCode}', ${
        err.message
      }`,
      err,
    );
    rmFile(offer.offerCode);
    throw new AppError(
      `CSV export failed for ${offer.offerCode}, ${err.message}`,
      500,
    );
  } finally {
    await removeOfferFromWorkflowQueue(offer.offerCode);
  }
};
