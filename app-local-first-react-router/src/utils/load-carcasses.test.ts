import { describe, it, expect, beforeEach, vi } from 'vitest';

type Item = { is_synced: boolean; updated_at: Date; created_at: Date; deleted_at: Date | null };

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    lastUpdateFromServer: 1000,
    carcassesReloadVersion: 0,
    feis: {} as Record<string, Item & { numero: string }>,
    carcasses: {} as Record<string, Item & { zacharie_carcasse_id: string; fei_numero: string }>,
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
      reloadVersion: 4,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  Object.assign(mocks.state, {
    lastUpdateFromServer: 1000,
    carcassesReloadVersion: 3,
    feis: {
      'FEI-SORTIE': { ...base(), numero: 'FEI-SORTIE' },
      'FEI-NON-SYNC': { ...base(false), numero: 'FEI-NON-SYNC' },
    },
    carcasses: {
      'C-SORTIE': { ...base(), zacharie_carcasse_id: 'C-SORTIE', fei_numero: 'FEI-SORTIE' },
      'C-NON-SYNC': { ...base(false), zacharie_carcasse_id: 'C-NON-SYNC', fei_numero: 'FEI-NON-SYNC' },
    },
    carcassesIntermediaireById: {
      'FEI-SORTIE_C-SORTIE_INTER-1': {
        ...base(),
        fei_numero: 'FEI-SORTIE',
        zacharie_carcasse_id: 'C-SORTIE',
        intermediaire_id: 'INTER-1',
      },
    },
    users: { 'U-SORTI': { ...base(), id: 'U-SORTI' } },
    entities: { 'E-SORTIE': { ...base(), id: 'E-SORTIE', relation: 'NONE' } },
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
  it('retire les fiches, carcasses et CarcasseIntermediaire synchronisées absentes de la réponse', async () => {
    mockServer(true);
    await loadCarcasses();
    expect(mocks.state.feis['FEI-SORTIE']).toBeUndefined();
    expect(mocks.state.carcasses['C-SORTIE']).toBeUndefined();
    expect(mocks.state.carcassesIntermediaireById).toEqual({});
    expect(mocks.state.feis['FEI-SERVEUR']).toBeDefined();
    expect(mocks.state.carcasses['C-SERVEUR']).toBeDefined();
    // utilisateurs et entités : toujours mergés
    expect(Object.keys(mocks.state.users).sort()).toEqual(['U-SERVEUR', 'U-SORTI']);
    expect(Object.keys(mocks.state.entities).sort()).toEqual(['E-SERVEUR', 'E-SORTIE']);
  });

  it('garde les fiches et carcasses pas encore synchronisées', async () => {
    mockServer(true);
    await loadCarcasses();
    expect(Object.keys(mocks.state.feis).sort()).toEqual(['FEI-NON-SYNC', 'FEI-SERVEUR']);
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-NON-SYNC', 'C-SERVEUR']);
  });

  it('pull delta : les données locales sont gardées et complétées', async () => {
    mockServer(false);
    await loadCarcasses();
    expect(Object.keys(mocks.state.feis).sort()).toEqual(['FEI-NON-SYNC', 'FEI-SERVEUR', 'FEI-SORTIE']);
    expect(Object.keys(mocks.state.carcasses).sort()).toEqual(['C-NON-SYNC', 'C-SERVEUR', 'C-SORTIE']);
  });
});

describe('loadCarcasses — version de rechargement', () => {
  it('envoie la version stockée et stocke la version reçue', async () => {
    mockServer(true);
    await loadCarcasses();
    const carcasseCall = mocks.get.mock.calls.find(([arg]) => arg.path === '/carcasse');
    expect(carcasseCall![0].query.reloadVersion).toBe('3');
    expect(mocks.state.carcassesReloadVersion).toBe(4);
    expect(mocks.state.lastUpdateFromServer).toBe(2000);
  });

  it('un pull en échec ne stocke pas la version', async () => {
    mocks.get.mockImplementation(({ path }: { path: string }) => {
      if (path === 'now') return Promise.resolve({ ok: true, data: 2000 });
      return Promise.resolve({ ok: false });
    });
    await loadCarcasses();
    expect(mocks.state.carcassesReloadVersion).toBe(3);
    expect(mocks.state.lastUpdateFromServer).toBe(1000);
  });
});

