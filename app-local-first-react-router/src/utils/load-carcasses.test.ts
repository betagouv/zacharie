import { describe, it, expect, beforeEach, vi } from 'vitest';

type Item = { is_synced: boolean; updated_at: Date; created_at: Date; deleted_at: Date | null };

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    lastUpdateFromServer: 1000,
    feis: {} as Record<string, Item & { numero: string }>,
    carcasses: {} as Record<
      string,
      Item & {
        zacharie_carcasse_id: string;
        fei_numero: string;
        intermediaire_carcasse_refus_intermediaire_id?: string;
      }
    >,
    carcassesIntermediaireById: {} as Record<
      string,
      Item & { fei_numero: string; zacharie_carcasse_id: string; intermediaire_id: string }
    >,
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
      'FEI-SANS-CARCASSE': { ...base(), numero: 'FEI-SANS-CARCASSE' },
    },
    carcasses: {
      'C-SORTIE': { ...base(), zacharie_carcasse_id: 'C-SORTIE', fei_numero: 'FEI-SORTIE' },
      // refusée en amont, chargée par /carcasse/refusees/:fei_numero : hors périmètre delta
      'C-REFUSEE': {
        ...base(),
        zacharie_carcasse_id: 'C-REFUSEE',
        fei_numero: 'FEI-SERVEUR',
        intermediaire_carcasse_refus_intermediaire_id: 'INTER-1',
      },
    },
    carcassesIntermediaireById: {
      'FEI-SERVEUR_C-REFUSEE_INTER-1': {
        ...base(),
        fei_numero: 'FEI-SERVEUR',
        zacharie_carcasse_id: 'C-REFUSEE',
        intermediaire_id: 'INTER-1',
      },
      'FEI-SORTIE_C-SORTIE_INTER-2': {
        ...base(),
        fei_numero: 'FEI-SORTIE',
        zacharie_carcasse_id: 'C-SORTIE',
        intermediaire_id: 'INTER-2',
      },
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
  it('remplace les fiches et carcasses synchronisées par le périmètre renvoyé', async () => {
    mockServer(true);
    await loadCarcasses();
    // la carcasse refusée d'une fiche encore dans le périmètre reste, avec son intermédiaire
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-REFUSEE', 'C-SERVEUR']);
    expect(
      Object.values(mocks.state.carcassesIntermediaireById).map((ci) => ci.zacharie_carcasse_id)
    ).toEqual(['C-REFUSEE']);
    // une fiche sans carcasse n'est jamais renvoyée par GET /carcasse : elle reste
    expect(Object.keys(mocks.state.feis).sort()).toEqual([
      'FEI-NON-SYNC',
      'FEI-SANS-CARCASSE',
      'FEI-SERVEUR',
    ]);
    // utilisateurs et entités : données de référence (noms), toujours mergées
    expect(Object.keys(mocks.state.users).sort()).toEqual(['U-DETENTEUR', 'U-SERVEUR', 'U-SORTI']);
    expect(Object.keys(mocks.state.entities).sort()).toEqual(['E-MA-RELATION', 'E-SERVEUR', 'E-SORTIE']);
    expect(mocks.state.lastUpdateFromServer).toBe(2000);
  });

  it('pull delta : les données locales sont gardées et complétées', async () => {
    mockServer(false);
    await loadCarcasses();
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-REFUSEE', 'C-SERVEUR', 'C-SORTIE']);
    expect(Object.keys(mocks.state.feis).sort()).toEqual([
      'FEI-NON-SYNC',
      'FEI-SANS-CARCASSE',
      'FEI-SERVEUR',
      'FEI-SORTIE',
    ]);
    expect(Object.keys(mocks.state.users).sort()).toEqual(['U-DETENTEUR', 'U-SERVEUR', 'U-SORTI']);
    expect(Object.keys(mocks.state.entities).sort()).toEqual(['E-MA-RELATION', 'E-SERVEUR', 'E-SORTIE']);
  });

  it('rechargement complet demandé entre deux pages : reprend à la première page en rechargement complet', async () => {
    const carcassePaths: Array<string> = [];
    let reloadRequested = false;
    mocks.get.mockImplementation(({ path, query }: { path: string; query?: { page: string } }) => {
      if (path === 'now') return Promise.resolve({ ok: true, data: 2000 });
      if (path === '/carcasse/count') return Promise.resolve({ ok: false });
      carcassePaths.push(query!.page);
      const response = serverResponse(reloadRequested);
      // page 0 en delta, puis la demande de rechargement arrive : la page 1 est en rechargement complet
      if (!reloadRequested && query!.page === '0') {
        reloadRequested = true;
        return Promise.resolve({ ...response, data: { ...response.data, hasMore: true } });
      }
      return Promise.resolve(response);
    });
    await loadCarcasses();
    expect(carcassePaths).toEqual(['0', '1', '0']);
    // traité comme un rechargement complet : la carcasse sortie du périmètre est retirée
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-REFUSEE', 'C-SERVEUR']);
  });
});
