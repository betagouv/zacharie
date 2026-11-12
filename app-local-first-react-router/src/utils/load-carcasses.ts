import type { CarcassesCountResponse, CarcassesGetResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';
import { UserRoles, type CarcasseModificationRequest } from '@prisma/client';
import useUser from '@app/zustand/user';
import { capture } from '@app/services/sentry';
import { isLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { dropMarginOverwrites, getDeltaAfter } from './delta-margin';

let loadCarcassesAbortController: AbortController | null = null;

const ROLES_WITHOUT_CARCASSES: UserRoles[] = [UserRoles.FEDERATION, UserRoles.LABORATOIRE];

// Contrôle d'intégrité store local / serveur : au plus une fois par utilisateur toutes les 6 heures.
const INTEGRITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastIntegrityCheck: { userId: string; at: number } | null = null;
// Le prochain pull demande tout le périmètre (version de rechargement inférieure à toute version serveur).
let fullReloadRequested = false;

// Compare le nombre de carcasses non supprimées du périmètre serveur au nombre de carcasses non
// supprimées synchronisées du store. Le pull delta ne renvoie que le périmètre actuel : une carcasse
// qui en est sortie (renvoi fait sur un autre appareil, destinataire changé par l'expéditeur) reste en
// local. En cas d'écart, on remonte à Sentry et on recharge tout le périmètre, ce qui retire ces copies.
async function checkLocalCarcassesIntegrity(signal: AbortSignal) {
  const user = useUser.getState().user;
  if (!user) return;
  if (
    lastIntegrityCheck?.userId === user.id &&
    Date.now() - lastIntegrityCheck.at < INTEGRITY_CHECK_INTERVAL_MS
  ) {
    return;
  }
  lastIntegrityCheck = { userId: user.id, at: Date.now() };

  const res = (await API.get({ path: '/carcasse/count', signal })) as CarcassesCountResponse;
  if (signal.aborted || !res.ok || !res.data || useUser.getState().user?.id !== user.id) return;

  const state = useZustandStore.getState();
  const localCarcasses = Object.values(state.carcasses).filter((c) => !c.deleted_at);
  // des modifications locales en attente fausseraient la comparaison
  if (localCarcasses.some((c) => !c.is_synced)) return;

  const serverCount = res.data.count;
  const localCount = localCarcasses.length;
  if (serverCount === localCount) return;

  capture('Écart entre le nombre de carcasses du serveur et du store local', {
    extra: {
      serverCount,
      localCount,
      lastUpdateFromServer: state.lastUpdateFromServer,
      role: user.roles.join(', '),
    },
    tags: {
      integrity_gap: serverCount > localCount ? 'manquantes_localement' : 'en_trop_localement',
    },
  });
  fullReloadRequested = true;
  loadCarcasses();
}

export function abortLoadCarcasses(reason: string = 'aborted') {
  if (loadCarcassesAbortController && !loadCarcassesAbortController.signal.aborted) {
    loadCarcassesAbortController.abort(reason);
  }
  loadCarcassesAbortController = null;
}

export async function loadCarcasses() {
  if (isLocalTeardownInProgress()) {
    console.log('not loading carcasses because local state is being cleared');
    return;
  }
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading carcasses because not online');
    return;
  }
  // ces rôles n'ont pas de périmètre carcasses : l'API répondrait 403
  const roles = useUser.getState().user?.roles ?? [];
  if (roles.some((role) => ROLES_WITHOUT_CARCASSES.includes(role))) return;

  if (loadCarcassesAbortController && !loadCarcassesAbortController.signal.aborted) {
    loadCarcassesAbortController.abort('new load requested');
  }
  loadCarcassesAbortController = new AbortController();
  const signal = loadCarcassesAbortController.signal;

  try {
    // Read server time before pagination so any carcasse touched during the loop
    // is picked up on the next delta sync.
    const serverDate = await API.get({ path: 'now', signal }).then((res) => (res.ok ? res.data : null));
    if (signal.aborted) return;

    const lastUpdateFromServer = useZustandStore.getState().lastUpdateFromServer;
    const after = String(getDeltaAfter(lastUpdateFromServer));
    const reloadVersion = fullReloadRequested
      ? '-1'
      : String(useZustandStore.getState().carcassesReloadVersion);
    const carcassesFetched: CarcassesGetResponse['data']['carcasses'] = [];
    const feisFetched: CarcassesGetResponse['data']['feis'] = [];
    const carcassesIntermediairesFetched: CarcassesGetResponse['data']['carcassesIntermediaires'] = [];
    const carcasseModifRequests: CarcassesGetResponse['data']['carcasseModifRequests'] = [];
    const usersFetched: CarcassesGetResponse['data']['users'] = [];
    const entitiesFetched: CarcassesGetResponse['data']['entities'] = [];
    let page = 0;
    let hasMore = true;
    let fullReload = false;
    let receivedReloadVersion = 0;

    while (hasMore) {
      const res = await API.get({
        path: '/carcasse',
        query: {
          after,
          withDeleted: 'true',
          page: `${page}`,
          limit: '5000',
          reloadVersion,
        },
        signal,
      }).then((r) => r as CarcassesGetResponse);
      if (signal.aborted) return;
      if (!res.ok || !res.data) return null;

      carcassesFetched.push(...(res.data.carcasses || []));
      feisFetched.push(...(res.data.feis || []));
      usersFetched.push(...(res.data.users || []));
      entitiesFetched.push(...(res.data.entities || []));
      carcasseModifRequests.push(...(res.data.carcasseModifRequests || []));
      carcassesIntermediairesFetched.push(...(res.data.carcassesIntermediaires || []));
      hasMore = res.data.hasMore;
      if (page === 0) {
        fullReload = res.data.fullReload;
        receivedReloadVersion = res.data.reloadVersion;
        if (fullReload) fullReloadRequested = false;
      }
      page += 1;
    }

    // Guard against logout/abort races: don't clobber a freshly-reset store.
    if (signal.aborted || !useUser.getState().user) return;

    if (carcassesFetched.length === 0 && feisFetched.length === 0 && !fullReload) {
      console.log('no carcasses nor feis fetched');
      useZustandStore.setState(() => ({
        lastUpdateFromServer: serverDate,
        carcassesReloadVersion: receivedReloadVersion,
      }));
      checkLocalCarcassesIntegrity(signal);
      return;
    }

    // Rechargement complet : le serveur a renvoyé tout le périmètre, les copies locales absentes de
    // la réponse sont sorties du périmètre. On ne garde que les modifications locales pas encore synchronisées
    // (fiches, carcasses, CarcasseIntermediaire, demandes de modification).
    const keepLocal = <T extends { is_synced: boolean }>(items: Array<T>) =>
      fullReload ? items.filter((item) => !item.is_synced) : items;

    // Hors rechargement complet : les lignes revenues seulement à cause de la marge du delta
    // n'écrasent pas une modification locale pas encore envoyée.
    const guardMargin = <T extends { updated_at: Date | string; is_synced: boolean }>(
      fetched: Array<T>,
      local: Record<string, T | undefined>,
      idKey: (item: T) => string
    ) => (fullReload ? fetched : dropMarginOverwrites({ fetched, local, lastUpdateFromServer, idKey }));
    const localState = useZustandStore.getState();
    const localModifRequestsById: Record<string, CarcasseModificationRequest> = {};
    for (const request of Object.values(localState.modifRequestsByCarcasseId).flat()) {
      localModifRequestsById[request.id] = request;
    }

    const newCarcasses = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().carcasses)),
      newItems: guardMargin(carcassesFetched, localState.carcasses, (c) => c.zacharie_carcasse_id),
      idKey: (c) => c.zacharie_carcasse_id,
    });

    const newFeis = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().feis)),
      newItems: feisFetched,
      idKey: (c) => c.numero,
    });

    const newCarcassesIntermediaires = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().carcassesIntermediaireById)),
      newItems: guardMargin(
        carcassesIntermediairesFetched,
        localState.carcassesIntermediaireById,
        getFeiAndCarcasseAndIntermediaireIds
      ),
      idKey: getFeiAndCarcasseAndIntermediaireIds,
    });

    const newUsers = mergeItems({
      oldItems: Object.values(useZustandStore.getState().users) || [],
      newItems: usersFetched,
      idKey: (c) => c.id,
    });

    // Entities referenced by the fiches (premier détenteur asso, dépôt, SVI…). Fill gaps only:
    // existing store entities (loaded by load-my-relations) keep their relation metadata, since
    // fiche entities carry relation NONE.
    const newEntities = { ...useZustandStore.getState().entities };
    for (const entity of entitiesFetched) {
      if (!entity.deleted_at && !newEntities[entity.id]) {
        newEntities[entity.id] = entity;
      }
    }

    // Merge modif requests by their own id (drops cancelled ones via deleted_at, like other entities),
    // then regroup into the full-history-by-carcasse map the store and UI consume.
    const mergedModifRequestsById = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().modifRequestsByCarcasseId).flat()),
      newItems: guardMargin(carcasseModifRequests, localModifRequestsById, (r) => r.id),
      idKey: (r) => r.id,
    });
    const nextModifRequestsByCarcasseId: Record<string, Array<CarcasseModificationRequest>> = {};
    for (const request of Object.values(mergedModifRequestsById) as Array<CarcasseModificationRequest>) {
      (nextModifRequestsByCarcasseId[request.zacharie_carcasse_id] ??= []).push(request);
    }

    if (signal.aborted || !useUser.getState().user) return;

    // Le serveur ne renvoie que les carcasses du périmètre du compte. Une fiche qu'il avait renvoyée
    // à l'expéditeur et qui redescend lui a donc été réattribuée : elle doit réapparaître.
    const feiNumerosBackInScope = new Set(carcassesFetched.map((c) => c.fei_numero));

    useZustandStore.setState((state) => ({
      carcasses: newCarcasses,
      feiIdsRenvoiToHide: state.feiIdsRenvoiToHide.filter(
        (fei_numero) => !feiNumerosBackInScope.has(fei_numero)
      ),
      feis: newFeis,
      carcassesIntermediaireById: newCarcassesIntermediaires,
      modifRequestsByCarcasseId: nextModifRequestsByCarcasseId,
      users: newUsers,
      entities: newEntities,
      lastUpdateFromServer: serverDate,
      carcassesReloadVersion: receivedReloadVersion,
    }));
    checkLocalCarcassesIntegrity(signal);
  } finally {
    if (loadCarcassesAbortController?.signal === signal) {
      loadCarcassesAbortController = null;
    }
  }
}
