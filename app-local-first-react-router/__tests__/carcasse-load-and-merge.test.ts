import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FeiOwnerRole } from '@prisma/client';
import type { Carcasse, CarcasseIntermediaire } from '@prisma/client';

import { setFeiInStore } from '../src/utils/load-fei';
import useZustandStore from '../src/zustand/store';
import { getFeiAndCarcasseAndIntermediaireIds } from '../src/utils/get-carcasse-intermediaire-id';
import type { FeiForRefresh } from '../../api-express/src/types/fei';

// Silence Sentry. fei-steps.test.ts uses the same pattern.
const mockCapture = vi.hoisted(() => vi.fn());
vi.mock('@app/services/sentry', () => ({ capture: mockCapture }));

// reset() does a shallow merge; clear the maps we touch so state doesn't leak between tests.
function clearStore() {
  useZustandStore.setState({
    feis: {},
    carcasses: {},
    carcassesIntermediaireById: {},
    users: {},
    entities: {},
  });
}

// ---------- fixture helpers ----------

const FEI_NUMERO = 'FEI-LOAD-MERGE-001';

const makeCarcasse = (overrides: Partial<Carcasse> = {}): Carcasse =>
  ({
    zacharie_carcasse_id: 'ZC-1',
    numero_bracelet: 'BR-1',
    fei_numero: FEI_NUMERO,
    espece: 'Chevreuil',
    type: null,
    nombre_d_animaux: 1,
    heure_mise_a_mort: null,
    heure_evisceration: null,
    examinateur_carcasse_sans_anomalie: null,
    examinateur_anomalies_carcasse: [],
    examinateur_anomalies_abats: [],
    examinateur_commentaire: null,
    intermediaire_carcasse_refus_intermediaire_id: null,
    intermediaire_carcasse_refus_motif: null,
    intermediaire_carcasse_manquante: false,
    intermediaire_carcasse_signed_at: null,
    latest_intermediaire_signed_at: null,
    svi_carcasse_commentaire: null,
    svi_carcasse_status: null,
    svi_carcasse_status_set_at: null,
    svi_carcasse_archived: null,
    svi_ipm1_decision: null,
    svi_ipm2_decision: null,
    created_at: new Date('2026-01-01T08:00:00Z'),
    updated_at: new Date('2026-01-01T08:00:00Z'),
    deleted_at: null,
    is_synced: true,
    ...overrides,
  }) as unknown as Carcasse;

const makeIntermediaire = (overrides: Partial<CarcasseIntermediaire> = {}): CarcasseIntermediaire =>
  ({
    fei_numero: FEI_NUMERO,
    zacharie_carcasse_id: 'ZC-1',
    intermediaire_id: 'user-collecteur_FEI-LOAD-MERGE-001_100000',
    intermediaire_user_id: 'user-collecteur',
    intermediaire_entity_id: 'entity-collecteur',
    intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
    prise_en_charge_at: new Date('2026-01-02T10:00:00Z'),
    refus: null,
    commentaire: null,
    manquante: false,
    check_finished_at: null,
    intermediaire_depot_type: null,
    intermediaire_depot_entity_id: null,
    intermediaire_prochain_detenteur_id_cache: null,
    intermediaire_prochain_detenteur_role_cache: null,
    created_at: new Date('2026-01-02T10:00:00Z'),
    updated_at: new Date('2026-01-02T10:00:00Z'),
    deleted_at: null,
    is_synced: true,
    ...overrides,
  }) as unknown as CarcasseIntermediaire;

const makeFei = (
  overrides: Partial<FeiForRefresh> = {},
  carcasses: Carcasse[] = [],
  intermediaires: CarcasseIntermediaire[] = []
): FeiForRefresh =>
  ({
    id: 1,
    numero: FEI_NUMERO,
    creation_context: 'zacharie',
    date_mise_a_mort: new Date('2026-01-01'),
    commune_mise_a_mort: 'Paris',
    heure_mise_a_mort_premiere_carcasse: '08:00',
    heure_evisceration_derniere_carcasse: '09:00',
    examinateur_initial_user_id: 'user-cfei',
    examinateur_initial_offline: false,
    examinateur_initial_approbation_mise_sur_le_marche: true,
    examinateur_initial_date_approbation_mise_sur_le_marche: new Date('2026-01-01'),
    premier_detenteur_user_id: 'user-cfei',
    premier_detenteur_offline: false,
    fei_current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    intermediaire_closed_at: null,
    svi_assigned_at: null,
    automatic_closed_at: null,
    deleted_at: null,
    created_at: new Date('2026-01-01T08:00:00Z'),
    updated_at: new Date('2026-01-01T08:00:00Z'),
    is_synced: true,
    Carcasses: carcasses.map((c) => ({ ...c, CarcasseIntermediaire: [] })),
    CarcasseIntermediaire: intermediaires,
    ...overrides,
  }) as unknown as FeiForRefresh;

