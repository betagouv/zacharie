import dayjs from 'dayjs';
import packageJson from '../package.json';
const version = packageJson.version;

const PORT = process.env.PORT ?? 3000;
const POSTGRESQL_ADDON_URI = process.env.POSTGRESQL_ADDON_URI;
const ENVIRONMENT = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';

const SENTRY_KEY = 'https://169fc757825672212dc0073c4c64bff7@sentry.incubateur.net/175';
const SENTRY_SECRET = process.env.SENTRY_SECRET;

const BREVO_BEARER = process.env.BREVO_BEARER;
const BREVO_API = process.env.BREVO_API;

const buildId = JSON.stringify(`${dayjs().format('DD-MM-YYYY')} vers ${dayjs().format('HH')}:00`);
const VERSION = buildId;

const TIPIMAIL_API_USER = process.env.TIPIMAIL_API_USER;
const TIPIMAIL_API_KEY = process.env.TIPIMAIL_API_KEY;
const TIPIMAIL_EMAIL_TO = 'contact@zacharie.beta.gouv.fr';
const TIPIMAIL_EMAIL_FROM = 'contact@zacharie.beta.gouv.fr';

const SECRET = process.env.VITE_SECRET ?? 'not-so-secret';
const METABASE_SECRET_KEY = process.env.METABASE_SECRET_KEY;

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_DEV_OR_TEST = IS_DEV || IS_TEST;

export {
  PORT,
  ENVIRONMENT,
  SENTRY_KEY,
  SENTRY_SECRET,
  VERSION,
  SECRET,
  TIPIMAIL_API_USER,
  TIPIMAIL_API_KEY,
  TIPIMAIL_EMAIL_TO,
  TIPIMAIL_EMAIL_FROM,
  METABASE_SECRET_KEY,
  BREVO_BEARER,
  BREVO_API,
  IS_DEV_OR_TEST,
  IS_DEV,
  IS_TEST,
};
