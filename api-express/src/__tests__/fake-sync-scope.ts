import type { SyncScope } from '~/utils/sync-scope';

// Périmètre permissif, pour les fichiers de test qui couvrent le mapping des champs et non
// l'autorisation — celle-ci a son propre fichier, permissions-sync-write.test.ts, qui construit un
// vrai périmètre contre un prisma mocké.
export function fakeSyncScope(overrides: Partial<SyncScope> = {}): SyncScope {
  return {
    entityIds: ['entity-etg', 'entity-collecteur', 'entity-svi'],
    prefetch: async () => {},
    canWriteCarcasse: async () => true,
    grant: () => {},
    isFeiOwner: () => true,
    canWriteFei: async () => true,
    ...overrides,
  };
}
