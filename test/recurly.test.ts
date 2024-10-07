import faker from 'faker';
import {
  getCreateCouponPayload,
  getEligiblePlanCodes,
  getUpdateCouponPayload,
} from '../src/services/Recurly';
import { CodeType, DiscountType, Env } from '../src/types/enum';
import { OfferRecurlyPayload, PlanRecurlyPayload } from '../src/types/payload';

const testCurrencyCode = 'USD';
const testPlanCode = 'qamonthlynft';
const testPlanPrice = 8.99;
const testDiscountOfferPrice = 1.99;
const failedDiscountOfferPrice = 12.99;
const zeroDiscountOfferPrice = 0;

const generateOfferPayload = (
  offerCode: string,
  offerCodeType: string,
  offerDiscountType: string,
  discountAmount: number,
): OfferRecurlyPayload => {
  return {
    offerCode: offerCode,
    offerTypeId: 2,
    offerCodeType: offerCodeType,
    totalUniqueCodes: faker.random.number({ min: 1, max: 100000 }),
    planCode: testPlanCode,
    offerName: faker.lorem.sentence(),
    welcomeEmailText: faker.lorem.paragraph(),
    discountType: offerDiscountType,
    discountAmount: discountAmount,
    discountDurationValue: 14,
    discountDurationUnit: 'day',
    endDateTime: '2021-12-31T23:59:59Z',
    noEndDate: false,
  };
};

const generatePlanModel = (planCode: string): PlanRecurlyPayload => {
  return {
    planCode: planCode,
    billingCycleDuration: 3,
    billingCycleUnit: 'month',
    price: testPlanPrice,
    trialDuration: faker.random.number(),
    trialUnit: 'days',
    planId: 'mt14kls7lavn',
    planName: 'flex',
  };
};

