import { describe, it, expect, beforeEach, vi } from 'vitest';

type Item = { is_synced: boolean; updated_at: Date; created_at: Date; deleted_at: Date | null };

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    lastUpdateFromServer: 1000,
    feis: {} as Record<string, Item & { numero: string }>,
    carcasses: {} as Record<string, Item & { zacharie_carcasse_id: string; fei_numero: string }>,
    carcassesIntermediaireById: {},
    modifRequestsByCarcasseId: {},
    users: {} as Record<string, Item & { id: string }>,
    entities: {} as Record<string, Item & { id: string; relation: string }>,
    detenteursInitiauxIds: [] as Array<string>,
    feiIdsRenvoiToHide: [] as Array<string>,
  };
  return { state, get: vi.fn() };
});

vi.mock('@app/zustand/store', () => ({
  default: {
    getState: () => mocks.state,
    setState: (update: object | ((s: typeof mocks.state) => object)) => {
      Object.assign(mocks.state, typeof update === 'function' ? update(mocks.state) : update);
    },
  },
}));
vi.mock('@app/zustand/user', () => ({
  default: { getState: () => ({ user: { id: 'user-1', roles: [] } }) },
}));
vi.mock('@app/services/api', () => ({ default: { get: mocks.get } }));
vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));
vi.mock('@app/zustand/idb-sliced-storage', () => ({ isLocalTeardownInProgress: () => false }));

import { loadCarcasses } from './load-carcasses';

const base = (synced = true): Item => ({
  is_synced: synced,
  updated_at: new Date(500),
  created_at: new Date(500),
  deleted_at: null,
});

function serverResponse(fullReload: boolean) {
  return {
    ok: true,
    data: {
      carcasses: [{ ...base(), zacharie_carcasse_id: 'C-SERVEUR', fei_numero: 'FEI-SERVEUR' }],
      feis: [{ ...base(), numero: 'FEI-SERVEUR' }],
      users: [{ ...base(), id: 'U-SERVEUR' }],
      entities: [{ ...base(), id: 'E-SERVEUR', relation: 'NONE' }],
      carcassesIntermediaires: [],
      carcasseModifRequests: [],
      hasMore: false,
      fullReload,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  Object.assign(mocks.state, {
    lastUpdateFromServer: 1000,
    feis: {
      'FEI-SORTIE': { ...base(), numero: 'FEI-SORTIE' },
      'FEI-NON-SYNC': { ...base(false), numero: 'FEI-NON-SYNC' },
    },
    carcasses: {
      'C-SORTIE': { ...base(), zacharie_carcasse_id: 'C-SORTIE', fei_numero: 'FEI-SORTIE' },
    },
    users: {
      'U-SORTI': { ...base(), id: 'U-SORTI' },
      'U-DETENTEUR': { ...base(), id: 'U-DETENTEUR' },
    },
    entities: {
      'E-SORTIE': { ...base(), id: 'E-SORTIE', relation: 'NONE' },
      'E-MA-RELATION': { ...base(), id: 'E-MA-RELATION', relation: 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY' },
    },
    detenteursInitiauxIds: ['U-DETENTEUR'],
  });
});

function mockServer(fullReload: boolean) {
  mocks.get.mockImplementation(({ path }: { path: string }) => {
    if (path === 'now') return Promise.resolve({ ok: true, data: 2000 });
    if (path === '/carcasse/count') return Promise.resolve({ ok: false });
    return Promise.resolve(serverResponse(fullReload));
  });
}

describe('loadCarcasses — rechargement complet', () => {
  it('remplace toutes les données locales synchronisées par le périmètre renvoyé', async () => {
    mockServer(true);
    await loadCarcasses();
    expect(Object.keys(mocks.state.carcasses)).toEqual(['C-SERVEUR']);
    expect(Object.keys(mocks.state.feis).sort()).toEqual(['FEI-NON-SYNC', 'FEI-SERVEUR']);
    expect(Object.keys(mocks.state.users).sort()).toEqual(['U-DETENTEUR', 'U-SERVEUR']);
    expect(Object.keys(mocks.state.entities).sort()).toEqual(['E-MA-RELATION', 'E-SERVEUR']);
    expect(mocks.state.lastUpdateFromServer).toBe(2000);
  });

  it('pull delta : les données locales sont gardées et complétées', async () => {
    mockServer(false);
    await loadCarcasses();
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-SERVEUR', 'C-SORTIE']);
    expect(Object.keys(mocks.state.feis).sort()).toEqual(['FEI-NON-SYNC', 'FEI-SERVEUR', 'FEI-SORTIE']);
    expect(Object.keys(mocks.state.users).sort()).toEqual(['U-DETENTEUR', 'U-SERVEUR', 'U-SORTI']);
    expect(Object.keys(mocks.state.entities).sort()).toEqual(['E-MA-RELATION', 'E-SERVEUR', 'E-SORTIE']);
  });
});
