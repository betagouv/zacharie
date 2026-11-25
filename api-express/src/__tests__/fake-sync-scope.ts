import type { SyncScope } from '~/utils/sync-scope';

export function fakeSyncScope(overrides: Partial<SyncScope> = {}): SyncScope {
  return {
    entityIds: ['entity-etg', 'entity-collecteur', 'entity-svi'],
    carcasseAccessWhere: {},
    prefetch: async () => {},
    canWriteCarcasse: async () => true,
    grant: () => {},
    outOfScope: async () => [],
    isFeiOwner: () => true,
    isPremierDetenteur: () => true,
    canWriteFei: async () => true,
    ...overrides,
  };
}
