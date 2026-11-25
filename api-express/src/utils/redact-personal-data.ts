const VALEUR_MASQUEE = '[masqué]';

const CHAMPS_IDENTITE = /(_name_cache$|email|telephone|adresse)/i;
const CHAMPS_IDENTITE_EXACTS = new Set(['nom', 'nom_de_famille', 'prenom']);

const USER_ID_CONSERVE = 'examinateur_initial_user_id';
const CHAMPS_USER_ID = /user_id$/;

export function redactPersonalData(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') {
      redacted[key] = value;
      continue;
    }
    if (CHAMPS_IDENTITE.test(key) || CHAMPS_IDENTITE_EXACTS.has(key)) {
      redacted[key] = VALEUR_MASQUEE;
      continue;
    }
    if (CHAMPS_USER_ID.test(key) && key !== USER_ID_CONSERVE) {
      redacted[key] = VALEUR_MASQUEE;
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}
