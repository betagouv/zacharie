import type { User } from '@prisma/client';

// Verrou optimiste des fiches, carcasses et lignes d'intermédiaire. Le client renvoie tel quel le
// `version` reçu du serveur, sans jamais l'incrémenter (sinon n modifications hors ligne feraient
// passer sa copie devant l'écriture plus récente d'un autre utilisateur). Le serveur incrémente à
// chaque écriture.
//
// Une version inférieure à celle de la base n'est périmée que si l'écriture plus récente vient d'un
// autre utilisateur : `syncData` annule côté client une requête en cours quand une nouvelle part,
// mais le serveur, lui, la traite. La requête suivante du même appareil arrive donc avec une
// version déjà dépassée par sa propre écriture précédente.
// Risque connu : un même utilisateur sur deux appareils peut écraser sa propre écriture plus récente.
export function isStaleWrite(
  existing: { version: number; version_user_id: string | null },
  sentVersion: unknown,
  user: User
): boolean {
  // Sans version envoyée, on prend la version initiale.
  const version = typeof sentVersion === 'number' ? sentVersion : 0;
  if (version < existing.version) return existing.version_user_id !== user.id;
  return false;
}

// À ajouter à toute écriture d'une fiche, carcasse ou ligne d'intermédiaire. `userId` est celui
// qui déclenche l'écriture (null pour un cron) : ses propres requêtes suivantes ne seront pas périmées.
export function nextVersion(userId: string | null) {
  return { version: { increment: 1 }, version_user_id: userId };
}
