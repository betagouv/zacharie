import * as Sentry from '@sentry/node';
import type { Breadcrumb, Event } from '@sentry/node';
import { SENTRY_KEY } from '../config.js';
import { scrubSensitive, scrubString } from '~/utils/scrub-sensitive';

const sentryEnabled = !!SENTRY_KEY;

// En-têtes utiles au debug. Tous les autres (Cookie, Authorization, clé d'API, Referer...) sont écartés.
const SAFE_HEADERS = [
  'user-agent',
  'appversion',
  'appbuild',
  'appdevice',
  'platform',
  'currentroute',
  'x-api-version',
  'content-type',
  'content-length',
  'host',
];

export function pickSafeHeaders(headers?: Record<string, unknown>) {
  if (!headers) return undefined;
  const safeHeaders: Record<string, string> = {};
  for (const name of SAFE_HEADERS) {
    const value = headers[name];
    if (typeof value === 'string') safeHeaders[name] = value;
  }
  return safeHeaders;
}

// On ne garde que l'identifiant de l'utilisateur : ni e-mail, ni téléphone, ni adresse, ni jetons push.
function onlyUserId(user: unknown) {
  if (!user || typeof user !== 'object' || !('id' in user)) return undefined;
  return { id: String(user.id) };
}

// Branché en `beforeSend` : couvre aussi les données de requête ajoutées automatiquement par Sentry.
export function scrubSentryEvent(event: Event): Event {
  if (event.message) event.message = scrubString(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
  }
  if (event.request) {
    const { cookies: _cookies, headers, data, query_string, url, ...request } = event.request;
    event.request = {
      ...request,
      url: url ? scrubString(url) : url,
      query_string: scrubSensitive(query_string) as typeof query_string,
      headers: pickSafeHeaders(headers),
      data: scrubSensitive(data),
    };
  }
  if (event.extra) event.extra = scrubSensitive(event.extra) as Event['extra'];
  if (event.contexts) event.contexts = scrubSensitive(event.contexts) as Event['contexts'];
  if (event.user) event.user = onlyUserId(event.user);
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubSentryBreadcrumb);
  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubString(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data ? (scrubSensitive(breadcrumb.data) as Breadcrumb['data']) : breadcrumb.data,
  };
}

function capture(
  error: string | Error,
  context?: {
    extra?: any;
    [key: string]: unknown;
  }
) {
  if (typeof context === 'string') {
    context = JSON.parse(context);
  }
  if (context) {
    const { user, ...rest } = context;
    context = scrubSensitive(rest) as typeof context;
    if (user) context.user = onlyUserId(user);
  }

  if (!sentryEnabled) {
    console.log('capture', error, JSON.stringify(context, null, 2));
    return;
  }

  if (!!context && !!context.extra && typeof context.extra !== 'string') {
    try {
      const newExtra: Record<string, string> = {};
      for (const [extraKey, extraValue] of Object.entries(context.extra)) {
        newExtra[extraKey] = typeof extraValue === 'string' ? extraValue : JSON.stringify(extraValue);
      }
      context.extra = newExtra;
    } catch (error) {
      // TODO: Check this error type
      const customError = error as string;
      Sentry.captureMessage(customError, context);
    }
  }

  console.log('capture going to Sentry', error, context);
  if (typeof error === 'string') {
    Sentry.captureMessage(error, context);
  } else {
    Sentry.captureException(error, context);
  }
}

export { capture };
