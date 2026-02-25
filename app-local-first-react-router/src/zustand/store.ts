import { type Carcasse, type CarcasseIntermediaire, type Log } from '@prisma/client';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { SyncResponse, UserConnexionResponse } from '~/src/types/responses';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { syncProchainBraceletAUtiliser } from './user';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
// PQueue removed - using bulk sync via POST /sync
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/fei-intermediaire';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import { createSlicedIDBStorage } from './idb-sliced-storage';

// State keys to persist in IndexedDB (each stored as its own entry)
const PERSISTED_KEYS: (keyof State)[] = [
  'dataIsSynced',
  'feis',
  'users',
  'entities',
  'detenteursInitiauxIds',
  'carcasses',
  'carcassesIntermediaireById',
  'apiKeyApprovals',
  'lastUpdateCarcassesRegistry',
  'carcassesRegistry',
  'logs',
];

export interface State {
  isOnline: boolean;
  dataIsSynced: boolean;
  feis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires>;
  users: Record<UserForFei['id'], UserForFei>;
  entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation>;
  detenteursInitiauxIds: Array<UserForFei['id']>;
  carcasses: Record<Carcasse['zacharie_carcasse_id'], Carcasse>;
  // single intermediaire for a single carcasse
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>;
  apiKeyApprovals: NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>;
  lastUpdateCarcassesRegistry: number;
  carcassesRegistry: Array<CarcasseForResponseForRegistry>;
  logs: Array<Log>;
  _hasHydrated: boolean;
}

interface Actions {
  setHasHydrated: (state: boolean) => void;
  reset: () => void;
}

const initialState: State = {
  isOnline: true,
  dataIsSynced: true,
  carcassesRegistry: [],
  lastUpdateCarcassesRegistry: 0,
  logs: [],
  feis: {},
  users: {},
  entities: {},
  detenteursInitiauxIds: [],
  apiKeyApprovals: [],
  carcasses: {},
  carcassesIntermediaireById: {},
  _hasHydrated: false,
};

const useZustandStore = create<State & Actions>()(
  devtools(
    persist(
      (set): State & Actions => ({
        ...initialState,
        setHasHydrated: (state) => {
          set({
            _hasHydrated: state,
          });
        },
        reset: () => {
          set(initialState);
        },
      }),
      {
        name: 'zacharie-zustand-store',
        version: 5,
        storage: createSlicedIDBStorage<Partial<State>>(PERSISTED_KEYS),
        onRehydrateStorage: (state) => {
          return () => state.setHasHydrated(true);
        },
        partialize: (state) =>
          Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]])) as Partial<State>,
      },
    ),
  ),
);

export default useZustandStore;

// SYNC DATA

let debug = false;

// Single AbortController for the current sync request
let syncAbortController: AbortController | null = null;

export async function syncData(calledFrom: string) {
  const state = useZustandStore.getState();
  if (!state.isOnline) {
    console.log('not syncing data because not online');
    return;
  }

  if (debug) console.log('syncing data from', calledFrom);

  // Cancel any in-flight sync
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort('new sync requested');
  }
  syncAbortController = new AbortController();
  const signal = syncAbortController.signal;

  // Sync bracelet first (independent)
  await syncProchainBraceletAUtiliser();

  // Collect all unsynced items
  const unsyncedFeis = Object.values(state.feis).filter((f) => !f.is_synced);
  const unsyncedCarcasses = Object.values(state.carcasses).filter((c) => !c.is_synced);
  const unsyncedIntermediaires = Object.values(state.carcassesIntermediaireById).filter(
    (ci) => !ci.is_synced,
  );
  const unsyncedLogs = state.logs.filter((l) => !l.is_synced);

  // Nothing to sync
  if (
    unsyncedFeis.length === 0 &&
    unsyncedCarcasses.length === 0 &&
    unsyncedIntermediaires.length === 0 &&
    unsyncedLogs.length === 0
  ) {
    useZustandStore.setState({ dataIsSynced: true });
    return;
  }

  if (debug) {
    console.log(
      `syncing: ${unsyncedFeis.length} feis, ${unsyncedCarcasses.length} carcasses, ${unsyncedIntermediaires.length} intermediaires, ${unsyncedLogs.length} logs`,
    );
  }

  try {
    const response = await API.post({
      path: '/sync',
      body: {
        feis: unsyncedFeis,
        carcasses: unsyncedCarcasses,
        carcassesIntermediaires: unsyncedIntermediaires,
        logs: unsyncedLogs,
      },
      signal,
    });

    if (signal.aborted) return;

    const res = response as SyncResponse;
    if (!res.ok || !res.data) {
      console.error('sync failed', res.error);
      return;
    }

    // Merge response back into store
    const nextFeis = { ...useZustandStore.getState().feis };
    for (const fei of res.data.feis) {
      nextFeis[fei.numero] = fei;
    }

    const nextCarcasses = { ...useZustandStore.getState().carcasses };
    for (const carcasse of res.data.carcasses) {
      nextCarcasses[carcasse.zacharie_carcasse_id] = carcasse;
    }

    const nextIntermediaires = { ...useZustandStore.getState().carcassesIntermediaireById };
    for (const ci of res.data.carcassesIntermediaires) {
      const id = getFeiAndCarcasseAndIntermediaireIds(ci);
      nextIntermediaires[id] = ci;
    }

    const syncedLogIdsSet = new Set(res.data.syncedLogIds);
    const nextLogs = useZustandStore.getState().logs.filter((log) => !syncedLogIdsSet.has(log.id));

    useZustandStore.setState({
      feis: nextFeis,
      carcasses: nextCarcasses,
      carcassesIntermediaireById: nextIntermediaires,
      logs: nextLogs,
      dataIsSynced: true,
    });
  } catch (error) {
    if (signal.aborted) return;
    console.error('sync error', error);
    capture(error as Error, { extra: { calledFrom } });
  }
}
