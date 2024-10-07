import express, { Application, NextFunction, Request, Response } from 'express';
import winston from 'winston';
import * as expressWinston from 'express-winston';
import * as httpContext from 'express-http-context';
import bodyParser from 'body-parser';
import { EXPRESS_PORT } from './util/config';
import { db } from './models';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger';
import { AppError } from './util/errorHandler';
import { handleServerError } from './middleware/errorHandler';
import cors from 'cors';
import Logger from './util/logger';

// routers
import HealthRouter from './routers/health';
import BambooRouter from './routers/bamboo';
import DbRouter from './routers/db';
import OffersRouter from './routers/offers';
import OfferTypesRouter from './routers/offertypes';
import PlansRouter from './routers/plans';
import RolesRoutes from './routers/roles';
import StatusRoutes from './routers/status';
import StatesRoutes from './routers/states';
import StoresRouter from './routers/stores';
import UploadRouter from './routers/upload';
import UserRouter from './routers/users';
import ValidatorRouter from './routers/validator';
import TranslationsRouter from './routers/translations';
import AndroidRouter from './routers/android';
import RokuRouter from './routers/roku';
import compression from 'compression';
import SlackRouter from './routers/slack';
import DPERouter from './routers/dpe';
import { decorateXRequestId } from './middleware/xid';
import { X_REQUEST_ID } from './util/constants';
import { setHttpCtx } from './middleware/httpCtx';
import { fuzzError } from './middleware/fuzzError';
import DezmundRouter from './routers/dezmund';
import TardisRouter from './routers/tardis';
import FiltersRouter from './routers/filters';

const logger = Logger(module);
const API_PREFIX = '/api';

db.sync()
  .then(async () => {
    logger.info(
      `DB connection with '${db.config.host}' has been established successfully.`,
    );
  })
  .catch((err) => {
    logger.error(
      `DB '${db.config.host}' connection failed, ${err.message}`,
      err,
    );
    throw err;
  });

// Create Express server
const app: Application = express();

// Express configuration
app.set('port', EXPRESS_PORT || 1337);

app.use(cors());
app.use(compression());

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(httpContext.middleware);

/**
 * Create an x-request-id (xid) for the request,
 * if not provided as header and add to request.
 * Return this as a header in the response
 */
app.use(decorateXRequestId);
app.use(setHttpCtx);
app.use(fuzzError);

app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.json(),
      winston.format.prettyPrint(),
    ),
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
    ignoreRoute: function (req, res) {
      return false;
    },
    requestWhitelist: ['xId', 'headers.origin', 'headers.referer'],
    dynamicMeta: function (req, res) {
      const xId = res.getHeader(X_REQUEST_ID);
      return {
        xId: xId ? xId : null,
      };
    },
  }),
);

/**
 * Forward to health router before checks for tokens and auth headers
 * These endpoints should be public
 */
app.use('/health', HealthRouter);
app.use('/ping', HealthRouter);

// Db - Remove for prod
app.use('/db', DbRouter);

// Swagger doc
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(`/bamboo`, BambooRouter);

// Core endpoints
app.use(`${API_PREFIX}/offers`, OffersRouter);
app.use(`${API_PREFIX}/offertypes`, OfferTypesRouter);
app.use(`${API_PREFIX}/plans`, PlansRouter);
app.use(`${API_PREFIX}/roles`, RolesRoutes);
app.use(`${API_PREFIX}/status`, StatusRoutes);
app.use(`${API_PREFIX}/states`, StatesRoutes);
app.use(`${API_PREFIX}/stores`, StoresRouter);
app.use(`${API_PREFIX}/uploadImage`, UploadRouter);
app.use(`${API_PREFIX}/validator`, ValidatorRouter);
app.use(`${API_PREFIX}/translations`, TranslationsRouter);
app.use(`${API_PREFIX}/slack`, SlackRouter);
app.use(`${API_PREFIX}/dezmund`, DezmundRouter);
app.use(`${API_PREFIX}/android`, AndroidRouter);
app.use(`${API_PREFIX}/roku`, RokuRouter);
app.use(`${API_PREFIX}/dpe`, DPERouter);
app.use(`${API_PREFIX}/tardis`, TardisRouter);
app.use(`${API_PREFIX}/filters`, FiltersRouter);

app.use('/users', UserRouter);

app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// error handler middleware
app.use(handleServerError);

export default app;
