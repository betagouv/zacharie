// Masquage des secrets et des données personnelles avant tout envoi à Sentry ou dans les logs.
const VALEUR_MASQUEE = '[masqué]';

// Mots de passe, jetons (session, reset, invitation, access token, push), clés d'API, cookies.
const CLES_SECRETES =
  /password|passwd|token|secret|authorization|cookie|jwt|private[-_]?key|^(x-)?api[-_]?key$|^key$/i;

// Identité en clair : e-mails, téléphones, adresses, noms.
const CLES_IDENTITE = /_name_cache$|email|telephone|ad+ress|^prenom$|^nom$|^nom_de_famille$|nom_prenom/i;

// Valeur d'un paramètre d'URL sensible (ex. `?reset-password-token=...`, `&email=...`).
const PARAMS_URL_SENSIBLES =
  /(^|[?&])([^=&#\s"']*(?:token|password|secret|key|email)[^=&#\s"']*)=([^&#\s"']*)/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /Bearer\s+[\w.~+/=-]+/gi;
const JETON_PUSH_EXPO = /Expo(nent)?PushToken\[[^\]]*\]/g;
const ADRESSE_EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

const PROFONDEUR_MAX = 10;

export function scrubString(value: string): string {
  return value
    .replace(PARAMS_URL_SENSIBLES, `$1$2=${VALEUR_MASQUEE}`)
    .replace(BEARER, `Bearer ${VALEUR_MASQUEE}`)
    .replace(JWT, VALEUR_MASQUEE)
    .replace(JETON_PUSH_EXPO, VALEUR_MASQUEE)
    .replace(ADRESSE_EMAIL, VALEUR_MASQUEE);
}

export function scrubSensitive(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof Error) return value;
  if (depth > PROFONDEUR_MAX || seen.has(value)) return VALEUR_MASQUEE;
  seen.add(value);

  let scrubbed: unknown;
  if (Array.isArray(value)) {
    scrubbed = value.map((item) => scrubSensitive(item, depth + 1, seen));
  } else {
    const scrubbedObject: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== null && item !== undefined && (CLES_SECRETES.test(key) || CLES_IDENTITE.test(key))) {
        scrubbedObject[key] = VALEUR_MASQUEE;
      } else {
        scrubbedObject[key] = scrubSensitive(item, depth + 1, seen);
      }
    }
    scrubbed = scrubbedObject;
  }
  // `seen` ne sert qu'à détecter les cycles : un même objet référencé deux fois reste lisible.
  seen.delete(value);
  return scrubbed;
}
