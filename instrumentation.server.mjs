import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "https://169fc757825672212dc0073c4c64bff7@sentry.incubateur.net/175",
  tracesSampleRate: 0.01,
  autoInstrumentRemix: true,
  enabled: process.env.NODE_ENV === "production",
});