describe('Recurly Coupon Services', () => {
  const offerCode = `SAMOC-coupon-${new Date()
    .toISOString()
    .replace(/[-]/g, '')
    .replace(/[T]/g, '-')
    .replace(/[:]/g, '')
    .replace(/[.]/g, '-')}-${Math.floor(Math.random() * 1000)}`.replace(
    /:./g,
    '',
  );

  const planCode = `SAMOC-plan-${new Date()
    .toISOString()
    .replace(/[-]/g, '')
    .replace(/[T]/g, '-')
    .replace(/[:]/g, '')
    .replace(/[.]/g, '-')}-${Math.floor(Math.random() * 1000)}`.replace(
    /:./g,
    '',
  );

  it('Get Recurly Creation Payload for single code type & fixed offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FIXED_PRICE,
      testDiscountOfferPrice,
    );
    const plan = generatePlanModel(planCode);
    const payload: any = getCreateCouponPayload(
      input,
      plan,
      testCurrencyCode,
      Env.STG,
    );
    expect(payload.name).toBe(input.offerName);
    expect(payload.couponType).toBe(input.offerCodeType);
    expect(payload.discountType).toBe(input.discountType);
    expect(payload.currencies[0].discount).toBe(
      testPlanPrice - testDiscountOfferPrice,
    );
    expect(payload.currencies[0].currency).toBe('USD');
    expect(payload.duration).toBe('temporal');
    expect(payload.temporalAmount).toBe(input.discountDurationValue);
    expect(payload.temporalUnit).toBe(input.discountDurationUnit);
    expect(payload.redemptionResource).toBe('subscription');
    expect(payload.invoiceDescription).toBe(input.welcomeEmailText);
    expect(payload.freeTrialAmount).toBeUndefined();
    expect(payload.freeTrialUnit).toBeUndefined();
    expect(payload.uniqueCodeTemplate).toBeUndefined();
  });

  it('Get Recurly Creation Payload for single code type & trial offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FREE_TRIAL,
      testDiscountOfferPrice,
    );
    const plan = generatePlanModel(planCode);
    const payload: any = getCreateCouponPayload(
      input,
      plan,
      testCurrencyCode,
      Env.STG,
    );
    expect(payload.name).toBe(input.offerName);
    expect(payload.couponType).toBe(input.offerCodeType);
    expect(payload.discountType).toBe(input.discountType);
    expect(payload.currencies).toBeUndefined();
    expect(payload.duration).toBeUndefined();
    expect(payload.temporalAmount).toBeUndefined();
    expect(payload.temporalUnit).toBeUndefined();
    expect(payload.redemptionResource).toBeUndefined();
    expect(payload.invoiceDescription).toBeUndefined();
    expect(payload.freeTrialAmount).toBe(input.discountDurationValue);
    expect(payload.freeTrialUnit).toBe(input.discountDurationUnit);
    expect(payload.uniqueCodeTemplate).toBeUndefined();
  });

  it('Get Recurly Creation Payload for bulk type & fixed offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.BULK_UNIQUE_CODE,
      DiscountType.FIXED_PRICE,
      testDiscountOfferPrice,
    );
    const plan = generatePlanModel(planCode);
    const payload: any = getCreateCouponPayload(
      input,
      plan,
      testCurrencyCode,
      Env.STG,
    );
    expect(payload.name).toBe(input.offerName);
    expect(payload.couponType).toBe(input.offerCodeType);
    expect(payload.discountType).toBe(input.discountType);
    expect(payload.currencies[0].discount).toBe(
      testPlanPrice - testDiscountOfferPrice,
    );
    expect(payload.currencies[0].currency).toBe('USD');
    expect(payload.duration).toBe('temporal');
    expect(payload.temporalAmount).toBe(input.discountDurationValue);
    expect(payload.temporalUnit).toBe(input.discountDurationUnit);
    expect(payload.redemptionResource).toBe('subscription');
    expect(payload.invoiceDescription).toBe(input.welcomeEmailText);
    expect(payload.freeTrialAmount).toBeUndefined();
    expect(payload.freeTrialUnit).toBeUndefined();
    expect(payload.uniqueCodeTemplate).not.toBeUndefined();
  });

  it('Get Recurly Creation Payload for bulk type & trial offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.BULK_UNIQUE_CODE,
      DiscountType.FREE_TRIAL,
      testDiscountOfferPrice,
    );
    const plan = generatePlanModel(planCode);
    const payload: any = getCreateCouponPayload(
      input,
      plan,
      testCurrencyCode,
      Env.STG,
    );
    expect(payload.name).toBe(input.offerName);
    expect(payload.couponType).toBe(input.offerCodeType);
    expect(payload.discountType).toBe(input.discountType);
    expect(payload.currencies).toBeUndefined();
    expect(payload.duration).toBeUndefined();
    expect(payload.temporalAmount).toBeUndefined();
    expect(payload.temporalUnit).toBeUndefined();
    expect(payload.redemptionResource).toBeUndefined();
    expect(payload.invoiceDescription).toBeUndefined();
    expect(payload.freeTrialAmount).toBe(input.discountDurationValue);
    expect(payload.freeTrialUnit).toBe(input.discountDurationUnit);
    expect(payload.uniqueCodeTemplate).not.toBeUndefined();
  });

  it('Get Recurly Update Payload for fixed offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FIXED_PRICE,
      testDiscountOfferPrice,
    );
    const payload: any = getUpdateCouponPayload(input);
    expect(payload.name).toBe(input.offerName);
    expect(payload.totalUniqueCodes).toBe(undefined);
    expect(payload.maxRedemptionsPerAccount).toBe(1);
    expect(payload.redeemByDate).toBe(
      new Date(input.endDateTime).toISOString(),
    );
    expect(payload.invoiceDescription).toBe(input.welcomeEmailText);
  });

  it('Get Recurly Update Payload for trial offer', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.BULK_UNIQUE_CODE,
      DiscountType.FREE_TRIAL,
      testDiscountOfferPrice,
    );
    const payload: any = getUpdateCouponPayload(input);
    expect(payload.name).toBe(input.offerName);
    expect(payload.totalUniqueCodes).toBe(undefined);
    expect(payload.maxRedemptionsPerAccount).toBe(1);
    expect(payload.redeemByDate).toBe(
      new Date(input.endDateTime).toISOString(),
    );
    expect(payload.invoiceDescription).toBeUndefined();
  });

  it('Throw exception when offer price is greater than plan price', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FIXED_PRICE,
      failedDiscountOfferPrice,
    );
    const plan = generatePlanModel(planCode);
    expect(() => {
      getCreateCouponPayload(input, plan, testCurrencyCode, Env.STG);
    }).toThrow();
  });

  it('Return 2 plan codes when offer is fixed and non-zero discount amount', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FIXED_PRICE,
      testDiscountOfferPrice,
    );
    const planCodes = getEligiblePlanCodes(input);
    expect(planCodes.length).toBe(2);
    expect(planCodes[0]).toBe(testPlanCode);
    expect(planCodes[1]).toBe('internal01');
  });

  it('Return 1 plan code when offer is fixed and zero discount amount', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FIXED_PRICE,
      zeroDiscountOfferPrice,
    );
    const planCodes = getEligiblePlanCodes(input);
    expect(planCodes.length).toBe(1);
    expect(planCodes[0]).toBe(testPlanCode);
  });

  it('Return 1 plan code when offer is trial', () => {
    const input = generateOfferPayload(
      offerCode,
      CodeType.SINGLE_CODE,
      DiscountType.FREE_TRIAL,
      testDiscountOfferPrice,
    );
    const planCodes = getEligiblePlanCodes(input);
    expect(planCodes.length).toBe(1);
    expect(planCodes[0]).toBe(testPlanCode);
  });
});

