import { db } from '../src/models';
import * as ctf from '../src/services/Contentful';
import { DiscountType } from '../src/types/enum';
import {
  OfferContentfulPayload,
  PlanRecurlyPayload,
} from '../src/types/payload';

describe('Contentful Service', () => {
  beforeAll(async () => {
    await db.sync();
  });

  let payload: OfferContentfulPayload;
  let plan: PlanRecurlyPayload;

  beforeEach(async (done) => {
    jest.resetAllMocks();
    payload = {
      entryState: '',
      environments: [],
      offerTypeId: 2,
      offerHeader: 'Offer Header for samocqa_0355gy goes here',
      offerBodyText:
        'Get FLEX with your new samocqa_0355gy subscription. Home to hit Original Series like Power and Outlander and thousands of movies.',
      offerAppliedBannerText: '$x/MONTH FOR y MONTHS PROMO APPLIED',
      offerBgImageUrl:
        'https://flex.imgix.net/BuyFlex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560',
      legalDisclaimer:
        'By selecting "CLAIM OFFER", you agree to authorize this charge and to the FLEX <a ng-click="vm.showTerms()">Terms of Service</a> and <a ng-click="vm.showPrivacy()">Privacy Policy</a>.',
      discountType: 'fixed',
      offerCode: 'samocqa_0355gy',
      planCode: 'flexy',
      discountAmount: 4.99,
      discountDurationValue: 2,
      discountDurationUnit: 'month',
    };
    plan = {
      planName: 'MockedPlan',
      planCode: 'mockedplancode',
      price: 74.99,
      billingCycleDuration: 12,
      billingCycleUnit: 'months',
      totalBillingCycles: 1,
      trialDuration: 7,
      trialUnit: 'days',
      state: 'active',
      planId: 'n8nxsiv6z5a1',
    };
    done();
  });

  describe('getFormattedTotal', () => {
    const manipulatePayload = (
      a: OfferContentfulPayload,
      w: DiscountType,
      x: number,
      y: number,
      z: string,
    ) => {
      a.discountType = w;
      a.discountAmount = x;
      a.discountDurationValue = y;
      a.discountDurationUnit = z;
    };
    const manipulatePlan = (
      a: PlanRecurlyPayload,
      v: number,
      w: number,
      x: string,
      y: number,
      z: string,
    ) => {
      a.price = v;
      a.trialDuration = w;
      a.trialUnit = x;
      a.billingCycleDuration = y;
      a.billingCycleUnit = z;
    };

    // multi-month
    it('Multi-month - fixed price no trial', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FIXED_PRICE, 5.99, 2, 'month');
      // manipulate plan
      manipulatePlan(plan, 12.34, null, null, 3, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>ONLY $5.99/MONTH FOR 2 MONTHS</span>');
      done();
    });
    it('Multi-month - fixed price trial', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FIXED_PRICE, 5.99, 2, 'month');
      // manipulate plan
      manipulatePlan(plan, 12.34, 7, 'day', 2, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe(
        '<span>$5.99/month for 2 months, 7-days free trial</span>',
      );
      done();
    });
    it('Multi-month - trial only', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 1, 'days');
      // manipulate plan
      manipulatePlan(plan, 43.99, null, null, 12, 'month');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$43.99/12 months, 1-day free trial</span>');
      done();
    });
    it('Multi-month - trial only', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 7, 'day');
      // manipulate plan
      manipulatePlan(plan, 43.99, null, null, 12, 'month');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$43.99/12 months, 7-days free trial</span>');
      done();
    });
    it('Multi-month - trial plan & offer', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 14, 'day');
      // manipulate plan
      manipulatePlan(plan, 23.99, 7, 'day', 6, 'month');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$23.99/6 months, 14-days free trial</span>');
      done();
    });

    // single-month
    it('Single-month - fixed price no trial', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FIXED_PRICE, 7.99, 2, 'month');
      // manipulate plan
      manipulatePlan(plan, 12.34, null, null, 1, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>ONLY $7.99/MONTH FOR 2 MONTHS</span>');
      done();
    });
    it('Single-month - fixed price trial', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FIXED_PRICE, 8.99, 3, 'month');
      // manipulate plan
      manipulatePlan(plan, 12.34, 7, 'day', 1, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe(
        '<span>$8.99/month for 3 months, 7-days free trial</span>',
      );
      done();
    });
    it('Single-month - trial only plural test', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 21, 'day');
      // manipulate plan
      manipulatePlan(plan, 8.99, null, null, 1, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$8.99/month, 21-days free trial</span>');
      done();
    });
    it('Single-month - trial only singular test', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 1, 'days');
      // manipulate plan
      manipulatePlan(plan, 8.99, null, null, 1, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$8.99/month, 1-day free trial</span>');
      done();
    });
    it('Single-month - trial plan & offer', async (done) => {
      // manipulate payload
      manipulatePayload(payload, DiscountType.FREE_TRIAL, null, 33, 'day');
      // manipulate plan
      manipulatePlan(plan, 8.99, 7, 'day', 1, 'months');
      const result = await ctf.getFormattedTotal(payload, plan);
      expect(result).toBe('<span>$8.99/month, 33-days free trial</span>');
      done();
    });
  });

  afterEach(async (done) => {
    done();
  });

  afterAll(async () => {
    await db.close();
  });
});
