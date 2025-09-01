import 'dotenv/config';
import '~/prisma';
import * as Sentry from '@sentry/node';

import { ENVIRONMENT, SENTRY_KEY, VERSION } from '~/config';
import { initFeisCron } from './feis';
import { capture } from '~/third-parties/sentry';
const sentryEnabled = !!SENTRY_KEY;

if (sentryEnabled) {
  Sentry.init({
    dsn: SENTRY_KEY,
    environment: `cronjobs-${ENVIRONMENT}`,
    release: VERSION,
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.05,
  });
}

const isLocalDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

if (!isLocalDevelopment && !isTest) {
  console.log('Start cron');
  Promise.resolve()
    .then(initFeisCron)
    .then(() => console.log('All feis cronjobs are set up'))
    .catch(capture);
  // .then(initMunicipalities) //
  // .then(initRecommandations) //
  // .then(initAggregators) //
  // .then(initNotifications); //
}
