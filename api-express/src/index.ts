import { config } from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  config({ path: '.env.test' });
} else {
  config();
}

import '~/prisma';

import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import logger from 'morgan';
import passport from 'passport';
import './middlewares/passport';

import {
  ENVIRONMENT,
  IS_PRODUCTION,
  IS_REVIEW_APP,
  IS_STAGING,
  PORT,
  PROCONNECT_MOCK_ENABLED,
  SENTRY_KEY,
  VERSION,
  VITE_APP_URL,
} from './config.ts';
import { errorHandlers } from './middlewares/errors.ts';
import { migrateLegacySessionCookie } from './middlewares/migrate-legacy-session-cookie.ts';
import { capture, SENTRY_SCRUB_OPTIONS } from './third-parties/sentry.ts';

import userRouter from './controllers/user.ts';
import userEntityRouter from './controllers/user-entity.ts';
import adminRouter from './controllers/admin/index.ts';
import entiteRouter from './controllers/entite.ts';
import feiCarcasseRouter from './controllers/carcasse.ts';
import sviRouter from './controllers/svi.ts';
import certificatsRouter from './controllers/certificats.ts';
import syncRouter from './controllers/sync.ts';
import webhooksRouter from './controllers/webhooks.ts';
import utilsRouter from './controllers/utils.ts';
import statsRouter from './controllers/stats.ts';
import v1Router from './controllers/v1/index.ts';
import apiKeyApprovalRouter from './controllers/api-key-approval.ts';
import quizResultRouter from './controllers/quiz-result.ts';
import trichineRouter from './controllers/trichine.ts';
import laboratoireRouter from './controllers/laboratoire.ts';
import trichineAliasRouter from './controllers/trichine-alias.ts';
import proconnectRouter from './controllers/proconnect.ts';
import mockProConnectRouter from './mock-proconnect.ts';
import { mountE2eRoutes } from './utils/mount-e2e-routes.ts';
import './cronjobs/index.ts';

import packageJson from '../package.json';

const app = express();

app.set('trust proxy', 1);

app.use(compression());

app.use(
  logger(':method :url :status :res[content-length] - :response-time ms - :date[iso]', {
    skip: (req) => req.method === 'OPTIONS',
  })
);

const sentryEnabled = !!SENTRY_KEY;

if (sentryEnabled) {
  console.log('Sentry init', SENTRY_KEY);
  Sentry.init({
    dsn: SENTRY_KEY,
    environment: `api-express-${ENVIRONMENT}-2`,
    maxValueLength: 10000,
    release: VERSION,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],

    tracesSampleRate: 0.01,
    ...SENTRY_SCRUB_OPTIONS,
  });
}

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

if (IS_STAGING) {
  app.use(
    cors({
      credentials: true,
      origin: ['https://zacharie.incubateur.net', ...(IS_REVIEW_APP ? [VITE_APP_URL] : [])],
    })
  );
} else if (IS_PRODUCTION) {
  app.use(
    cors({
      credentials: true,
      origin: ['https://zacharie.beta.gouv.fr', 'http://127.0.0.1:3000'],
    })
  );
} else {
  app.use(
    cors({
      credentials: true,
      origin: ['http://localhost:3234', 'http://localhost:3290', process.env.VITE_APP_URL ?? ''].filter(
        Boolean
      ),
    })
  );
}

app.use((_req, res, next) => {
  res.header('X-API-VERSION', VERSION);
  res.header('Access-Control-Expose-Headers', 'X-API-VERSION');
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));
if (PROCONNECT_MOCK_ENABLED) {
  app.use('/mock-proconnect', mockProConnectRouter);
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://stats.beta.gouv.fr'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://developer.apple.com', 'https://play.google.com'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: [
          "'self'",
          'https://*.ingest.sentry.io',
          'https://sentry.incubateur.net',
          'https://metabase.zacharie.beta.gouv.fr',
          'https://stats.beta.gouv.fr',
        ],
        frameSrc: ['blob:', 'https://metabase.zacharie.beta.gouv.fr', 'https://www.youtube.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});
app.use(cookieParser());
app.use(migrateLegacySessionCookie);

app.get('/healthz', async (req, res) => {
  res.send('Hello World');
});

app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send(
    `Contact: mailto:contact@zacharie.beta.gouv.fr
Preferred-Languages: fr, en
Expires: 2027-12-31T00:00:00.000Z`
  );
});

const now = new Date();
app.get('/', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (ip?.match(/^(172\.233\.|45\.79\.|172\.104\.|50\.116\.|209\.38\.|66\.228\.)/)) {
    console.log(`🔍 Linode request from ${ip}: ${userAgent}`);
  }

  res.send(`Hello World at ${now.toISOString()} version ${packageJson.version}`);
});

app.get('/config.js', async (req, res) => {
  res.send({ VERSION });
});

mountE2eRoutes(app, process.env.NODE_ENV);

app.post('/sentry-check', async (req, res) => {
  capture('sentry-check', { extra: { test: 'test' } });
  res.status(200).send({ ok: true, data: 'Sentry checked!' });
});

app.use('/quiz-result', quizResultRouter);

app.use('/v1', v1Router);

import { authRateLimit, authIpRateLimit, adminRateLimit } from './middlewares/auth-rate-limit.ts';
import { requireTrichineFeature } from './middlewares/trichine-feature.ts';
app.use('/user/login', authIpRateLimit({ skipSuccessfulRequests: true }), authRateLimit);
app.use('/user/signup', authIpRateLimit(), authRateLimit);
app.use('/user/signup-with-invitation-token', authIpRateLimit(), authRateLimit);
app.use('/user/forget-password', authIpRateLimit(), authRateLimit);
app.use('/user/reset-password', authIpRateLimit(), authRateLimit);
app.use('/user/change-password', authRateLimit);
app.use('/admin', adminRateLimit);

app.use('/user/proconnect', passport.initialize(), proconnectRouter);
app.use('/user', passport.initialize(), userRouter);
app.use('/user-entity', passport.initialize(), userEntityRouter);
app.use('/admin', passport.initialize(), adminRouter);
app.use('/entite', passport.initialize(), entiteRouter);
app.use('/carcasse', passport.initialize(), feiCarcasseRouter);
app.use('/svi', passport.initialize(), sviRouter);
app.use('/trichine', requireTrichineFeature, passport.initialize(), trichineRouter);
app.use('/laboratoire', requireTrichineFeature, passport.initialize(), laboratoireRouter);
app.use('/trichine-alias', requireTrichineFeature, passport.initialize(), trichineAliasRouter);
app.use('/certificat', passport.initialize(), certificatsRouter);
app.use('/sync', passport.initialize(), syncRouter);
app.use('/webhooks', passport.initialize(), webhooksRouter);
app.use('/stats', passport.initialize(), statsRouter);
app.use('/api-key-approval', passport.initialize(), apiKeyApprovalRouter);
app.use('/', passport.initialize(), utilsRouter);

app.use(errorHandlers);

app.listen(PORT, () => {
  console.log(`RUN ON PORT ${PORT}`);
});
