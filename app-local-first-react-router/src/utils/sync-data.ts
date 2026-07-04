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

// Rien en attente de remontée au serveur ? Sert à la bascule finale de `dataIsSynced`, une fois
// l'aller-retour (POST /sync puis rechargement) terminé — même logique que le court-circuit d'entrée.
function hasNothingToSync(state: ReturnType<typeof useZustandStore.getState>) {
  return (
    Object.values(state.feis).every((f) => f.is_synced) &&
    Object.values(state.carcasses).every((c) => c.is_synced) &&
    Object.values(state.carcassesIntermediaireById).every((ci) => ci.is_synced) &&
    Object.values(state.modifRequestsByCarcasseId)
      .flat()
      .every((r) => r.is_synced) &&
    state.logs.every((l) => l.is_synced)
  );
}

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
      // Après un aller-retour complet, les items remontés reviennent `is_synced: true` via
      // loadCarcasses. Si plus rien n'est en attente localement, on bascule le badge sur « En ligne ».
      // Sans ça, `dataIsSynced` ne repasserait à true qu'au prochain syncData tombant sur une file vide
      // (court-circuit ligne du dessus) — qui peut ne jamais survenir sur une page sans loader (ex : /envoyée).
      if (hasNothingToSync(useZustandStore.getState())) {
        useZustandStore.setState({ dataIsSynced: true });
      }
    }
  }
}