// ---------- tests ----------

describe('setFeiInStore — initial population', () => {
  beforeEach(() => {
    clearStore();
    mockCapture.mockClear();
  });

  test('inserts a brand new FEI, its carcasses, and its intermediaires when the store is empty', () => {
    const carcasse = makeCarcasse();
    const intermediaire = makeIntermediaire();
    const fei = makeFei({}, [carcasse], [intermediaire]);

    setFeiInStore(fei);

    const state = useZustandStore.getState();
    expect(state.feis[FEI_NUMERO]).toBeDefined();
    expect(state.feis[FEI_NUMERO].numero).toBe(FEI_NUMERO);

    expect(state.carcasses['ZC-1']).toBeDefined();
    expect(state.carcasses['ZC-1'].numero_bracelet).toBe('BR-1');

    const compositeId = getFeiAndCarcasseAndIntermediaireIds(intermediaire);
    expect(state.carcassesIntermediaireById[compositeId]).toBeDefined();
    expect(state.carcassesIntermediaireById[compositeId].intermediaire_role).toBe(
      FeiOwnerRole.COLLECTEUR_PRO
    );
  });

  test('composite intermediaire id is built from fei_numero + zacharie_carcasse_id + intermediaire_id', () => {
    const inter = makeIntermediaire({
      fei_numero: 'F-X',
      zacharie_carcasse_id: 'ZC-X',
      intermediaire_id: 'INT-X',
    });
    const fei = makeFei({ numero: 'F-X' }, [makeCarcasse({ zacharie_carcasse_id: 'ZC-X' })], [inter]);
    setFeiInStore(fei);

    expect(useZustandStore.getState().carcassesIntermediaireById['F-X_ZC-X_INT-X']).toBeDefined();
  });
});

describe('setFeiInStore — FEI-level merge by updated_at', () => {
  beforeEach(() => {
    clearStore();
    mockCapture.mockClear();
  });

  test('server FEI newer → server fields win, oldest fills the rest', () => {
    const localFei = makeFei({
      commune_mise_a_mort: 'LOCAL-VILLE',
      heure_mise_a_mort_premiere_carcasse: 'LOCAL-HEURE',
      updated_at: new Date('2026-01-01T08:00:00Z'),
      is_synced: false, // local offline edit
    });
    setFeiInStore(localFei);

    const serverFei = makeFei({
      commune_mise_a_mort: 'SERVER-VILLE',
      // heure_mise_a_mort_premiere_carcasse intentionally same as default '08:00'
      updated_at: new Date('2026-01-05T08:00:00Z'),
      is_synced: true,
    });
    setFeiInStore(serverFei);

    const stored = useZustandStore.getState().feis[FEI_NUMERO];
    expect(stored.commune_mise_a_mort).toBe('SERVER-VILLE');
    // newest is_synced wins
    expect(stored.is_synced).toBe(true);
  });

  test('local FEI newer → local fields preserved against an older server payload', () => {
    const initialServerFei = makeFei({
      commune_mise_a_mort: 'OLD-SERVER-VILLE',
      updated_at: new Date('2026-01-01T08:00:00Z'),
      is_synced: true,
    });
    setFeiInStore(initialServerFei);

    // simulate an offline local edit: bump updated_at + flip is_synced
    useZustandStore.setState((s) => ({
      feis: {
        ...s.feis,
        [FEI_NUMERO]: {
          ...s.feis[FEI_NUMERO],
          commune_mise_a_mort: 'LOCAL-EDIT',
          updated_at: new Date('2026-01-10T08:00:00Z'),
          is_synced: false,
        },
      },
    }));

    // server roundtrip returns the stale copy (e.g. our edit hasn't reached it yet)
    setFeiInStore(initialServerFei);

    const stored = useZustandStore.getState().feis[FEI_NUMERO];
    expect(stored.commune_mise_a_mort).toBe('LOCAL-EDIT');
    expect(stored.is_synced).toBe(false);
  });
});

