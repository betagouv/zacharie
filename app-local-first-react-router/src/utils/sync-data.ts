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

// SYNC DATA

let debug = false;

// Les items que le serveur a refusé d'écrire (autorisation, version obsolète) sont gardés dans
// `syncRejections` du store, avec la raison, pour que l'utilisateur la voie. Sans ça ils restent
// `is_synced = false` — le serveur n'ayant pas touché sa ligne, elle ne revient pas forcément dans
// le delta de loadCarcasses qui ferait basculer le flag — et repartent dans chaque payload de
// synchro. Le refus porte sur la version envoyée (son `updated_at`) : une nouvelle modification
// locale de l'item change `updated_at`, elle est donc envoyée et le refus précédent disparaît de
// l'alerte. La portée est la session : le champ n'est pas persisté et `abortSyncData` le vide, donc
// on retente au prochain chargement comme à la connexion suivante. L'équipe est prévenue par le
// Sentry émis côté serveur.

// Items que le serveur a demandé de retirer du store local (`shouldRemoveFromLocalStore`) : ils
// ne sont pas des refus à montrer à l'utilisateur, mais on ne doit pas non plus les renvoyer.
const removedBySync = new Set<string>();

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
  removedBySync.clear();
}

type State = ReturnType<typeof useZustandStore.getState>;

const rejectionKey = (kind: SyncRejection['kind'], id: string) => `${kind}:${id}`;

// `updated_at` (en ms) de chaque item non synchronisé, par clé `kind:id`.
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

// Retire de l'alerte les refus dont l'item a été modifié de nouveau en local : cette nouvelle
// version va être envoyée. Un item remplacé par la version serveur (is_synced = true) garde son
// refus : la modification de l'utilisateur est bien perdue.
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
    dropSupersededRejections();
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

    // Refus : on arrête de repousser la version refusée. On ne touche pas à la donnée locale — le
    // serveur ne renvoie pas sa version (ce serait exposer la fiche d'un tiers), donc on n'a rien
    // pour la corriger ici. Elle le sera dès que la ligne serveur bougera légitimement et reviendra
    // dans un delta, mergeItems étant server-wins.
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
          // les items ajoutés par le serveur (intermédiaires, fiche) ne sont pas dans `rejected`
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
