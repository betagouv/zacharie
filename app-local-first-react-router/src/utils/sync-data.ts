import type { SyncRejection, SyncResponse } from '~/src/types/responses';
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
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

// Les items que le serveur a définitivement refusé d'écrire (autorisation) sont gardés dans
// `syncRejections` du store, avec la raison, pour que l'utilisateur la voie. Sans ça ils restent
// `is_synced = false` — le serveur n'ayant pas touché sa ligne, elle ne revient jamais dans le delta
// de loadCarcasses qui ferait basculer le flag — et repartent dans chaque payload de synchro. La
// portée est la session : le champ n'est pas persisté et `abortSyncData` le vide, donc on retente au
// prochain chargement comme à la connexion suivante. L'équipe est prévenue par le Sentry émis côté
// serveur.

// Single AbortController for the current sync request
let syncAbortController: AbortController | null = null;

export function abortSyncData(reason: string = 'aborted') {
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort(reason);
  }
  syncAbortController = null;
  // Les refus appartiennent au compte qui les a provoqués. `clearLocalAppState` appelle cette
  // fonction à chaque teardown de session, et c'est le seul moment où la liste doit repartir de
  // zéro : `disconnect` navigue en pushState, qui ne recharge pas la page, donc sans ce clear la
  // liste survivrait au changement de compte et bloquerait les écritures légitimes du suivant.
  useZustandStore.setState({ syncRejections: [] });
}

function collectUnsynced(state: ReturnType<typeof useZustandStore.getState>) {
  const rejectedKeys = new Set(state.syncRejections.map((r) => `${r.kind}:${r.id}`));
  const notRejected = (kind: SyncRejection['kind'], id: string) => !rejectedKeys.has(`${kind}:${id}`);
  return {
    feis: Object.values(state.feis).filter((f) => !f.is_synced && notRejected('fei', f.numero)),
    carcasses: Object.values(state.carcasses).filter(
      (c) => !c.is_synced && notRejected('carcasse', c.zacharie_carcasse_id)
    ),
    carcassesIntermediaires: Object.values(state.carcassesIntermediaireById).filter(
      (ci) => !ci.is_synced && notRejected('carcasseIntermediaire', getFeiAndCarcasseAndIntermediaireIds(ci))
    ),
    carcasseModifRequests: Object.values(state.modifRequestsByCarcasseId)
      .flat()
      .filter((r) => !r.is_synced && notRejected('carcasseModifRequest', r.id)),
    logs: state.logs.filter((l) => !l.is_synced),
  };
}

function isEverythingSynced(unsynced: ReturnType<typeof collectUnsynced>) {
  return Object.values(unsynced).every((items) => items.length === 0);
}

export async function syncData(calledFrom?: string) {
  await hydrationPromise;

  // Cancel any in-flight sync
  if (syncAbortController && !syncAbortController.signal.aborted) {
    syncAbortController.abort('new sync requested');
  }
  syncAbortController = new AbortController();
  const signal = syncAbortController.signal;
  // Un push échoué laisse des éditions locales non synchronisées : le pull qui suit les écraserait
  // (mergeItems est server-wins), donc on ne recharge pas dans ce cas.
  let pushFailed = false;
  try {
    const state = useZustandStore.getState();
    if (!state.isOnline) {
      console.log('not syncing data because not online');
      return;
    }

    if (debug) console.log('syncing data from', calledFrom);

    // Sync marquage first (independent)
    await syncProchainBraceletAUtiliser();

    const unsynced = collectUnsynced(state);

    // Nothing to sync
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

    // Refus définitifs : on arrête de les repousser. On ne touche pas à la donnée locale — le
    // serveur ne renvoie pas sa version (ce serait exposer la fiche d'un tiers), donc on n'a rien
    // pour la corriger ici. Elle le sera dès que la ligne serveur bougera légitimement et reviendra
    // dans un delta, mergeItems étant server-wins.
    const rejected = res.data.rejected ?? [];
    if (rejected.length > 0) {
      useZustandStore.setState((state) => ({ syncRejections: [...state.syncRejections, ...rejected] }));
    }

    // Le serveur confirme les logs qu'il a écrits : on les retire du store, sinon ils
    // repartent dans chaque payload de sync pour toute la durée de la session.
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
      // Le delta vient de fusionner la version serveur (is_synced = true) : l'indicateur
      // « Synchronisation en cours » se met à jour sans attendre un prochain appel.
      if (!signal.aborted) {
        useZustandStore.setState({
          dataIsSynced: isEverythingSynced(collectUnsynced(useZustandStore.getState())),
        });
      }
    }
  }
}