// describe('Recurly Plan Services', () => {
//   const planCode = `SAMOC-plan-${new Date()
//     .toISOString()
//     .replace(/[-]/g, '')
//     .replace(/[T]/g, '-')
//     .replace(/[:]/g, '')
//     .replace(/[.]/g, '-')}-${Math.floor(Math.random() * 1000)}`.replace(
//     /:./g,
//     '',
//   );

//   // TODO: Fix it when editing plans are enabled in SAMOC
//   it('Get Recurly Creation Payload', () => {
//     const input = generatePlanModel(planCode);
//     const payload = getCreatePlanPayload(input as PlanModel);
//     expect(payload.code).toBe(input.planCode);
//     expect(payload.name).toBe(input.planCode);
//     expect(payload.trialUnit).toBe(input.trialUnit);
//     expect(payload.trialLength).toBe(input.trialLength);
//     expect(payload.trialRequiresBillingInfo).toBeTruthy();
//     expect(payload.totalBillingCycles).toBe(1);
//     expect(payload.autoRenew).toBeTruthy();
//     expect(payload.taxCode).toBe('');
//     expect(payload.taxExempt).toBeFalsy();
//     expect(payload.currencies[0].currency).toBe('USD');
//     expect(payload.currencies[0].setupFee).toBe(0);
//     expect(payload.currencies[0].unitAmount).toBe(input.price);
//     expect(payload.intervalUnit).toBe(input.billingPeriodUnit);
//     expect(payload.intervalLength).toBe(input.billingPeriodLength);
//   });

//   it('Get Recurly Upate Payload', () => {
//     const input = generatePlanModel(planCode);
//     const payload = getUpdatePlanPayload(input as PlanModel, 'USD');
//     expect(payload.code).toBe(input.planCode);
//     expect(payload.name).toBe(input.planCode);
//     expect(payload.trialUnit).toBe(input.trialUnit);
//     expect(payload.trialLength).toBe(input.trialLength);
//     expect(payload.trialRequiresBillingInfo).toBeTruthy();
//     expect(payload.totalBillingCycles).toBe(1);
//     expect(payload.autoRenew).toBeTruthy();
//     expect(payload.taxCode).toBe('');
//     expect(payload.taxExempt).toBeFalsy();
//     expect(payload.currencies[0].currency).toBe('USD');
//     expect(payload.currencies[0].setupFee).toBe(0);
//     expect(payload.currencies[0].unitAmount).toBe(input.price);
//   });
// });
