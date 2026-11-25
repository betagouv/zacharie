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

if (process.env.NODE_ENV === 'production' && !process.env.VITE_SECRET) {
  throw new Error('VITE_SECRET est obligatoire en production : il signe les JWT de session.');
}
const SECRET = process.env.VITE_SECRET || 'not-so-secret-lalalala';
const METABASE_SECRET_KEY = process.env.METABASE_SECRET_KEY;

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_STAGING = process.env.NODE_ENV === 'production' && ENVIRONMENT === 'test';
const IS_REVIEW_APP = IS_STAGING && process.env.REVIEW_APP === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' && ENVIRONMENT === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_DEV_OR_TEST = IS_DEV || IS_TEST;

const API_URL = IS_TEST
  ? 'http://localhost:3291'
  : (process.env.VITE_API_URL ?? 'https://api.zacharie.beta.gouv.fr');
const APP_URL = IS_TEST ? 'http://localhost:3290' : VITE_APP_URL;

const PROCONNECT_ADMIN_DISABLED = IS_DEV && process.env.PROCONNECT_ADMIN_DISABLED === 'true';

const PROCONNECT_MOCK_ENABLED = IS_TEST || (IS_DEV && !process.env.PROCONNECT_ISSUER);
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

const NATIVE_PUSH_DRY_RUN = false;
const TRICHINE_FEATURE_ENABLED = process.env.VITE_FEATURE_TRICHINE === 'true';

const CELLAR_HOST = process.env.CELLAR_ADDON_HOST ?? '';
const CELLAR_KEY_ID = process.env.CELLAR_ADDON_KEY_ID ?? '';
const CELLAR_KEY_SECRET = process.env.CELLAR_ADDON_KEY_SECRET ?? '';
const CELLAR_BUCKET = process.env.CELLAR_ADDON_BUCKET ?? '';

const ALBERT_API_URL = process.env.ALBERT_API_URL ?? 'https://albert.api.etalab.gouv.fr/v1';
const ALBERT_API_KEY = process.env.ALBERT_API_KEY ?? '';
const ALBERT_MODEL = process.env.ALBERT_MODEL ?? 'openai/gpt-oss-120b';
const ALBERT_VISION_MODEL = process.env.ALBERT_VISION_MODEL ?? 'google/gemma-4-31B-it';
const ALBERT_READONLY_DATABASE_URL = process.env.ALBERT_READONLY_DATABASE_URL ?? '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
const GITHUB_REPO = 'betagouv/zacharie';
const SOURCE_COMMIT = process.env.COMMIT_ID ?? 'main';

const MATOMO_URL = process.env.MATOMO_URL ?? 'https://stats.beta.gouv.fr';
const MATOMO_TOKEN = process.env.MATOMO_TOKEN ?? '';
const MATOMO_SITE_ID = process.env.MATOMO_SITE_ID ?? '';

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
  IS_REVIEW_APP,
  IS_PRODUCTION,
  NATIVE_PUSH_DRY_RUN,
  VITE_APP_URL,
  API_URL,
  APP_URL,
  PROCONNECT_ADMIN_DISABLED,
  PROCONNECT_MOCK_ENABLED,
  PROCONNECT_ISSUER,
  PROCONNECT_CLIENT_ID,
  PROCONNECT_CLIENT_SECRET,
  PROCONNECT_REDIRECT_URI,
  TRICHINE_FEATURE_ENABLED,
  CELLAR_HOST,
  CELLAR_KEY_ID,
  CELLAR_KEY_SECRET,
  CELLAR_BUCKET,
  ALBERT_API_URL,
  ALBERT_API_KEY,
  ALBERT_MODEL,
  ALBERT_VISION_MODEL,
  ALBERT_READONLY_DATABASE_URL,
  GITHUB_TOKEN,
  GITHUB_REPO,
  SOURCE_COMMIT,
  MATOMO_URL,
  MATOMO_TOKEN,
  MATOMO_SITE_ID,
};
