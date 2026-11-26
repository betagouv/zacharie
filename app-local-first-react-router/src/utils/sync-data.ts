import type { SyncRejection, SyncResponse } from '~/src/types/responses';
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { syncProchainBraceletAUtiliser } from '@app/zustand/user';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import useZustandStore, { hydrationPromise } from '@app/zustand/store';
import { isLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { loadCarcasses } from './load-carcasses';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/carcasses-intermediaire';

let debug = false;

const removedBySync = new Set<string>();

let syncAbortController: AbortController | null = null;

export function abortSyncData(reason: string = 'aborted') {
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort(reason);
  }
  syncAbortController = null;
  useZustandStore.setState({ syncRejections: [] });
  removedBySync.clear();
}

type State = ReturnType<typeof useZustandStore.getState>;

const rejectionKey = (kind: SyncRejection['kind'], id: string) => `${kind}:${id}`;

function unsyncedUpdatedAtByKey(state: State) {
  const entries: Array<[string, Date]> = [
    ...Object.values(state.feis)
      .filter((f) => !f.is_synced)
      .map((f): [string, Date] => [rejectionKey('fei', f.numero), f.updated_at]),
    ...Object.values(state.carcasses)
      .filter((c) => !c.is_synced)
      .map((c): [string, Date] => [rejectionKey('carcasse', c.zacharie_carcasse_id), c.updated_at]),
    ...Object.values(state.carcassesIntermediaireById)
      .filter((ci) => !ci.is_synced)
      .map((ci): [string, Date] => [
        rejectionKey('carcasseIntermediaire', getFeiAndCarcasseAndIntermediaireIds(ci)),
        ci.updated_at,
      ]),
    ...Object.values(state.modifRequestsByCarcasseId)
      .flat()
      .filter((r) => !r.is_synced)
      .map((r): [string, Date] => [rejectionKey('carcasseModifRequest', r.id), r.updated_at]),
  ];
  return new Map(entries.map(([key, updatedAt]) => [key, dayjs(updatedAt).valueOf()]));
}

function dropSupersededRejections() {
  const state = useZustandStore.getState();
  if (state.syncRejections.length === 0) return;
  const current = unsyncedUpdatedAtByKey(state);
  const kept = state.syncRejections.filter((r) => {
    const updatedAt = current.get(rejectionKey(r.kind, r.id));
    return updatedAt === undefined || updatedAt === r.updated_at;
  });
  if (kept.length !== state.syncRejections.length) useZustandStore.setState({ syncRejections: kept });
}

function collectUnsynced(state: State) {
  const rejectedUpdatedAt = new Map(
    state.syncRejections.map((r) => [rejectionKey(r.kind, r.id), r.updated_at])
  );
  const notRejected = (kind: SyncRejection['kind'], id: string, updatedAt: Date) => {
    const key = rejectionKey(kind, id);
    return rejectedUpdatedAt.get(key) !== dayjs(updatedAt).valueOf() && !removedBySync.has(key);
  };
  return {
    feis: Object.values(state.feis).filter((f) => !f.is_synced && notRejected('fei', f.numero, f.updated_at)),
    carcasses: Object.values(state.carcasses).filter(
      (c) => !c.is_synced && notRejected('carcasse', c.zacharie_carcasse_id, c.updated_at)
    ),
    carcassesIntermediaires: Object.values(state.carcassesIntermediaireById).filter(
      (ci) =>
        !ci.is_synced &&
        notRejected('carcasseIntermediaire', getFeiAndCarcasseAndIntermediaireIds(ci), ci.updated_at)
    ),
    carcasseModifRequests: Object.values(state.modifRequestsByCarcasseId)
      .flat()
      .filter((r) => !r.is_synced && notRejected('carcasseModifRequest', r.id, r.updated_at)),
    logs: state.logs.filter((l) => !l.is_synced),
  };
}

function isEverythingSynced(unsynced: ReturnType<typeof collectUnsynced>) {
  return Object.values(unsynced).every((items) => items.length === 0);
}

export async function syncData(calledFrom?: string) {
  await hydrationPromise;
  if (isLocalTeardownInProgress()) {
    console.log('not syncing data because local state is being cleared');
    return;
  }

  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort('new sync requested');
  }
  syncAbortController = new AbortController();
  const signal = syncAbortController.signal;
  let pushFailed = false;
  try {
    dropSupersededRejections();
    const state = useZustandStore.getState();
    if (!state.isOnline) {
      console.log('not syncing data because not online');
      return;
    }

    if (debug) console.log('syncing data from', calledFrom);

    await syncProchainBraceletAUtiliser();

    const unsynced = collectUnsynced(state);

    if (isEverythingSynced(unsynced)) {
      useZustandStore.setState({ dataIsSynced: true });
      return;
    }

    if (debug) {
      console.log(
        `syncing: ${unsynced.feis.length} feis, ${unsynced.carcasses.length} carcasses, ${unsynced.carcassesIntermediaires.length} intermediaires, ${unsynced.carcasseModifRequests.length} modifRequests, ${unsynced.logs.length} logs`
      );
    }

    const response = await API.post({
      path: '/sync',
      body: unsynced,
      signal,
    });

    if (signal.aborted) return;

    const res = response as SyncResponse;
    if (!res.ok || !res.data) {
      console.error('sync failed', res.error);
      pushFailed = true;
      return;
    }

    const rejected = res.data.rejected ?? [];
    if (rejected.length > 0) {
      const sentUpdatedAt = unsyncedUpdatedAtByKey(state);
      const rejectedVersions = rejected.map((r) => ({
        ...r,
        updated_at: sentUpdatedAt.get(rejectionKey(r.kind, r.id)) ?? 0,
      }));
      useZustandStore.setState((state) => ({
        syncRejections: [...state.syncRejections, ...rejectedVersions],
      }));
    }

    const shouldRemoveFromLocalStore = res.data.shouldRemoveFromLocalStore ?? [];
    if (shouldRemoveFromLocalStore.length > 0) {
      useZustandStore.setState((state) => {
        const feis = { ...state.feis };
        const carcasses = { ...state.carcasses };
        const carcassesIntermediaireById = { ...state.carcassesIntermediaireById };
        for (const rejection of shouldRemoveFromLocalStore) {
          removedBySync.add(`${rejection.kind}:${rejection.id}`);
          if (rejection.kind === 'fei') delete feis[rejection.id];
          if (rejection.kind === 'carcasse') delete carcasses[rejection.id];
          if (rejection.kind === 'carcasseIntermediaire') {
            delete carcassesIntermediaireById[rejection.id as FeiAndCarcasseAndIntermediaireIds];
          }
        }
        return {
          feis,
          carcasses,
          carcassesIntermediaireById,
        };
      });
    }

    const acknowledgedLogIds = new Set(res.data.syncedLogIds);
    if (acknowledgedLogIds.size > 0) {
      useZustandStore.setState((state) => ({
        logs: state.logs.filter((l) => !acknowledgedLogIds.has(l.id)),
      }));
    }
  } catch (error) {
    if (signal.aborted) return;
    pushFailed = true;
    console.error('sync error', error);
    capture(error as Error, { extra: { calledFrom } });
  } finally {
    if (!signal.aborted && !pushFailed) {
      await loadCarcasses();
      if (!signal.aborted) {
        useZustandStore.setState({
          dataIsSynced: isEverythingSynced(collectUnsynced(useZustandStore.getState())),
        });
      }
    }
  }
}
