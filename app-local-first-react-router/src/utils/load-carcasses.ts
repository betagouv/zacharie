import type { CarcassesGetResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';
import { CarcasseModificationRequestStatus } from '@prisma/client';
import useUser from '@app/zustand/user';

let loadCarcassesAbortController: AbortController | null = null;

export function abortLoadCarcasses(reason: string = 'aborted') {
  if (loadCarcassesAbortController && !loadCarcassesAbortController.signal.aborted) {
    loadCarcassesAbortController.abort(reason);
  }
  loadCarcassesAbortController = null;
}

export async function loadCarcasses() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading carcasses because not online');
    return;
  }

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

    const after = String(useZustandStore.getState().lastUpdateFromServer);
    const carcassesFetched: CarcassesGetResponse['data']['carcasses'] = [];
    const feisFetched: CarcassesGetResponse['data']['feis'] = [];
    const carcassesIntermediairesFetched: CarcassesGetResponse['data']['carcassesIntermediaires'] = [];
    const carcasseModifRequests: CarcassesGetResponse['data']['carcasseModifRequests'] = [];
    const usersFetched: CarcassesGetResponse['data']['users'] = [];
    const entitiesFetched: CarcassesGetResponse['data']['entities'] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await API.get({
        path: '/carcasse',
        query: {
          after,
          withDeleted: 'true',
          page: `${page}`,
          limit: '5000',
        },
        signal,
      }).then((r) => r as CarcassesGetResponse);
      if (signal.aborted) return;
      if (!res.ok) return null;

      carcassesFetched.push(...(res.data.carcasses || []));
      feisFetched.push(...(res.data.feis || []));
      usersFetched.push(...(res.data.users || []));
      entitiesFetched.push(...(res.data.entities || []));
      carcasseModifRequests.push(...(res.data.carcasseModifRequests || []));
      carcassesIntermediairesFetched.push(...(res.data.carcassesIntermediaires || []));
      hasMore = res.data.hasMore;
      page += 1;
    }

    // Guard against logout/abort races: don't clobber a freshly-reset store.
    if (signal.aborted || !useUser.getState().user) return;

    if (carcassesFetched.length === 0) {
      console.log('no carcasses fetched');
      useZustandStore.setState(() => ({
        lastUpdateFromServer: serverDate,
      }));
      return;
    }

    const newCarcasses = mergeItems({
      oldItems: Object.values(useZustandStore.getState().carcasses) || [],
      newItems: carcassesFetched,
      idKey: (c) => c.zacharie_carcasse_id,
    });

    const newFeis = mergeItems({
      oldItems: Object.values(useZustandStore.getState().feis) || [],
      newItems: feisFetched,
      idKey: (c) => c.numero,
    });

    const newCarcassesIntermediaires = mergeItems({
      oldItems: Object.values(useZustandStore.getState().carcassesIntermediaireById) || [],
      newItems: carcassesIntermediairesFetched,
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

    const nextCarcasseModifPendingByCarcasseId = {
      ...useZustandStore.getState().carcasseModifActiveByCarcasseId,
    };
    for (const carcasseModifRequest of carcasseModifRequests) {
      if (carcasseModifRequest.deleted_at) {
        delete nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id];
      } else if (carcasseModifRequest.status === CarcasseModificationRequestStatus.PENDING) {
        nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id] =
          carcasseModifRequest;
      } else {
        delete nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id];
      }
    }

    if (signal.aborted || !useUser.getState().user) return;

    useZustandStore.setState(() => ({
      carcasses: newCarcasses,
      carcassesRegistry: Object.values(newCarcasses),
      feis: newFeis,
      carcassesIntermediaireById: newCarcassesIntermediaires,
      carcasseModifActiveByCarcasseId: nextCarcasseModifPendingByCarcasseId,
      users: newUsers,
      entities: newEntities,
      lastUpdateFromServer: serverDate,
    }));
  } finally {
    if (loadCarcassesAbortController?.signal === signal) {
      loadCarcassesAbortController = null;
    }
  }
}
