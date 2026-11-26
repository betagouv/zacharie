import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startReactDsfr } from '@codegouvfr/react-dsfr/spa';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import { registerServiceWorker } from './sw/register.ts';
import '@af-utils/scrollend-polyfill';
import {
  BrowserRouter,
  Link,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router';
import { ErrorBoundary } from 'react-error-boundary';
import UnexpectedError from './components/UnexpectedError.tsx';
import {
  capture,
  getPerformanceContext,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from './services/sentry.ts';
import { initMatomo } from './services/matomo.ts';
import 'dayjs/locale/fr';
import dayjs from 'dayjs';
dayjs.locale('fr');
import { ToastContainer } from 'react-toastify';
import OfflineSingleTabGate from './components/OfflineSingleTabGate.tsx';
import { startTabsBroadcast } from './utils/tabs-broadcast.ts';
import { startOfflineSingleTab } from './utils/offline-single-tab.ts';

startReactDsfr({
  defaultColorScheme: 'light',
  Link,
});

registerServiceWorker();

startTabsBroadcast();
startOfflineSingleTab();

initMatomo();

declare module '@codegouvfr/react-dsfr/spa' {
  interface RegisterLink {
    Link: typeof Link;
  }
}

if (import.meta.env.VITE_ENV === 'prod' || import.meta.env.VITE_ENV === 'test') {
  console.log('Sentry init', import.meta.env.VITE_ENV);
  Sentry.init({
    dsn: 'https://1d9011c5042e5a03ff25dec68be1be2b@sentry.incubateur.net/199',
    environment: `app-local-first-react-router-${import.meta.env.VITE_ENV}-2`,
    release: __VITE_BUILD_ID__,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    maxValueLength: 10000,
    normalizeDepth: 10,
    tracesSampleRate: 0.05,
    ignoreErrors: [
      'Network request failed',
      'NetworkError',
      'withrealtime/messaging',
      'AbortError: The operation was aborted',
      'TypeError: cancelled',
      'TypeError: annulé',
      /Object Not Found Matching Id:\d+, MethodName:update/,
      'AbortError: The connection was closed',
    ],
    beforeSend(event) {
      try {
        const { metrics, tags } = getPerformanceContext();

        event.contexts = {
          ...event.contexts,
          performance: metrics as unknown as Record<string, unknown>,
        };

        event.tags = {
          ...event.tags,
          ...tags,
        };
      } catch (e) {
        console.error('Failed to add performance context to Sentry event', e);
      }

      return scrubSentryEvent(event);
    },
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
} else {
  console.log('Sentry not init', import.meta.env.VITE_ENV);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary
        FallbackComponent={UnexpectedError}
        onError={(error, componentStack) => {
          capture(error, { extra: { componentStack } });
        }}
        onReset={() => {
          window.history.pushState(null, '', '/app/connexion');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      >
        <OfflineSingleTabGate>
          <App />
        </OfflineSingleTabGate>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
