import type { SyncRejection } from '~/src/types/responses';

// Items que le serveur a définitivement refusé d'écrire (autorisation), en clés `kind:id`. Sans ça
// ils restent `is_synced = false` — le serveur n'ayant pas touché sa ligne, elle ne revient jamais
// dans le delta de loadCarcasses qui ferait basculer le flag — et repartent dans chaque payload de
// synchro. La portée est la session : `abortSyncData` vide le Set, donc on retente au prochain
// chargement comme à la connexion suivante. L'équipe est prévenue par le Sentry émis côté serveur.
const rejectedBySync = new Set<string>();

export function addSyncRejection(kind: SyncRejection['kind'], id: string) {
  rejectedBySync.add(`${kind}:${id}`);
}

export function isRejectedBySync(kind: SyncRejection['kind'], id: string) {
  return rejectedBySync.has(`${kind}:${id}`);
}

export function clearSyncRejections() {
  rejectedBySync.clear();
}
