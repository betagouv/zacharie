import packageJson from '../package.json';
const version = packageJson.version;

const PORT = process.env.PORT ?? 3000;
const ENVIRONMENT =
  process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';

const SENTRY_KEY =
  'https://169fc757825672212dc0073c4c64bff7@sentry.incubateur.net/175';

const VERSION = version;

const TIPIMAIL_API_USER = process.env.TIPIMAIL_API_USER;
const TIPIMAIL_API_KEY = process.env.TIPIMAIL_API_KEY;
const TIPIMAIL_EMAIL_TO = 'contact@recosante.beta.gouv.fr';
const TIPIMAIL_EMAIL_FROM = 'contact@recosante.fabrique.social.gouv.fr';

const SECRET = process.env.VITE_SECRET ?? 'not-so-secret';

export {
  PORT,
  ENVIRONMENT,
  SENTRY_KEY,
  VERSION,
  SECRET,
  TIPIMAIL_API_USER,
  TIPIMAIL_API_KEY,
  TIPIMAIL_EMAIL_TO,
  TIPIMAIL_EMAIL_FROM,
};
