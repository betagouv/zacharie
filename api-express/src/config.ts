import dayjs from 'dayjs';

const PORT = process.env.PORT ?? 3000;
const ENVIRONMENT = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';

const VITE_APP_URL = process.env.VITE_APP_URL ?? 'https://zacharie.beta.gouv.fr';

const SENTRY_KEY = process.env.SENTRY_KEY ?? '';

const SENTRY_SECRET = process.env.SENTRY_SECRET;

const BREVO_BEARER = process.env.BREVO_BEARER;
const BREVO_API = process.env.BREVO_API;

const buildId = JSON.stringify(`${dayjs().format('DD-MM-YYYY')} vers ${dayjs().format('HH')}:00`);
const VERSION = buildId;

const SECRET = process.env.VITE_SECRET ?? 'not-so-secret-lalalala';
const METABASE_SECRET_KEY = process.env.METABASE_SECRET_KEY;

const IS_DEV = process.env.NODE_ENV === 'development'; // local dev
const IS_STAGING = process.env.NODE_ENV === 'production' && ENVIRONMENT === 'test'; // staging
const IS_PRODUCTION = process.env.NODE_ENV === 'production' && ENVIRONMENT === 'production';
const IS_TEST = process.env.NODE_ENV === 'test'; // when e2e testing
const IS_DEV_OR_TEST = IS_DEV || IS_TEST;

// URL publique de l'API : sert de base au redirect_uri ProConnect.
// En e2e les deux serveurs sont figés sur 3291 (api) et 3290 (app), voir e2e/playwright.config.ts.
const API_URL = IS_TEST
  ? 'http://localhost:3291'
  : (process.env.VITE_API_URL ?? 'https://api.zacharie.beta.gouv.fr');
const APP_URL = IS_TEST ? 'http://localhost:3290' : VITE_APP_URL;

// ProConnect : double authentification exigée pour les admins Zacharie (doc/proconnect-admin.md).
// Sans PROCONNECT_ISSUER en dev/test, l'API embarque un fournisseur OIDC factice (src/mock-proconnect.ts).
const PROCONNECT_MOCK_ENABLED = IS_DEV_OR_TEST && !process.env.PROCONNECT_ISSUER;
const PROCONNECT_ISSUER = PROCONNECT_MOCK_ENABLED
  ? `${API_URL}/mock-proconnect`
  : (process.env.PROCONNECT_ISSUER ?? '');
const PROCONNECT_CLIENT_ID = PROCONNECT_MOCK_ENABLED
  ? 'zacharie-mock'
  : (process.env.PROCONNECT_CLIENT_ID ?? '');
const PROCONNECT_CLIENT_SECRET = PROCONNECT_MOCK_ENABLED
  ? 'zacharie-mock-secret'
  : (process.env.PROCONNECT_CLIENT_SECRET ?? '');
const PROCONNECT_REDIRECT_URI = `${API_URL}/user/proconnect/callback`;

// Interrupteur manuel, temporaire : le temps de vérifier le contenu des notifications, le push natif
// n'envoie rien en production, il se contente de logger le payload (third-parties/expo-push.ts).
// Aucun NotificationLog n'est écrit pendant ce temps, la dédup s'appuyant dessus : un log écrit
// maintenant empêcherait définitivement l'envoi une fois l'interrupteur relevé.
const NATIVE_PUSH_DRY_RUN = true;

export {
  PORT,
  ENVIRONMENT,
  SENTRY_KEY,
  SENTRY_SECRET,
  VERSION,
  SECRET,
  METABASE_SECRET_KEY,
  BREVO_BEARER,
  BREVO_API,
  IS_DEV_OR_TEST,
  IS_DEV,
  IS_TEST,
  IS_STAGING,
  IS_PRODUCTION,
  NATIVE_PUSH_DRY_RUN,
  VITE_APP_URL,
  API_URL,
  APP_URL,
  PROCONNECT_MOCK_ENABLED,
  PROCONNECT_ISSUER,
  PROCONNECT_CLIENT_ID,
  PROCONNECT_CLIENT_SECRET,
  PROCONNECT_REDIRECT_URI,
};
