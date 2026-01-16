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
import { capture, getPerformanceContext } from './services/sentry.ts';
import { clearCache } from './services/indexed-db.ts';
import { initMatomo } from './services/matomo.ts';
import 'dayjs/locale/fr';
import dayjs from 'dayjs';
dayjs.locale('fr');
import { ToastContainer } from 'react-toastify';

startReactDsfr({
  // defaultColorScheme: "system",
  defaultColorScheme: 'light',
  Link,
});

registerServiceWorker();

// Initialize Matomo tracking
initMatomo();

//Only in TypeScript projects
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
    maxValueLength: 1000,
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
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.05,
    ignoreErrors: [
      'Network request failed',
      // "Failed to fetch",
      'NetworkError',
      // ???
      'withrealtime/messaging',
      // This error seems to happen only in firefox and to be ignorable.
      // The "fetch" failed because user has navigated.
      // Since other browsers don't have this problem, we don't care about it,
      // it may be a false positive.
      'AbortError: The operation was aborted',
      // Sur safari, on a des erreur de type "TypeError: cancelled" qui seraient liées
      // au bouton "X" (ou refresh) pressé pendant un fetch. Il semblerait que la meilleure
      // approche soit de les ignorer.
      // Cf: https://stackoverflow.com/a/60860369/978690
      'TypeError: cancelled',
      'TypeError: annulé',
    ],
    beforeSend(event) {
      try {
        const { metrics, tags } = getPerformanceContext();

        // Add as context (detailed data)
        event.contexts = {
          ...event.contexts,
          performance: metrics as unknown as Record<string, unknown>,
        };

        // Add as tags (easy filtering in Sentry UI)
        event.tags = {
          ...event.tags,
          ...tags,
        };
      } catch (e) {
        console.error('Failed to add performance context to Sentry event', e);
      }

      return event;
    },
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
          clearCache().then(() => {
            window.location.href = '/app/tableau-de-bord';
          });
          // Reset the state of your app so the error doesn't happen again
        }}
      >
        <App />
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
