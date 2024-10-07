import { body } from 'express-validator';

export default (method?: string) => {
  return [
    // username must be an email
    body('email')
      .exists({ checkFalsy: true })
      .withMessage('Email is required')
      .bail()
      .isEmail()
      .withMessage('Email is invalid'),
    // password must not be empty
    body('password').exists().withMessage('Password is required'),
  ];
};
