import { describe, test, expect, vi } from 'vitest';

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  getMany: vi.fn(async () => []),
  setMany: vi.fn(async () => undefined),
  keys: vi.fn(async () => []),
}));

const { migratePersistedState } = await import('./store');

describe('migratePersistedState', () => {
  test('garde uniquement les éléments non synchronisés et remet le reste à zéro', () => {
    const migrated = migratePersistedState({
      dataIsSynced: false,
      feis: {
        'ZACH-1': { numero: 'ZACH-1', is_synced: false },
        'ZACH-2': { numero: 'ZACH-2', is_synced: true },
      },
      carcasses: {
        c1: { zacharie_carcasse_id: 'c1', is_synced: true },
        c2: { zacharie_carcasse_id: 'c2', is_synced: false },
      },
      carcassesRegistry: [{ zacharie_carcasse_id: 'c1', is_synced: true }],
      carcassesIntermediaireById: {
        ci1: { intermediaire_id: 'i1', is_synced: false },
        ci2: { intermediaire_id: 'i2', is_synced: true },
      },
      modifRequestsByCarcasseId: {
        c1: [
          { id: 'r1', is_synced: true },
          { id: 'r2', is_synced: false },
        ],
        c3: [{ id: 'r3', is_synced: true }],
      },
      logs: [
        { id: 'l1', is_synced: true },
        { id: 'l2', is_synced: false },
      ],
      users: { u1: { id: 'u1' } },
      entities: { e1: { id: 'e1' } },
      detenteursInitiauxIds: ['u1'],
      apiKeyApprovals: [{ id: 'a1' }],
      federation: { id: 'f1' },
      feiIdsRenvoiToHide: ['ZACH-3'],
      lastUpdateFromServer: 1700000000000,
    });

    expect(Object.keys(migrated.feis!)).toEqual(['ZACH-1']);
    expect(Object.keys(migrated.carcasses!)).toEqual(['c2']);
    expect(migrated.carcassesRegistry!.map((c) => c.zacharie_carcasse_id)).toEqual(['c2']);
    expect(Object.keys(migrated.carcassesIntermediaireById!)).toEqual(['ci1']);
    expect(migrated.modifRequestsByCarcasseId).toEqual({ c1: [{ id: 'r2', is_synced: false }] });
    expect(migrated.logs).toEqual([{ id: 'l2', is_synced: false }]);
    expect(migrated.dataIsSynced).toBe(false);
    expect(migrated.lastUpdateFromServer).toBe(0);
    expect(migrated.users).toEqual({});
    expect(migrated.entities).toEqual({});
    expect(migrated.detenteursInitiauxIds).toEqual([]);
    expect(migrated.apiKeyApprovals).toEqual([]);
    expect(migrated.federation).toBeNull();
    expect(migrated.feiIdsRenvoiToHide).toEqual([]);
  });

  test('sans élément non synchronisé, repart de l’état initial', () => {
    const migrated = migratePersistedState({
      dataIsSynced: true,
      feis: { 'ZACH-1': { numero: 'ZACH-1', is_synced: true } },
      logs: [{ id: 'l1', is_synced: true }],
      lastUpdateFromServer: 1700000000000,
    });

    expect(migrated.feis).toEqual({});
    expect(migrated.carcasses).toEqual({});
    expect(migrated.carcassesIntermediaireById).toEqual({});
    expect(migrated.modifRequestsByCarcasseId).toEqual({});
    expect(migrated.logs).toEqual([]);
    expect(migrated.dataIsSynced).toBe(true);
    expect(migrated.lastUpdateFromServer).toBe(0);
  });

  test('accepte un état stocké vide', () => {
    const migrated = migratePersistedState(undefined);
    expect(migrated.feis).toEqual({});
    expect(migrated.logs).toEqual([]);
    expect(migrated.lastUpdateFromServer).toBe(0);
  });
});
