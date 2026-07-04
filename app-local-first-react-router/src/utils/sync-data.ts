import type { SyncResponse } from '~/src/types/responses';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { syncProchainBraceletAUtiliser } from '@app/zustand/user';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import useZustandStore, { hydrationPromise } from '@app/zustand/store';
import { loadCarcasses } from './load-carcasses';

// SYNC DATA

let debug = false;

// Single AbortController for the current sync request
let syncAbortController: AbortController | null = null;

export function abortSyncData(reason: string = 'aborted') {
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort(reason);
  }
  syncAbortController = null;
}

export async function syncData(calledFrom?: string) {
  await hydrationPromise;

  // Cancel any in-flight sync
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort('new sync requested');
  }
  syncAbortController = new AbortController();
  const signal = syncAbortController.signal;
  try {
    const state = useZustandStore.getState();
    if (!state.isOnline) {
      console.log('not syncing data because not online');
      return;
    }

    if (debug) console.log('syncing data from', calledFrom);

    // Sync marquage first (independent)
    await syncProchainBraceletAUtiliser();

    // Collect all unsynced items
    const unsyncedFeis = Object.values(state.feis).filter((f) => !f.is_synced);
    const unsyncedCarcasses = Object.values(state.carcasses).filter((c) => !c.is_synced);
    const unsyncedIntermediaires = Object.values(state.carcassesIntermediaireById).filter(
      (ci) => !ci.is_synced
    );
    const unsyncedModifRequests = Object.values(state.modifRequestsByCarcasseId)
      .flat()
      .filter((r) => !r.is_synced);
    const unsyncedLogs = state.logs.filter((l) => !l.is_synced);

    // Nothing to sync
    if (
      unsyncedFeis.length === 0 &&
      unsyncedCarcasses.length === 0 &&
      unsyncedIntermediaires.length === 0 &&
      unsyncedModifRequests.length === 0 &&
      unsyncedLogs.length === 0
    ) {
      useZustandStore.setState({ dataIsSynced: true });
      return;
    }

    if (debug) {
      console.log(
        `syncing: ${unsyncedFeis.length} feis, ${unsyncedCarcasses.length} carcasses, ${unsyncedIntermediaires.length} intermediaires, ${unsyncedModifRequests.length} modifRequests, ${unsyncedLogs.length} logs`
      );
    }

    const response = await API.post({
      path: '/sync',
      body: {
        feis: unsyncedFeis,
        carcasses: unsyncedCarcasses,
        carcassesIntermediaires: unsyncedIntermediaires,
        carcasseModifRequests: unsyncedModifRequests,
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
  } catch (error) {
    if (signal.aborted) return;
    console.error('sync error', error);
    capture(error as Error, { extra: { calledFrom } });
  } finally {
    if (!signal.aborted) {
      await loadCarcasses();
      useZustandStore.setState({ dataIsSynced: true });
    }
  }
}
