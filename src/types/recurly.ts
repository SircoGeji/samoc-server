export interface CouponUpdatePayload {
  name: string;
  uniqueCouponCodesCount?: number;
  maxRedemptionsPerAccount: number;
  invoiceDescription?: string;
  redeemByDate: string;
}

export interface CouponCreationPayload extends CouponUpdatePayload {
  couponType: string;
  code: string;
  discountType: string;
  planCodes: string[];
  currencies?: CouponCurrencyPayload[];
  duration?: string;
  temporalAmount?: number;
  temporalUnit?: string;
  redemptionResource?: string;
  freeTrialAmount?: number;
  freeTrialUnit?: string;
  uniqueCodeTemplate?: string;
}

export interface PlanUpdatePayload {
  code: string;
  name: string;
  trialUnit: string;
  trialLength: number;
  trialRequiresBillingInfo: boolean;
  totalBillingCycles: number;
  autoRenew: boolean;
  taxCode: string;
  taxExempt: boolean;
  currencies: PlanCurrencyPayload[];
}

export interface PlanCreationPayload extends PlanUpdatePayload {
  intervalUnit: string;
  intervalLength: number;
}

interface CouponCurrencyPayload {
  discount: number;
  currency: string;
}

interface PlanCurrencyPayload {
  currency: string;
  setupFee: number;
  unitAmount: number;
}

export interface RecurlyCredential {
  subdomain: string;
  apiKey: string;
}