describe('loadCarcasses — carcasses sorties du périmètre', () => {
  // Le contrôle d'intégrité n'a lieu qu'une fois toutes les 6 heures : on avance l'horloge à chaque test.
  let now = Date.now();
  beforeEach(() => {
    now += 7 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    for (const carcasse of Object.values(mocks.state.carcasses)) carcasse.is_synced = true;
  });

  function mockServerWithCount(count: number, refuseesHorsPerimetreIds: string[] = []) {
    mocks.get.mockImplementation(({ path }: { path: string }) => {
      if (path === 'now') return Promise.resolve({ ok: true, data: 2000 });
      if (path === '/carcasse/count')
        return Promise.resolve({ ok: true, data: { count, refuseesHorsPerimetreIds } });
      return Promise.resolve(serverResponse(false));
    });
  }
  const carcasseCalls = () => mocks.get.mock.calls.filter(([arg]) => arg.path === '/carcasse');

  it('plus de carcasses en local que sur le serveur : recharge tout le périmètre', async () => {
    mockServerWithCount(2); // 3 en local après le delta, dont C-SORTIE sortie du périmètre
    await loadCarcasses();
    await vi.waitFor(() => expect(carcasseCalls()).toHaveLength(2));
    expect(carcasseCalls()[0][0].query.reloadVersion).toBe('3');
    expect(carcasseCalls()[1][0].query.reloadVersion).toBe('-1');
  });

  it('autant de carcasses en local que sur le serveur : pas de rechargement', async () => {
    mockServerWithCount(3);
    await loadCarcasses();
    await vi.waitFor(() =>
      expect(mocks.get.mock.calls.some(([arg]) => arg.path === '/carcasse/count')).toBe(true)
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(carcasseCalls()).toHaveLength(1);
  });

  it("carcasses refusées hors périmètre chargées à l'ouverture d'une fiche : hors du compte, pas de rechargement", async () => {
    // GET /carcasse/refusees/:fei_numero les ajoute au store alors qu'elles sont hors du périmètre
    // du pull : un rechargement complet les retirerait, puis l'ouverture de la fiche les remettrait.
    Object.assign(mocks.state.carcasses, {
      'C-REFUSEE': {
        ...base(),
        zacharie_carcasse_id: 'C-REFUSEE',
        fei_numero: 'FEI-SORTIE',
        intermediaire_carcasse_refus_intermediaire_id: 'INTERMEDIAIRE-AMONT',
      },
      'C-MANQUANTE': {
        ...base(),
        zacharie_carcasse_id: 'C-MANQUANTE',
        fei_numero: 'FEI-SORTIE',
        intermediaire_carcasse_manquante: true,
      },
    });
    mockServerWithCount(3, ['C-REFUSEE', 'C-MANQUANTE']);
    await loadCarcasses();
    await vi.waitFor(() =>
      expect(mocks.get.mock.calls.some(([arg]) => arg.path === '/carcasse/count')).toBe(true)
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(carcasseCalls()).toHaveLength(1);
  });

  it('carcasse refusée du périmètre : comptée comme les autres', async () => {
    // Le serveur la compte (elle est dans le périmètre) et ne la signale pas hors périmètre : le client
    // doit la compter aussi, sinon un écart sur les carcasses refusées passerait inaperçu.
    Object.assign(mocks.state.carcasses, {
      'C-REFUSEE': {
        ...base(),
        zacharie_carcasse_id: 'C-REFUSEE',
        fei_numero: 'FEI-SORTIE',
        intermediaire_carcasse_refus_intermediaire_id: 'INTERMEDIAIRE-AMONT',
      },
    });
    mockServerWithCount(4);
    await loadCarcasses();
    await vi.waitFor(() =>
      expect(mocks.get.mock.calls.some(([arg]) => arg.path === '/carcasse/count')).toBe(true)
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(carcasseCalls()).toHaveLength(1);
  });
});
