import 'dotenv/config';
import '~/prisma';

import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import logger from 'morgan';
import passport from './middlewares/passport';

import { ENVIRONMENT, PORT, SENTRY_KEY, VERSION } from './config.ts';
import { sendError } from './middlewares/errors.ts';
import { capture } from './third-parties/sentry.ts';

import userRouter from './controllers/user.ts';
import adminRouter from './controllers/admin.ts';
import entiteRouter from './controllers/entite.ts';
import feiRouter from './controllers/fei.ts';
import feiCarcasseRouter from './controllers/carcasse.ts';
import feiCarcasseIntermediaireRouter from './controllers/fei-carcasse-intermediaire.ts';
import feiIntermediaireRouter from './controllers/fei-intermediaire.ts';
import searchRouter from './controllers/search.ts';

import packageJson from '../package.json';

// Put together a schema
const app = express();

app.use(logger('dev'));

const sentryEnabled = ENVIRONMENT !== 'development' && ENVIRONMENT !== 'test';

if (sentryEnabled) {
  Sentry.init({
    dsn: SENTRY_KEY,
    environment: `api-express-${ENVIRONMENT}`,
    release: VERSION,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.01,
  });
}

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

if (process.env.NODE_ENV === 'production') {
  // regex .zacharie.beta.gouv.fr
  app.use(cors({ credentials: true, origin: [/\.zacharie\.beta\.gouv\.fr$/] }));
} else {
  app.use(
    cors({
      credentials: true,
      origin: ['http://localhost:3234'],
    }),
  );
}

// kube probe
app.get('/healthz', async (req, res) => {
  res.send('Hello World');
});

// hello world
const now = new Date();
app.get('/', async (req, res) => {
  res.send(
    `Hello World at ${now.toISOString()} version ${packageJson.version}`,
  );
});

app.get('/config.js', async (req, res) => {
  res.send({ VERSION });
});

// Add header with API version to compare with client.
app.use((_req, res, next) => {
  res.header('X-API-VERSION', VERSION);
  // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers
  res.header('Access-Control-Expose-Headers', 'X-API-VERSION');
  next();
});

// Pre middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));
app.use(helmet());
app.use(cookieParser());

// sentry context/user
// app.use(async (req, res, next) => {
//   const { appversion, appbuild, appdevice, currentroute } = req.headers || {};
//   if (appversion) Sentry.setTag('appversion', appversion as string);
//   if (appbuild) Sentry.setTag('appbuild', appbuild as string);
//   if (appdevice) Sentry.setTag('appdevice', appdevice as string);
//   if (currentroute) Sentry.setTag('currentroute', currentroute as string);
//   next();
// });

app.post('/sentry-check', async (req, res) => {
  capture('sentry-check', { extra: { test: 'test' } });
  res.status(200).send({ ok: true, data: 'Sentry checked!' });
});

// check version before checking other controllers
passport(app);

// Routes
app.use('/user', userRouter);
app.use('/admin', adminRouter);
app.use('/entite', entiteRouter);
app.use('/fei', feiRouter);
app.use('/fei-carcasse', feiCarcasseRouter);
app.use('/fei-carcasse-intermediaire', feiCarcasseIntermediaireRouter);
app.use('/fei-intermediaire', feiIntermediaireRouter);
app.use('/search', searchRouter);

app.use(Sentry.Handlers.errorHandler());
app.use(sendError);

// Start the server
app.listen(PORT, () => {
  console.log(`RUN ON PORT ${PORT}`);
});
