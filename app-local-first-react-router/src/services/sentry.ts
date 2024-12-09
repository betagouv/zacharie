import * as Sentry from '@sentry/react';

interface Context {
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

type ErrorType = Error | string;

export function capture(err: ErrorType, context: Context | string = {}): void {
  let parsedContext: Context;

  if (import.meta.env.DEV) {
    return console.log('capture', err, context);
  }
  if (typeof context === 'string') {
    parsedContext = JSON.parse(context);
  } else {
    parsedContext = JSON.parse(JSON.stringify(context));
  }

  if (parsedContext.extra && typeof parsedContext.extra === 'object') {
    try {
      const newExtra: Record<string, string> = {};
      for (const [extraKey, extraValue] of Object.entries(parsedContext.extra)) {
        if (typeof extraValue === 'string') {
          newExtra[extraKey] = extraValue;
        } else {
          const extraValueObj = extraValue as Record<string, unknown>;
          if (extraValueObj && 'password' in extraValueObj) {
            extraValueObj.password = '******';
          }
          newExtra[extraKey] = JSON.stringify(extraValueObj);
        }
      }
      parsedContext.extra = newExtra;
    } catch (e) {
      Sentry.captureMessage(String(e), parsedContext);
    }
  }

  if (typeof err === 'string') {
    Sentry.captureMessage(err, parsedContext);
  } else {
    Sentry.captureException(err, parsedContext);
  }
}
