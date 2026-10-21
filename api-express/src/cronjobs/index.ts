import 'dotenv/config';
import '~/prisma';
import * as Sentry from '@sentry/node';

import { ENVIRONMENT, MATOMO_TOKEN, SENTRY_KEY, VERSION } from '~/config';
import { initFeisCron } from './feis';
import { initRelanceInscriptionCron } from './relance-inscription';
import { initDataHealthCron } from './data-health';
import { initMatomoStatsCron } from './matomo-stats';
import { capture, scrubSentryBreadcrumb, scrubSentryEvent } from '~/third-parties/sentry';
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
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
}

const isLocalDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

if (!isLocalDevelopment && !isTest) {
  console.log('Start cron');
  Promise.resolve()
    .then(initFeisCron)
    .then(() => console.log('All feis cronjobs are set up'))
    .then(initRelanceInscriptionCron)
    .then(initDataHealthCron)
    .then(() => (MATOMO_TOKEN ? initMatomoStatsCron() : undefined))
    .catch(capture);
  // .then(initMunicipalities) //
  // .then(initRecommandations) //
  // .then(initAggregators) //
  // .then(initNotifications); //
}
