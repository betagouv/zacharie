try {
  process.loadEnvFile();
} catch {
  // pas de fichier .env : les variables viennent de l'environnement
}

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/zacharie-api-playground';
export const ZACHARIE_API_URL = (process.env.ZACHARIE_API_URL || 'http://localhost:3235').replace(/\/$/, '');
export const ZACHARIE_APP_URL = (process.env.ZACHARIE_APP_URL || 'http://localhost:3234').replace(/\/$/, '');
export const SESSION_SECRET =
  process.env.SESSION_SECRET || (IS_PRODUCTION_BUILD ? '' : 'dev-secret-playground');
export const SECURE_COOKIE = IS_PRODUCTION_BUILD;

// le bac à sable sert en dev et en staging uniquement
if ([ZACHARIE_API_URL, ZACHARIE_APP_URL].some((url) => url.includes('zacharie.beta.gouv.fr'))) {
  throw new Error('Le bac à sable ne doit jamais viser la production de Zacharie');
}
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET est obligatoire hors dev');
}
