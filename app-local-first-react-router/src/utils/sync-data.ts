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

// Au-delà de ce nombre d'items à pousser, on découpe le POST /sync en plusieurs
// requêtes ordonnées (feis → carcasses → intermédiaires → modifs → logs) pour qu'aucun
// payload ne dépasse la limite de body du serveur (cas d'une fiche à 300+ carcasses).
const CHUNK_SIZE = 100;
// On coalesce les rafales de mutations (ex. saisie rapide de carcasses) en un seul run.
const DEBOUNCE_MS = 800;

// Single-flight : un seul run de sync à la fois. Les appels reçus pendant un run
// en cours posent un drapeau pour relancer une passe à la fin (sans annuler le run).
let isSyncing = false;
let pendingResync = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// AbortController du run en cours — annulé uniquement au teardown (disconnect).
let syncAbortController: AbortController | null = null;
// Résolveurs des promesses renvoyées par syncData(), réglés à la fin du run qui les porte.
let waiters: Array<() => void> = [];

function resolveWaiters(list: Array<() => void>) {
  for (const resolve of list) resolve();
}

export function abortSyncData(reason: string = 'aborted') {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingResync = false;
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort(reason);
  }
  syncAbortController = null;
  // Ne pas laisser de promesses en attente pendre indéfiniment après un teardown.
  const pending = waiters;
  waiters = [];
  resolveWaiters(pending);
}

export function syncData(calledFrom?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    waiters.push(resolve);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      triggerSync(calledFrom);
    }, DEBOUNCE_MS);
  });
}

function triggerSync(calledFrom?: string) {
  if (isSyncing) {
    // Un run est déjà en cours : il enverra l'état le plus récent à sa prochaine passe.
    pendingResync = true;
    return;
  }
  void runSync(calledFrom);
}

function chunk<T>(arr: Array<T>, size: number): Array<Array<T>> {
  const out: Array<Array<T>> = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

type SyncBody = NonNullable<Parameters<typeof postSyncChunk>[0]>;

async function postSyncChunk(
  body: {
    feis: Array<unknown>;
    carcasses: Array<unknown>;
    carcassesIntermediaires: Array<unknown>;
    carcasseModifRequests: Array<unknown>;
    logs: Array<unknown>;
  },
  signal: AbortSignal
): Promise<boolean> {
  const response = await API.post({ path: '/sync', body, signal });
  if (signal.aborted) return false;
  const res = response as SyncResponse;
  if (!res.ok || !res.data) {
    console.error('sync failed', res.error);
    return false;
  }
  return true;
}

async function runSync(calledFrom?: string) {
  await hydrationPromise;

  isSyncing = true;
  // Les appels coalescés dans la fenêtre de debounce qui a déclenché ce run sont résolus
  // à la fin de CE run. Ceux arrivés après (pendingResync) seront résolus au run suivant.
  const myWaiters = waiters;
  waiters = [];

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
    if (signal.aborted) return;

    // Collect all unsynced items
    const unsyncedFeis = Object.values(state.feis).filter((f) => !f.is_synced);
    const unsyncedCarcasses = Object.values(state.carcasses).filter((c) => !c.is_synced);
    const unsyncedIntermediaires = Object.values(state.carcassesIntermediaireById).filter(
      (ci) => !ci.is_synced
    );
    const unsyncedModifRequests = Object.values(state.carcasseModifActiveByCarcasseId).filter(
      (r) => !r.is_synced
    );
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

    const totalRecords = unsyncedCarcasses.length + unsyncedIntermediaires.length + unsyncedLogs.length;

    if (totalRecords <= CHUNK_SIZE) {
      // Cas courant (petites fiches) : un seul POST, comme avant.
      await postSyncChunk(
        {
          feis: unsyncedFeis,
          carcasses: unsyncedCarcasses,
          carcassesIntermediaires: unsyncedIntermediaires,
          carcasseModifRequests: unsyncedModifRequests,
          logs: unsyncedLogs,
        },
        signal
      );
    } else {
      // Grande fiche : on découpe en respectant l'ordre de dépendances du serveur
      // (feis avant carcasses avant intermédiaires). Au premier échec on s'arrête : les
      // enregistrements restés non synchronisés repartiront à la prochaine passe.
      const empty: SyncBody = {
        feis: [],
        carcasses: [],
        carcassesIntermediaires: [],
        carcasseModifRequests: [],
        logs: [],
      };

      if (unsyncedFeis.length) {
        if (!(await postSyncChunk({ ...empty, feis: unsyncedFeis }, signal))) return;
        if (signal.aborted) return;
      }
      for (const part of chunk(unsyncedCarcasses, CHUNK_SIZE)) {
        if (!(await postSyncChunk({ ...empty, carcasses: part }, signal))) return;
        if (signal.aborted) return;
      }
      for (const part of chunk(unsyncedIntermediaires, CHUNK_SIZE)) {
        if (!(await postSyncChunk({ ...empty, carcassesIntermediaires: part }, signal))) return;
        if (signal.aborted) return;
      }
      if (unsyncedModifRequests.length) {
        if (!(await postSyncChunk({ ...empty, carcasseModifRequests: unsyncedModifRequests }, signal))) {
          return;
        }
        if (signal.aborted) return;
      }
      for (const part of chunk(unsyncedLogs, CHUNK_SIZE)) {
        if (!(await postSyncChunk({ ...empty, logs: part }, signal))) return;
        if (signal.aborted) return;
      }
    }
  } catch (error) {
    if (signal.aborted) return;
    console.error('sync error', error);
    capture(error as Error, { extra: { calledFrom } });
  } finally {
    const aborted = signal.aborted;
    if (syncAbortController?.signal === signal) {
      syncAbortController = null;
    }
    isSyncing = false;
    if (!aborted) {
      await loadCarcasses();
    }
    resolveWaiters(myWaiters);
    // Une mutation est arrivée pendant ce run : relancer une passe pour l'inclure.
    if (pendingResync && !aborted) {
      pendingResync = false;
      void runSync('resync');
    }
  }
}
