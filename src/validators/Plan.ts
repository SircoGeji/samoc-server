export const VALID_PLAN_CODE_REGEXP = /^(?!internal01$)[a-z0-9+_-]{1,50}$/;

export default (method?: string): any[] => {
  // common checks
  // TODO: disable plan validations until editing is enabled
  // checks.push(
  //   body('billingCycleDuration')
  //     .exists({ checkFalsy: true })
  //     .withMessage('Billing Cycle Value is required')
  //     .isInt()
  //     .withMessage('Billing Cycle Value must be an integer')
  //     .bail()
  //     .custom((value: number) => value > 0)
  //     .withMessage('Billing Cycle Value must be a positive number')
  //     .bail()
  //     .toInt(),
  // );
  // checks.push(
  //   body('trialDuration')
  //     .if((value: number) => value || value === 0)
  //     .isInt()
  //     .withMessage('Trial Offer Value must be an integer')
  //     .bail()
  //     .custom((value: number) => value > 0)
  //     .withMessage('Trial Offer Value must be a positive number')
  //     .bail()
  //     .toInt(),
  // );

  // switch (method) {
  //   case 'createNewPlan': {
  //     checks.push(
  //       body('planCode')
  //         .exists({ checkFalsy: true })
  //         .withMessage('Plan Code is required')
  //         .bail()
  //         .isLength({ min: 1, max: 50 })
  //         .withMessage('Plan Code exceeds maximum (50) characters allowed')
  //         .bail()
  //         .matches(VALID_PLAN_CODE_REGEXP)
  //         .withMessage(
  //           'Plan Code contains invalid characters, valid characters are "a-z", "0-9", "+", or "_".',
  //         ),
  //     );
  //     checks.push(
  //       body('price')
  //         .exists({ checkFalsy: true })
  //         .withMessage('Plan price is required')
  //         .bail()
  //         .matches(/^[\d]+(\.[\d]{0,2})?$/)
  //         .withMessage('Plan price is invalid'),
  //     );
  //     // checks.push(
  //     //   body('total_billing_cycles') //discountType
  //     //     .exists({ checkFalsy: true })
  //     //     .withMessage('total_billing_cycles is required'),
  //     // );
  //     break;
  //   }
  // }
  return [];
};
