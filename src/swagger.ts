const swaggerDocument = {
  openapi: '3.0.1',
  info: {
    title: 'SAMOC-API',
    description: 'SAMOC-API',
    version: '0.0.4',
  },
  servers: [
    {
      url: 'http://samoc-server.flex.com',
    },
  ],
  tags: [
    {
      name: 'Plans',
      description: 'Anything to do with Plans',
    },
    {
      name: 'Offers',
      description: 'Anything to do with Offers',
    },
    {
      name: 'Stores',
      description: 'Anything to do with Stores',
    },
    {
      name: 'Users',
      description: 'Anything to do withi Users',
    },
    {
      name: 'Status',
      description: 'Anything to do with Status',
    },
    {
      name: 'Android',
      description: 'Anything to do with Android',
    },
  ],
  paths: {
    '/api/plans': {
      get: {
        tags: ['Plans'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'store',
            in: 'query',
            required: false,
            style: 'form',
            explode: true,
            schema: {
              type: 'string',
            },
            example: 'flex-web-us',
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/plans/save': {
      post: {
        tags: ['Plans'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'store',
            in: 'query',
            required: false,
            style: 'form',
            explode: true,
            schema: {
              type: 'string',
            },
            example: 'flex-web-us',
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PlanRequestPayload',
              },
              examples: {
                '0': {
                  value:
                    '{\n  "billingCycleUnit": "months",\n  "trialDuration": 9,\n  "trialUnit": "days",\n  "price": 85.76,\n  "planCode": "nelsontest_tgtegoedkc",\n  "billingCycleDuration": 1\n}',
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/plans/{planCode}': {
      delete: {
        tags: ['Plans'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'planCode',
            in: 'path',
            description: 'ID of plan that needs to be deleted',
            required: true,
            style: 'simple',
            explode: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers': {
      get: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'store',
            in: 'query',
            required: false,
            style: 'form',
            explode: true,
            schema: {
              type: 'string',
            },
            example: 'flex-web-us',
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers/{offerCode}': {
      get: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'store',
            in: 'query',
            required: false,
            style: 'form',
            explode: true,
            schema: {
              type: 'string',
            },
            example: 'flex-web-us',
          },
          {
            name: 'offerCode',
            in: 'path',
            description: 'ID of offer that needs to be fetched',
            required: true,
            style: 'simple',
            explode: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      delete: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'offerCode',
            in: 'path',
            description: 'ID of offer that needs to be deleted',
            required: true,
            style: 'simple',
            explode: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers/save': {
      post: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OfferRequestPayload',
              },
              examples: {
                '0': {
                  value:
                    '{\n  "publishDateTime": "2020-07-15T00:00:00Z",\n  "offerBusinessOwner": "Nicholas Holmes",\n  "offerBodyText": "Ni okena rin gilofcad rednalwud owiata laz ziz ar neh kim iharap hi osfosab nuguimu jur.",\n  "discountType": "fixed",\n  "offerAppliedBannerText": "Lunon opafihvik epvim pahkirje caidu.",\n  "discountAmount": 4.35,\n  "discountDurationValue": 1,\n  "endDateTime": "2020-08-20T23:59:59Z",\n  "totalRedemptions": 0,\n  "offerHeader": "Zajof fu ilcik mo haj.",\n  "legalDisclaimer": "Kecza waon tog leora bofafur ra pofovezos hat gasbi elotulut nuvzepla ujep conij cefuj lu bilcozo.",\n  "offerTypeId": 2,\n  "offerBgImageUrl": "https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max",\n  "discountDurationUnit": "months",\n  "planCode": "6months",\n  "offerCTA": "Wugazkul vu beg.",\n  "offerCodeType": "single_code",\n  "offerBoldedText": "Lat ledgewe ifakki icupu ami do obohtig bi nodjir zacew wigker sidmabo af hazne.",\n  "offerCode": "nelsontest_xtovkiba",\n  "welcomeEmailText": "Sounoasi cif tejnim pihroj li.",\n  "offerVanityUrl": "/vanity-url/goes-here"\n}',
                },
                '1': {
                  value:
                    '{\n  "publishDateTime": "2020-07-15T00:00:00Z",\n  "offerBusinessOwner": "Harriet Chambers",\n  "offerBodyText": "Nawgo ri hawad fehsekbe motnehci ki ek zedneb epajeno vuavu odpovah biwjojzak.",\n  "discountType": "fixed",\n  "offerAppliedBannerText": "Sizelohu wavetwe us fac nuvwem.",\n  "discountAmount": 2.09,\n  "discountDurationValue": 1,\n  "endDateTime": "2020-08-20T23:59:59Z",\n  "totalRedemptions": 0,\n  "offerHeader": "Umogonpu epeoc pin laic ra.",\n  "legalDisclaimer": "Ruwnob ededo zuj ozofe tovweror pe zad ror avdutu ficrikav buew hitrubwi eda na agi.",\n  "offerTypeId": 2,\n  "offerBgImageUrl": "https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max",\n  "discountDurationUnit": "months",\n  "planCode": "6months",\n  "offerCTA": "Ro vevrozu sa.",\n  "offerCodeType": "single_code",\n  "offerBoldedText": "Ufa dola gommu moh wih seir ar capafu asi wu loki si banusciz nessejih kal.",\n  "offerCode": "nelsontest_xxpriaav",\n  "welcomeEmailText": "Gijdoc nen pagenoj maghopoko mizpubo.",\n  "offerVanityUrl": "/vanity-url/goes-here"\n}',
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
          '404': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers/create': {
      post: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/OfferRequestPayload',
              },
              examples: {
                '0': {
                  value:
                    '{\n  "publishDateTime": "2020-07-15T12:00:00Z",\n  "offerBusinessOwner": "Marc Marsh",\n  "offerBodyText": "Ru nal owoonanuc uzufe pe hi jozos vorof kiuvjob ergatmi towigwi cut uhwoh lebzeg.",\n  "discountType": "fixed",\n  "offerAppliedBannerText": "Wojvojacu narohiud cif soz jaf.",\n  "discountAmount": 1.52,\n  "discountDurationValue": 3,\n  "endDateTime": "2020-08-20T23:59:59Z",\n  "totalRedemptions": 0,\n  "offerHeader": "Fob dewew jep poketni muzzukmi.",\n  "legalDisclaimer": "Tiv jem ivlapen var buninif cotenoc vegeb ducri irewaco dojmat sokros mu op cirun merhero cefadas.",\n  "offerTypeId": 2,\n  "offerBgImageUrl": "https://flex.imgix.net/Buyflex/special-offers/signup-addons/offer-background.jpg?auto=compress,format&w=2560&fit=max",\n  "discountDurationUnit": "months",\n  "planCode": "6months",\n  "offerCTA": "Cadu cugatfo koso.",\n  "offerCodeType": "single_code",\n  "offerBoldedText": "Edbaj ipoesibi gu ge kuwu re pomgehnim gamuvul vu to pumic narles udipefo solape el dengu.",\n  "offerCode": "nelsontest_uqscrmfq",\n  "welcomeEmailText": "Guwlej ni hutze bicob oztotiz.",\n  "offerVanityUrl": "/vanity-url/goes-here"\n}',
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers/{offerCode}/exportUniqueCouponCodes': {
      get: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'offerCode',
            in: 'path',
            description: 'ID of offer that needs to be fetched',
            required: true,
            style: 'simple',
            explode: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'text/csv': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/offers/{offerCode}/publish': {
      get: {
        tags: ['Offers'],
        description: 'Auto generated using Swagger Inspector',
        parameters: [
          {
            name: 'offerCode',
            in: 'path',
            description: 'ID of offer that needs to be fetched',
            required: true,
            style: 'simple',
            explode: false,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/stores': {
      get: {
        tags: ['Stores'],
        description: 'Auto generated using Swagger Inspector',
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/api/status': {
      get: {
        tags: ['Status'],
        description: 'Auto generated using Swagger Inspector',
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/users/login': {
      post: {
        tags: ['Users'],
        description: 'Auto generated using Swagger Inspector',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UserLoginPayload',
              },
              examples: {
                '0': {
                  value:
                    '{\n  "email": "samoc@flex.com",\n  "password": "password"\n}',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    '/users/logout': {
      get: {
        tags: ['Users'],
        description: 'Auto generated using Swagger Inspector',
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          },
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        },
      ],
    },
    'api/android/sku': {
      get: {
        tags: ['Android'],
        description: 'Auto generated using Swagger Inspector',
        responses: {
          '200': {
            description: 'Auto generated using Swagger Inspector',
            content: {
              'application/json; charset=utf-8': {
                schema: {
                  type: 'string',
                },
                examples: {},
              },
            },
          },
        },
        servers: [
          {
            url: 'http://samoc-server.flex.com',
          }
        ],
      },
      servers: [
        {
          url: 'http://samoc-server.flex.com',
        }
      ],
    },
  },
  components: {
    schemas: {
      PlanRequestPayload: {
        type: 'object',
        properties: {
          billingCycleUnit: {
            type: 'string',
          },
          trialDuration: {
            type: 'integer',
          },
          price: {
            type: 'number',
          },
          trialUnit: {
            type: 'string',
          },
          planCode: {
            type: 'string',
          },
          billingCycleDuration: {
            type: 'integer',
          },
        },
      },
      OfferRequestPayload: {
        type: 'object',
        properties: {
          publishTime: {
            type: 'string',
          },
          offerBoldedText: {
            type: 'string',
          },
          offerCTA: {
            type: 'string',
          },
          endDateTime: {
            type: 'string',
          },
          publishDateTime: {
            type: 'string',
          },
          discountAmount: {
            type: 'number',
          },
          offerBodyText: {
            type: 'string',
          },
          offerCodeType: {
            type: 'string',
          },
          offerBgImageUrl: {
            type: 'string',
          },
          claimOfferTerms: {
            type: 'string',
          },
          offerAppliedBannerText: {
            type: 'string',
          },
          discountDurationUnit: {
            type: 'string',
          },
          offerHeader: {
            type: 'string',
          },
          planCode: {
            type: 'string',
          },
          offerVanityUrl: {
            type: 'string',
          },
          offerTypeId: {
            type: 'integer',
          },
          offerCode: {
            type: 'string',
          },
          welcomeEmailText: {
            type: 'string',
          },
          offerBusinessOwner: {
            type: 'string',
          },
          discountType: {
            type: 'string',
          },
          endTime: {
            type: 'string',
          },
          discountDurationValue: {
            type: 'integer',
          },
          totalRedemptions: {
            type: 'integer',
          },
          legalDisclaimer: {
            type: 'string',
          },
        },
      },
      UserLoginPayload: {
        type: 'object',
        properties: {
          password: {
            type: 'string',
          },
          email: {
            type: 'string',
          },
        },
      },
    },
  },
};

export default swaggerDocument;