describe('setFeiInStore — carcasse-level merge is independent of FEI timestamp', () => {
  beforeEach(() => {
    clearStore();
    mockCapture.mockClear();
  });

  test('an older FEI envelope can still carry a newer carcasse — newer carcasse wins', () => {
    // 1. seed store with old data (carcasse @ t0)
    const oldCarcasse = makeCarcasse({
      numero_bracelet: 'OLD-BR',
      updated_at: new Date('2026-01-01T08:00:00Z'),
    });
    setFeiInStore(makeFei({ updated_at: new Date('2026-01-01T08:00:00Z') }, [oldCarcasse]));

    // 2. server returns a FEI that is *older or equal* but the carcasse is newer
    //    (this can happen during refactor: carcasse-first endpoints may return
    //    fresh carcasse rows with stale or absent FEI metadata)
    const newerCarcasse = makeCarcasse({
      numero_bracelet: 'NEW-BR',
      updated_at: new Date('2026-01-20T08:00:00Z'),
    });
    setFeiInStore(makeFei({ updated_at: new Date('2026-01-01T08:00:00Z') }, [newerCarcasse]));

    expect(useZustandStore.getState().carcasses['ZC-1'].numero_bracelet).toBe('NEW-BR');
  });

  test('offline-edited carcasse (newer local) survives an older server fetch', () => {
    setFeiInStore(
      makeFei({}, [
        makeCarcasse({
          numero_bracelet: 'BR-INIT',
          updated_at: new Date('2026-01-01T08:00:00Z'),
          is_synced: true,
        }),
      ])
    );

    // local edit
    useZustandStore.setState((s) => ({
      carcasses: {
        ...s.carcasses,
        'ZC-1': {
          ...s.carcasses['ZC-1'],
          numero_bracelet: 'BR-LOCAL-EDIT',
          updated_at: new Date('2026-01-15T08:00:00Z'),
          is_synced: false,
        },
      },
    }));

    // server roundtrip returns the stale copy
    setFeiInStore(
      makeFei({}, [
        makeCarcasse({
          numero_bracelet: 'BR-INIT',
          updated_at: new Date('2026-01-01T08:00:00Z'),
          is_synced: true,
        }),
      ])
    );

    const stored = useZustandStore.getState().carcasses['ZC-1'];
    expect(stored.numero_bracelet).toBe('BR-LOCAL-EDIT');
    expect(stored.is_synced).toBe(false);
  });

  test('server-newer carcasse wins even when local is_synced=false (lost-write is current behavior)', () => {
    // This is the documented behavior: timestamp wins, regardless of is_synced.
    // The refactor MUST preserve this — change it and offline edits become sticky.
    setFeiInStore(
      makeFei({}, [
        makeCarcasse({
          numero_bracelet: 'BR-INIT',
          updated_at: new Date('2026-01-01T08:00:00Z'),
          is_synced: true,
        }),
      ])
    );

    // local edit @ t1
    useZustandStore.setState((s) => ({
      carcasses: {
        ...s.carcasses,
        'ZC-1': {
          ...s.carcasses['ZC-1'],
          numero_bracelet: 'BR-LOCAL-LOSER',
          updated_at: new Date('2026-01-05T08:00:00Z'),
          is_synced: false,
        },
      },
    }));

    // server has a strictly newer write @ t2
    setFeiInStore(
      makeFei({}, [
        makeCarcasse({
          numero_bracelet: 'BR-SERVER-WINNER',
          updated_at: new Date('2026-01-10T08:00:00Z'),
          is_synced: true,
        }),
      ])
    );

    const stored = useZustandStore.getState().carcasses['ZC-1'];
    expect(stored.numero_bracelet).toBe('BR-SERVER-WINNER');
    expect(stored.is_synced).toBe(true);
  });
});

describe('setFeiInStore — intermediaire merge by composite id', () => {
  beforeEach(() => {
    clearStore();
    mockCapture.mockClear();
  });

  test('two intermediaires on the same carcasse (different intermediaire_id) are kept separate', () => {
    const inter1 = makeIntermediaire({
      intermediaire_id: 'INT-A',
      intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
    });
    const inter2 = makeIntermediaire({ intermediaire_id: 'INT-B', intermediaire_role: FeiOwnerRole.ETG });
    setFeiInStore(makeFei({}, [makeCarcasse()], [inter1, inter2]));

    const state = useZustandStore.getState();
    const idA = getFeiAndCarcasseAndIntermediaireIds(inter1);
    const idB = getFeiAndCarcasseAndIntermediaireIds(inter2);
    expect(state.carcassesIntermediaireById[idA].intermediaire_role).toBe(FeiOwnerRole.COLLECTEUR_PRO);
    expect(state.carcassesIntermediaireById[idB].intermediaire_role).toBe(FeiOwnerRole.ETG);
  });

  test('newer intermediaire on second fetch overwrites the older one', () => {
    const initial = makeIntermediaire({
      commentaire: 'first',
      updated_at: new Date('2026-01-01T08:00:00Z'),
    });
    setFeiInStore(makeFei({}, [makeCarcasse()], [initial]));

    const updated = makeIntermediaire({
      commentaire: 'second',
      updated_at: new Date('2026-01-10T08:00:00Z'),
    });
    setFeiInStore(makeFei({}, [makeCarcasse()], [updated]));

    const id = getFeiAndCarcasseAndIntermediaireIds(initial);
    expect(useZustandStore.getState().carcassesIntermediaireById[id].commentaire).toBe('second');
  });

  test('older intermediaire on second fetch does NOT overwrite a newer local edit', () => {
    const initial = makeIntermediaire({
      commentaire: 'server-old',
      updated_at: new Date('2026-01-01T08:00:00Z'),
      is_synced: true,
    });
    setFeiInStore(makeFei({}, [makeCarcasse()], [initial]));

    const id = getFeiAndCarcasseAndIntermediaireIds(initial);

    // local edit, newer + unsynced
    useZustandStore.setState((s) => ({
      carcassesIntermediaireById: {
        ...s.carcassesIntermediaireById,
        [id]: {
          ...s.carcassesIntermediaireById[id],
          commentaire: 'local-newer',
          updated_at: new Date('2026-01-15T08:00:00Z'),
          is_synced: false,
        },
      },
    }));

    // server re-sends the stale row
    setFeiInStore(makeFei({}, [makeCarcasse()], [initial]));

    const stored = useZustandStore.getState().carcassesIntermediaireById[id];
    expect(stored.commentaire).toBe('local-newer');
    expect(stored.is_synced).toBe(false);
  });
});

