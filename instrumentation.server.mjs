import * as Sentry from "@sentry/remix";

Sentry.init({
    dsn: "https://169fc757825672212dc0073c4c64bff7@sentry.incubateur.net/175",
    tracesSampleRate: 1,
    autoInstrumentRemix: true
})