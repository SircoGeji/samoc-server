# SAMOC Server

## Prerequisites

1. Install Node.js (12.18.0+)
   https://nodejs.org/en/download/

2. Install Yarn
   https://classic.yarnpkg.com/en/docs/install#mac-stable

3. Install Typescript Nodemon, ts-node and mysql

```sh
yarn global add typescript nodemon ts-node && brew install mysql
```

- Verify Typescript installation with `tsc -v`

## Local Development

1. Copy `.env.development` and rename to `.env`, then update values in .env accordingly

2. Install Project Dependencies

```sh
yarn install
```

3. Build Typescript

```sh
yarn build
```

4. Start API Server

```sh
yarn start
```

## Clean

```sh
yarn clean
```

## Unit And Integration Tests

```sh
yarn test
```

### Troubleshooting Tests

There are few reasons the tests could fail,

1. api response too slowly and jest timeout globally at 60000ms you can manually override jest global timeout time directly at the end of IT

```
it('should do some testing', async (done) => {}, 100000)
```

2. auth switch with Sequelize problem, most of the time you can ignore this, if the test fail run that test file individually again

3. 504 gateway timeout from clear aws cache, run the test file individually again.

4. ghostlocker is busy, run the test file individually again.

5. or other unknown reason... run the test file individually again.

## Deploy to AWS (need the key/value .pem file)

```sh
yarn deploy:aws-dev
yarn deploy:aws-clndev
yarn deploy:aws-prod
```

## Connecting to AWS servers

From the project root:

```shell script
## Update the permissions of pem files
chmod 400 .ssh/*.pem

## Connect to the remote server via SSH
ssh -i .ssh/aws68-samoc-dev-us-west-2.pem  ec2-user@samoc-dev-server.flex.com

```

## Endpoints

### Server Maintenance

- http://localhost:1337/health
- http://localhost:1337/ping
- http://localhost:1337/db/wipe (dev only - drop all tables)
- http://localhost:1337/db/init (dev only - init with sql from db_init.sql)

### Offer

- POST http://localhost:1337/api/offers/save
  - Save an offer as Draft
  - Sample Payload
  ```
  {
    "offerCode": "samocsinglefixedsave",
    "offerTypeId": 2,
    "offerCodeType": "single",
    "totalUniqueCodes": 4,
    "planCode": "qamonthlynft",
    "offerHeader": "SAMOC-SINGLE-FIXED-SAVE",
    "offerBodyText": "Single Fixed Body",
    "offerBoldedText": "BOLDED-Single Fixed",
    "offerCTA": "Offer CTA",
    "offerAppliedBannerText": "BannerText1",
    "offerBgImageUrl": "https://www.flex.com/sample1.png",
    "legalDisclaimer": "Some Legal Disclaimer",
    "welcomeEmailText": "Welcome to SAMOC",
    "offer": "price",
    "offerPrice": 5.99,
    "offerDurationType": "customize",
    "offerDurationValue": 3,
    "offerDurationUnit": "day",
    "offerBusinessOwner": "Admin",
    "offerVanityUrl": "https://www.flex.com/vanity",
    "publishDateTime": "2020-07-20T01:00:00Z",
    "noEndDate": false,
    "endDateTime": "2020-10-30T13:00:00Z"
  }
  ```
- POST http://localhost:1337/api/offers/create

  - Save and publish an offer

- GET http://localhost:1337/api/offers?brand=flex&region=us&store=web
  - Get all offers
- GET http://localhost:1337/api/offers/_{offercode}_

  - Get an offer by offer code

- PUT http://localhost:1337/api/offers/_{offercode}_

  - Update an offer by offer code

- DELETE http://localhost:1337/api/offers/_{offercode}_

  - Delete an offer by offer code

- GET http://localhost:1337/api/offers/_{offercode}_/validate

  - Validate an offer by offer code

- GET http://localhost:1337/api/offers/_{offercode}_/publish
  - Publish an offer by offer code

### Plan

- POST http://localhost:1337/api/plans/save?brand=flex&region=us&store=web

  - Save a plan as Draft
  - Sample Payload

  ```
  {
    "planCode": "samocmonthlynft",
    "planName": "samoc test plan1",
    "price": 8.99,
    "billingCycle": "month",
    "billingCycleDuration": null,
    "billingCycleUnit": null,
    "trialOffer": "none",
    "trialDuration": null,
    "trialUnit": null
  }
  ```

- POST http://localhost:1337/api/plans/create?brand=flex&region=us&store=web

  - Save and publish a plan

- GET http://localhost:1337/api/plans?brand=flex&region=us&store=web

  - Get all plans

- GET http://localhost:1337/api/plans/_{plancode}_

  - Get a plan by plan code

- PUT http://localhost:1337/api/plans/_{plancode}_

  - Update a plan by plan code

- DELETE http://localhost:1337/api/plans/_{plancode}_

  - Delete a plan by plan code

- GET http://localhost:1337/api/plans/_{plancode}_/publish
  - Publish a plan by plan code

### Login

- POST http://localhost:1337/users/login

  - Login to SAMOC
  - Sample Payload

  ```
  {
    "email": "samoc@flex.com",
    "password": "xxxxxxxx"
  }
  ```

- GET http://localhost:1337/users/logout
  - Logout from samoc

## Test commit for Shanon

Remove after