describe('setFeiInStore — refactor invariants', () => {
  // These tests pin down behavior that the carcasse-first fetch refactor must preserve.
  // Failing any of them means a regression in the local-first merge contract.
  beforeEach(() => {
    clearStore();
    mockCapture.mockClear();
  });

  test('FEI in store is not corrupted when the same FEI is set twice with identical timestamps', () => {
    const fei = makeFei({}, [makeCarcasse()], [makeIntermediaire()]);
    setFeiInStore(fei);
    const firstSnapshot = useZustandStore.getState().feis[FEI_NUMERO];
    setFeiInStore(fei);
    const secondSnapshot = useZustandStore.getState().feis[FEI_NUMERO];

    expect(secondSnapshot.numero).toBe(firstSnapshot.numero);
    expect(secondSnapshot.commune_mise_a_mort).toBe(firstSnapshot.commune_mise_a_mort);
    expect(Object.keys(useZustandStore.getState().carcasses)).toHaveLength(1);
    expect(Object.keys(useZustandStore.getState().carcassesIntermediaireById)).toHaveLength(1);
  });

  test('a FEI with no carcasses and no intermediaires does not blow up the store', () => {
    setFeiInStore(makeFei({}, [], []));
    const state = useZustandStore.getState();
    expect(state.feis[FEI_NUMERO]).toBeDefined();
    expect(Object.keys(state.carcasses)).toHaveLength(0);
    expect(Object.keys(state.carcassesIntermediaireById)).toHaveLength(0);
  });

  test('thin FEI envelope (null fields) does NOT wipe rich local fields when local is strictly newer', () => {
    // Simulates a future state where carcasse-first endpoints return a minimal FEI
    // shell. If the local FEI is newer (typical: user just edited it), rich fields
    // must survive — otherwise the carcasse-first refactor will silently null out
    // metadata every time the store refreshes.
    setFeiInStore(
      makeFei({ commune_mise_a_mort: 'RICH-VILLE', updated_at: new Date('2026-02-01T08:00:00Z') }, [
        makeCarcasse({ numero_bracelet: 'BR-OLD', updated_at: new Date('2026-01-01T08:00:00Z') }),
      ])
    );

    const thinFei = makeFei(
      {
        commune_mise_a_mort: null as any,
        heure_mise_a_mort_premiere_carcasse: null as any,
        // server timestamp is OLDER than local
        updated_at: new Date('2026-01-01T08:00:00Z'),
      },
      [makeCarcasse({ numero_bracelet: 'BR-FRESH', updated_at: new Date('2026-02-15T08:00:00Z') })]
    );
    setFeiInStore(thinFei);

    // Carcasse-level merge: newer carcasse always wins (independent of FEI timestamp)
    expect(useZustandStore.getState().carcasses['ZC-1'].numero_bracelet).toBe('BR-FRESH');

    // FEI-level merge: local newer → rich fields survive, no null wipe
    expect(useZustandStore.getState().feis[FEI_NUMERO].commune_mise_a_mort).toBe('RICH-VILLE');
  });

  test('CURRENT BEHAVIOR pin: equal-timestamp FEI merge lets new payload overwrite, even with nulls', () => {
    // Documents existing semantics so the refactor sees it explicitly:
    // when timestamps are equal, the new payload "wins" via spread-overwrite,
    // including nulls. If the refactor wants to fix this, this test fails first.
    setFeiInStore(
      makeFei({
        commune_mise_a_mort: 'RICH-VILLE',
        updated_at: new Date('2026-01-01T08:00:00Z'),
      })
    );

    setFeiInStore(
      makeFei({
        commune_mise_a_mort: null as any,
        updated_at: new Date('2026-01-01T08:00:00Z'),
      })
    );

    expect(useZustandStore.getState().feis[FEI_NUMERO].commune_mise_a_mort).toBeNull();
  });
});
