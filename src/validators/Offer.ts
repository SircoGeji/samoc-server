import { body, param } from 'express-validator';
import { VALID_PLAN_CODE_REGEXP } from './Plan';
import { CodeType, DiscountType, Env, OfferTypes } from '../types/enum';
import { NODE_ENV } from '../util/config';
import { OfferType, Plan, Store } from '../models';
import { getPlanRecurlyPayload } from '../services/Recurly';
import { PlanRecurlyPayload } from '../types/payload';
import { getValidTextFieldRegExp } from '../services/RegExpRegenerate';

const VALID_NON_EXT_OFFER_CODE_REGEXP_QA = /^samocqa_[a-z0-9_]{1,42}$/;
const VALID_EXT_OFFER_CODE_REGEXP_QA = /^ext_samocqa_[a-z0-9_]{1,38}$/;
const VALID_OFFER_CODE_REGEXP = /^[a-z0-9_]{1,50}$/;
const VALID_URL_REGEXP = /^(https):\/\/(\w+:?\w*@)?(\S+)(:[0-9]+)?(\/|\/([\\w#!:.?+=&%@-\\/]))?$/;
const VALID_TEXT_FIELD_REGEXP = getValidTextFieldRegExp();

const MUST_START_STRING =
  'must start and only contain letters of English, French, German, Swedish, Spanish, Portuguese, Italian or Dutch languages; numbers or special symbols';

const getPlanDetails = async (
  planCode: string,
): Promise<PlanRecurlyPayload> => {
  const plan = await Plan.findByPk(planCode);
  const store = await Store.findByPk(plan.storeCode);
  return await getPlanRecurlyPayload(plan.planCode, store, Env.PROD);
};

export const offerValidationRules = (method?: string): any[] => {
  const checks: any[] = [];

  // Put common checks here
  checks.push(
    body('offerHeader')
      .exists({ checkFalsy: true })
      .withMessage('Offer Header is required.')
      .bail()
      .isLength({ min: 1, max: 150 })
      .withMessage('Offer header exceeds maximum (150) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Header ${MUST_START_STRING}`),
  );
  checks.push(
    body('offerName')
      .exists({ checkFalsy: true })
      .withMessage('Offer Name is required.')
      .bail()
      .isLength({ min: 1, max: 255 })
      .withMessage('Offer name exceeds maximum (255) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Name ${MUST_START_STRING}`),
  );
  checks.push(
    body('offerBodyText')
      .exists({ checkFalsy: true })
      .withMessage('Offer Body Text is required.')
      .bail()
      .isLength({ min: 1, max: 500 })
      .withMessage('Offer body text exceeds maximum (500) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Body Text ${MUST_START_STRING}`),
  );
  checks.push(
    body('offerBoldedText')
      .if((value: string) => {
        if (value) {
          return true;
        } else {
          return false;
        }
      })
      .isLength({ min: 1, max: 150 })
      .withMessage(
        'Offer Bolded Text exceeds maximum (150) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Bolded Text ${MUST_START_STRING}`),
  );
  // checks.push(
  //   body('offerCTA')
  //     .exists({ checkFalsy: true })
  //     .withMessage('Offer CTA is required.')
  //     .bail()
  //     .isLength({ min: 1, max: 255 })
  //     .withMessage('Offer CTA exceeds maximum (255) characters allowed.')
  //     .bail()
  //     .matches(VALID_TEXT_FIELD_REGEXP)
  //     .withMessage(
  //       `Offer CTA must start and only contain letters, numbers, or !@#$&().,?:/<>"'=+-_;`,
  //     ),
  // );
  checks.push(
    body('offerAppliedBannerText')
      .exists({ checkFalsy: true })
      .withMessage('Offer applied banner text is required.')
      .bail()
      .isLength({ min: 1, max: 150 })
      .withMessage(
        'Offer applied banner text exceeds maximum (150) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Applied Banner Text ${MUST_START_STRING}`),
  );
  checks.push(
    body('legalDisclaimer')
      .exists({ checkFalsy: true })
      .withMessage('Offer legal disclaimer text is required.')
      .bail()
      .isLength({ min: 1, max: 500 })
      .withMessage(
        'Offer legal disclaimer text exceeds maximum (500) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Legal Disclaimer ${MUST_START_STRING}`),
  );
  checks.push(
    body('welcomeEmailText')
      .if(body('discountType').not().matches(DiscountType.FREE_TRIAL))
      .exists({ checkFalsy: true })
      .withMessage('Offer welcome text is required.')
      .bail()
      .isLength({ min: 1, max: 255 })
      .withMessage(
        'Offer welcome text exceeds maximum (255) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Welcome Text ${MUST_START_STRING}`),
  );
  checks.push(
    body('offerBusinessOwner')
      .exists({ checkFalsy: true })
      .withMessage('Offer business owner is required.')
      .bail()
      .isLength({ min: 1, max: 50 })
      .withMessage(
        'Offer welcome text exceeds maximum (50) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage(`Offer Business Owner ${MUST_START_STRING}`),
  );
  checks.push(
    body('offerBgImageUrl')
      .if(body('offerTypeId').not().equals('4'))
      .exists({ checkFalsy: true })
      .withMessage('Offer Background Image Url is required.')
      .bail()
      .if(
        (value: string, input: any) => value && input.req.body.offerBgImageUrl,
      )
      .isLength({ max: 255 })
      .withMessage(
        'Offer Background Image Url exceeds maximum (255) characters allowed.',
      )
      .matches(VALID_URL_REGEXP)
      .withMessage(
        'Offer Background Image is not a valid URL. It must be a fully qualified, secure https URL.',
      ),
  );
  checks.push(
    body('claimOfferTerms')
      .if(body('offerTypeId').equals('4'))
      .exists({ checkFalsy: true })
      .withMessage('Claim Offer Terms is required.')
      .bail()
      .if(
        (value: string, input: any) => value && input.req.body.offerBgImageUrl,
      )
      .isLength({ max: 50000 })
      .withMessage(
        'Claim Offer Terms exceeds maximum (50000) characters allowed.',
      ),
  );
  checks.push(
    body('discountDurationValue')
      .if(
        (value: string, input: any) =>
          input.req.body.discountDurationType != 'forever' &&
          input.req.body.discountDurationType != 'single_use',
      )
      .isInt()
      .withMessage('Duration value must be an integer')
      .bail()
      .custom((value: number, { req }) => {
        let evaluation;
        if (req.body.discountType === DiscountType.FREE_TRIAL) {
          evaluation = value > 0 && value <= 365;
        } else {
          evaluation = true;
        }
        return evaluation;
      })
      .withMessage('Duration value must be from 1 to 365')
      .bail()
      .custom((value: number, { req }) => {
        let evaluation;
        if (req.body.discountType === DiscountType.FIXED_PRICE) {
          evaluation = value > 0 && value <= 24;
        } else {
          evaluation = true;
        }
        return evaluation;
      })
      .withMessage('Duration value must be from 1 to 24')
      .bail()
      .custom(async (value: number, { req }) => {
        if (req.body.planCode || req.body.draftPlanCode) {
          if (req.body.discountType === DiscountType.FIXED_PRICE) {
            const plan = await getPlanDetails(
              req.body.planCode || req.body.draftPlanCode,
            );
            if (value % plan.billingCycleDuration != 0) {
              // checking to see if billingCycleDuration is multiples of plan's billingCycleDuration
              return Promise.reject();
            }
          }
        }
      })
      .withMessage(
        `Discount duration value must be multiples of selected plan\'s billing cycle.`,
      )
      .toInt(),
  );
  checks.push(
    body('discountDurationUnit')
      .if(body('discountType').matches(DiscountType.FIXED_PRICE))
      .if(
        (value: string, input: any) =>
          input.req.body.discountDurationType != 'forever' &&
          input.req.body.discountDurationType != 'single_use',
      )
      .equals('month')
      .withMessage(
        "Duration Unit must be 'month' if Discount Type is Price Discount.",
      ),
  );
  checks.push(
    body('discountDurationUnit')
      .if(body('discountType').matches(DiscountType.FREE_TRIAL))
      .equals('day')
      .withMessage(
        "Duration Unit must be 'day' if Discount Type is Free Trial.",
      ),
  );
  checks.push(
    body('totalUniqueCodes')
      .if(body('offerCodeType').matches(CodeType.SINGLE_CODE))
      .not()
      .exists()
      .withMessage('Total unique codes should not be set for single code type'),
  );

  // Retention offer fields validation
  checks.push(
    body('storeCode')
      .if(body('offerTypeId').matches('4'))
      .exists({ checkFalsy: true })
      .withMessage('Store code is required.')
      .bail()
      .isLength({ min: 1, max: 50 })
      .withMessage('Store code exceeds maximum (50) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage('Store code contains invalid characters'),
  );
  checks.push(
    body('eligiblePlans')
      .if(body('offerTypeId').matches('4'))
      .exists({ checkFalsy: true })
      .withMessage('Eligible plans is required.')
      .bail()
      .isLength({ min: 1, max: 255 })
      .withMessage('Eligible plans exceeds maximum (255) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage('Eligible plans contains invalid characters'),
  );
  checks.push(
    body('upgradePlan')
      .if(body('offerTypeId').matches('4'))
      .if(body('createUpgradeOffer').isBoolean().matches('true'))
      .exists({ checkFalsy: true })
      .withMessage('Upgrade plan is required.')
      .bail()
      .isLength({ min: 1, max: 50 })
      .withMessage('Upgrade plan exceeds maximum (50) characters allowed.')
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage('Upgrade plan contains invalid characters'),
  );
  checks.push(
    body('usersOnPlans')
      .if(body('offerTypeId').matches('4'))
      .if(body('createUpgradeOffer').isBoolean().matches('true'))
      .if(body('upgradePlan').exists({ checkFalsy: true }))
      .exists({ checkFalsy: true })
      .withMessage('Upgrade users on plan is required.')
      .bail()
      .isLength({ min: 0, max: 255 })
      .withMessage(
        'Upgrade users on plan exceeds maximum (255) characters allowed.',
      )
      .bail()
      .matches(VALID_TEXT_FIELD_REGEXP)
      .withMessage('Upgrade users on plan contains invalid characters'),
  );

  switch (method) {
    case 'createNewOffer': {
      checks.push(
        body('offerCode')
          .if(
            body('offerTypeId').matches('2') ||
              body('offerTypeId').matches('3') ||
              body('offerTypeId').matches('4'),
          )
          .exists({ checkFalsy: true })
          .withMessage('Offer Code is required')
          .bail()
          .isLength({ min: 1, max: 50 })
          .withMessage('Offer Code exceeds maximum (50) characters allowed')
          .bail()
          .matches(
            NODE_ENV !== 'prod'
              ? VALID_NON_EXT_OFFER_CODE_REGEXP_QA
              : VALID_OFFER_CODE_REGEXP,
          )
          .withMessage(
            NODE_ENV !== 'prod'
              ? `Offer Code must start with "samocqa_" and only contain these valid characters: "a-z", "0-9", or "_".`
              : `Offer Code contains invalid characters, valid characters are "a-z", "0-9", or "_".`,
          ),
      );
      checks.push(
        body('offerCode')
          .if(body('offerTypeId').matches('5'))
          .exists({ checkFalsy: true })
          .withMessage('Offer Code is required')
          .bail()
          .isLength({ min: 1, max: 50 })
          .withMessage('Offer Code exceeds maximum (50) characters allowed')
          .bail()
          .matches(
            NODE_ENV !== 'prod'
              ? VALID_EXT_OFFER_CODE_REGEXP_QA
              : VALID_OFFER_CODE_REGEXP,
          )
          .withMessage(
            NODE_ENV !== 'prod'
              ? `Offer Code must start with "ext_samocqa_" and only contain these valid characters: "a-z", "0-9", or "_".`
              : `Offer Code contains invalid characters, valid characters are "a-z", "0-9", or "_".`,
          ),
      );
      checks.push(
        body('offerCodeType')
          .exists({ checkFalsy: true })
          .withMessage('Offer Code Type is required')
          .bail()
          .isIn([CodeType.SINGLE_CODE, CodeType.BULK_UNIQUE_CODE])
          .withMessage('Offer Code Type is invalid'),
      );
      checks.push(
        body('planCode')
          .if(body('offerTypeId').not().equals('4'))
          .exists({ checkFalsy: true })
          .withMessage('Plan Code is required')
          .bail()
          .isLength({ min: 1, max: 50 })
          .withMessage('Plan Code exceeds maximum (50) characters allowed')
          .bail()
          .matches(VALID_PLAN_CODE_REGEXP)
          .withMessage('Plan Code contains invalid characters'),
      );
      checks.push(
        body('offerTypeId')
          .exists({ checkFalsy: true })
          .withMessage('Offer Type is required')
          .bail()
          .isNumeric()
          .withMessage('Offer Type is invalid, must be a number')
          .bail()
          .toInt(),
      );
      checks.push(
        body('discountType')
          .exists({ checkFalsy: true })
          .withMessage('Discount Type is required'),
      );
      checks.push(
        body('totalUniqueCodes')
          .if(body('offerCodeType').matches(CodeType.BULK_UNIQUE_CODE))
          .exists({ checkFalsy: true })
          .withMessage('Total unique codes is required for Bulk offers')
          .bail()
          .custom((value: number) => value > 0 && value <= 99999)
          .withMessage('Total unique codes must be from 1 to 99999')
          .bail()
          .isNumeric()
          .withMessage('Total unique codes must be a number')
          .bail()
          .toInt(),
      );
      checks.push(
        body('publishDateTime')
          .if((value: string) => value)
          .custom((value) => {
            // evaluate publishDateTime and compare against now (UTC time)
            const publishDateTime = Date.parse(value);
            return publishDateTime > Date.now();
          })
          .withMessage('Publish Date and Time must be later than now')
          .bail()
          .if(
            (value: string, input: any) => value && input.req.body.endDateTime,
          )
          .custom((value, { req }) => {
            const publishDateTime = Date.parse(value);
            const endDateTime = Date.parse(req.body.endDateTime);
            return endDateTime > publishDateTime;
          })
          .withMessage(
            'Publish Date and Time must be before End Date and Time',
          ),
      );
      checks.push(
        body('discountAmount')
          .if(body('offerTypeId').not().matches('4'))
          .if(body('discountType').matches(DiscountType.FIXED_PRICE))
          .exists({ checkNull: true })
          .withMessage('Offer Promo Price is required')
          .bail()
          .isNumeric()
          .withMessage('Offer Promo Price must be a number')
          .bail()
          .custom((value: number) => value >= 0)
          .withMessage('Offer Promo Price must be a positive number or zero')
          .bail()
          .custom(async (value: number, input: any) => {
            const plan = await getPlanDetails(input.req.body.planCode);
            if (value > plan.price) {
              return Promise.reject();
            }
          })
          .withMessage(
            'Offer Promo Price must be smaller than or equal to the plan price',
          )
          .bail()
          .customSanitizer((value) => {
            return Number(value);
          }),
      );
      break;
    }

    case 'updateOffer': {
      checks.push(
        param('offerId')
          .if(
            body('offerTypeId').matches('2') ||
              body('offerTypeId').matches('3') ||
              body('offerTypeId').matches('4'),
          )
          .isLength({ min: 1, max: 50 })
          .withMessage('Offer Code exceeds maximum (50) characters allowed')
          .bail()
          .matches(
            NODE_ENV !== 'prod'
              ? VALID_NON_EXT_OFFER_CODE_REGEXP_QA
              : VALID_OFFER_CODE_REGEXP,
          )
          .withMessage(
            NODE_ENV !== 'prod'
              ? `Offer Code must start with "samocqa_" and only contain these valid characters: "a-z", "0-9", or "_".`
              : `Offer Code contains invalid characters, valid characters are "a-z", "0-9", or "_".`,
          ),
      );
      checks.push(
        param('offerId')
          .if(body('offerTypeId').matches('5'))
          .isLength({ min: 1, max: 50 })
          .withMessage('Offer Code exceeds maximum (50) characters allowed')
          .bail()
          .matches(
            NODE_ENV !== 'prod'
              ? VALID_EXT_OFFER_CODE_REGEXP_QA
              : VALID_OFFER_CODE_REGEXP,
          )
          .withMessage(
            NODE_ENV !== 'prod'
              ? `Offer Code must start with "ext_samocqa_" and only contain these valid characters: "a-z", "0-9", or "_".`
              : `Offer Code contains invalid characters, valid characters are "a-z", "0-9", or "_".`,
          ),
      );
      checks.push(
        body('offerCode')
          .not()
          .exists()
          .withMessage('Offer code cannot be updated'),
      );
      checks.push(
        body('planCode')
          .not()
          .exists()
          .withMessage('Plan Code cannot be updated'),
      );
      checks.push(
        body('discountAmount')
          .if(body('draftPlanCode'))
          .if(body('discountType').matches(DiscountType.FIXED_PRICE))
          .exists({ checkNull: true })
          .withMessage('Offer Promo Price is required')
          .bail()
          .isNumeric()
          .withMessage('Offer Promo Price must be a number')
          .bail()
          .custom((value: number) => value >= 0)
          .withMessage('Offer Promo Price must be a positive number or zero')
          .bail()
          .custom(async (value: number, input: any) => {
            if (input.req.body.draftPlanCode) {
              const plan = await Plan.findByPk(input.req.body.draftPlanCode);
              const store = await Store.findByPk(plan.storeCode);
              const recurlyPlan = await getPlanRecurlyPayload(
                plan.planCode,
                store,
                Env.PROD,
              );
              if (value > recurlyPlan.price) {
                return Promise.reject();
              }
            }
          })
          .withMessage(
            'Offer Promo Price must be smaller than or equal to the plan price',
          )
          .bail()
          .customSanitizer((value) => {
            return Number(value);
          }),
      );
      break;
    }
  }
  return checks;
};
