export enum Env {
  DB = 'db',
  STG = 'stg',
  PROD = 'prod',
}

export enum CreateAction {
  SAVE = 'save',
  CREATE = 'create',
}

// These constants should match with the Status table in DB (db_init.sql)
export enum StatusEnum {
  DFT = 1,
  // ##### STG #####
  STG_ERR_CRT = 10,
  STG_ERR_UPD = 12,
  STG_ERR_DEL = 14,
  STG = 20,
  // STG_MODIFIED = 25,
  // Validation on STG
  STG_VALDN_PEND = 30,
  STG_VALDN_FAIL = 33,
  STG_VALDN_PASS = 36,
  STG_RETD = 40,
  STG_RB_FAIL = 45,
  STG_FAIL = 47,
  // Approval Workflow - future phase
  APV_PEND = 50,
  APV_REJ = 53,
  APV_APRVD = 56,
  // ##### PROD #####
  PROD_PEND = 60, // Scheduled for publish - future phase
  PROD_ERR_PUB = 62,
  PROD_ERR_UPD = 64,
  PROD_ERR_DEL = 66,
  PROD = 70,
  // PROD_MODIFIED = 75,
  // Validation on PROD
  PROD_VALDN_PEND = 80,
  PROD_VALDN_FAIL = 83,
  PROD_VALDN_PASS = 86,
  PROD_RETD = 90,
  PROD_RB_FAIL = 95,
  PROD_FAIL = 97,
}

export const ActiveOfferStatuses = new Set<StatusEnum>([
  StatusEnum.STG,
  StatusEnum.STG_VALDN_PEND,
  StatusEnum.STG_VALDN_PASS,
  StatusEnum.PROD,
  StatusEnum.PROD_VALDN_PEND,
  StatusEnum.PROD_VALDN_PASS,
]);

export const ActiveStgOfferStatuses = new Set<StatusEnum>([
  StatusEnum.STG,
  StatusEnum.STG_VALDN_PEND,
  StatusEnum.STG_VALDN_PASS,
]);

export const ActiveProdOfferStatuses = new Set<StatusEnum>([
  StatusEnum.PROD,
  StatusEnum.PROD_VALDN_PEND,
  StatusEnum.PROD_VALDN_PASS,
]);

export enum OfferTypes {
  DEFAULT_SIGNUP = 1,
  ACQUISITION,
  WINBACK,
  RETENTION,
  EXTENSION,
}

export const getOfferTypeLabel = (offerType: OfferTypes): string => {
  if (offerType === OfferTypes.DEFAULT_SIGNUP) {
    return 'Default Sign-up';
  } else if (offerType === OfferTypes.ACQUISITION) {
    return 'Acquisition';
  } else if (offerType === OfferTypes.WINBACK) {
    return 'Winback';
  } else if (offerType === OfferTypes.RETENTION) {
    return 'Retention';
  } else {
    return 'Undefined';
  }
};

export enum CodeType {
  SINGLE_CODE = 'single_code',
  BULK_UNIQUE_CODE = 'bulk',
}

export enum DiscountType {
  FIXED_PRICE = 'fixed',
  FREE_TRIAL = 'trial',
  PERCENT = 'percent',
}

export enum DurationType {
  FOREVER = 'forever',
  SINGLE_USE = 'single_use',
  TEMPORAL = 'temporal',
}

export enum RemoteSystem {
  RECURLY = 0,
  GHOSTLOCKER,
  PLAYAUTH,
  VALIDATE_GL,
  CONTENTFUL,
  DATA_API,
  BAMBOO,
}

export enum RemoteStatus {
  UNKNOWN = '0',
  FAILED = '1',
  PASSED = '2',
}

export enum RecurlyPlanState {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ContentfulEntryState {
  ARCHIVED = 'archived',
  PUBLISHED = 'published',
  DRAFT = 'draft',
}

export enum RecurlyCouponState {
  EXPIRED = 'expired',
  REDEEMABLE = 'redeemable',
}

export enum WorkflowAction {
  GENERATE_CSV = 'generateCsv',
  EXPORT_CSV = 'exportCsv',
}

export enum AndroidModulesEnum {
  CAMPAIGN = 0,
  ACQUISITION_OFFER = 1,
  RENEWAL_OFFER = 2,
  APP_COPY = 3,
  STORE_COPY = 4,
  BUNDLE = 5,
  SKU = 6,
  SELECTOR_CONFIG = 7,
  GALLERY = 8,
}

export enum AndroidModuleStatus {
  DRAFT = 'draft',
  LIVE = 'live',
  READY = 'ready',
  PUBLISH_PROGRESS = 'publish in progress',
  COMPLETE = 'complete',
  ENDED = 'ended',
  ARCHIVED = 'archived',
}

export enum AndroidBundleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
}

export enum AndroidModuleValueStatus {
  DFT = 'default',
  SAVED = 'saved',
  PUBLISHED = 'published',
  INCOMPLETE = 'incomplete',
  ARCHIVED = 'archived',
  ENDED = 'ended',
}

export enum RokuModuleStatus {
  DRAFT = 'draft',
  LIVE = 'live',
  READY = 'ready',
  PUBLISH_PROGRESS = 'publish in progress',
  COMPLETE = 'complete',
  ENDED = 'ended',
  ARCHIVED = 'archived',
}

export enum RokuBundleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
}

export enum RokuModuleValueStatus {
  DFT = 'default',
  SAVED = 'saved',
  PUBLISHED = 'published',
  INCOMPLETE = 'incomplete',
  ARCHIVED = 'archived',
  ENDED = 'ended',
}

export enum PlatformEnum {
  WEB = 'web',
  ANDROID = 'android',
  IOS = 'ios',
  ROKU = 'roku',
}

export enum SlackConfigType {
  FILTERS = 'filters',
  EXPIRE = 'expire',
}

export enum AndroidEnv {
  DEV = 'dev',
  STG_QA = 'stg-qa',
  QA = 'qa',
  STG_PROD = 'stg-prod',
  PROD = 'prod',
}
