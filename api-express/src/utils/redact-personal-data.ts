// Masquage des données personnelles d'un payload avant de le joindre à un évènement Sentry.
//
// Le payload d'une écriture refusée est conservé pour pouvoir rejouer la saisie de l'utilisateur
// (voir `/sync`) : on ne connaît donc pas à l'avance la liste des champs utiles, et une liste
// blanche ferait disparaître tout nouveau champ métier du schéma. On masque donc par motif, en
// couvrant les familles de champs qui portent une identité en clair.
const VALEUR_MASQUEE = '[masqué]';

// Noms, e-mails, téléphones, adresses. `*_name_cache` est du cache d'affichage, jamais nécessaire
// au rattrapage : les identifiants d'entité qui permettent de le recalculer, eux, restent.
const CHAMPS_IDENTITE = /(_name_cache$|email|telephone|adresse)/i;
const CHAMPS_IDENTITE_EXACTS = new Set(['nom', 'nom_de_famille', 'prenom']);

// L'examinateur initial est la personne à contacter pour rejouer une saisie perdue : c'est le seul
// identifiant d'utilisateur qu'on conserve. Tous les autres acteurs de la chaîne sont masqués.
const USER_ID_CONSERVE = 'examinateur_initial_user_id';
const CHAMPS_USER_ID = /user_id$/;

export function redactPersonalData(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    // Un champ vide ne dit rien de personne : le garder tel quel évite de faire croire à une
    // valeur masquée là où le client n'a rien envoyé.
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
