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

// Interrupteur manuel, temporaire : le temps de vérifier le contenu des notifications, le push natif
// n'envoie rien en production, il se contente de logger le payload (third-parties/expo-push.ts).
// Aucun NotificationLog n'est écrit pendant ce temps, la dédup s'appuyant dessus : un log écrit
// maintenant empêcherait définitivement l'envoi une fois l'interrupteur relevé.
const NATIVE_PUSH_DRY_RUN = true;
// Recherche de trichine (cf doc/trichine.md). Même variable que le flag du frontend :
// tant qu'elle n'est pas posée, les garde-fous sangliers restent inactifs.
const TRICHINE_FEATURE_ENABLED = process.env.VITE_FEATURE_TRICHINE === 'true';

// Adresse de dépôt des rapports COFRAC par les laboratoires (imprimée sur la FTP).
// Non posée = la consigne n'apparaît pas sur le document.
const TRICHINE_RESULTATS_EMAIL = process.env.TRICHINE_RESULTATS_EMAIL ?? '';

// Object storage Cellar (Clever Cloud, compatible S3) — cf doc/trichine.md §12.2.
// Les trois premières variables sont posées par l'add-on, le bucket est choisi par nous.
// Non configuré (dev / test) : les documents sont régénérés à la volée, rien n'est stocké.
const CELLAR_HOST = process.env.CELLAR_ADDON_HOST ?? '';
const CELLAR_KEY_ID = process.env.CELLAR_ADDON_KEY_ID ?? '';
const CELLAR_KEY_SECRET = process.env.CELLAR_ADDON_KEY_SECRET ?? '';
const CELLAR_BUCKET = process.env.CELLAR_ADDON_BUCKET ?? '';

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
  TRICHINE_FEATURE_ENABLED,
  TRICHINE_RESULTATS_EMAIL,
  CELLAR_HOST,
  CELLAR_KEY_ID,
  CELLAR_KEY_SECRET,
  CELLAR_BUCKET,
};
