import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "https://1d9011c5042e5a03ff25dec68be1be2b@sentry.incubateur.net/199",
  tracesSampleRate: 0.01,
  autoInstrumentRemix: true,
  enabled: !import.meta.env.DEV,
});
