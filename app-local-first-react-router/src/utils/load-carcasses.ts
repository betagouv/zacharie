import type { CarcassesGetResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';
import { CarcasseModificationRequestStatus } from '@prisma/client';

export async function loadCarcasses() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading carcasses because not online');
    return;
  }

  // Read server time before pagination so any carcasse touched during the loop
  // is picked up on the next delta sync.
  const serverDate = await API.get({ path: 'now' }).then((res) => (res.ok ? res.data : null));

  const after = String(useZustandStore.getState().lastUpdateFromServer);
  const carcassesFetched: CarcassesGetResponse['data']['carcasses'] = [];
  const feisFetched: CarcassesGetResponse['data']['feis'] = [];
  const carcassesIntermediairesFetched: CarcassesGetResponse['data']['carcassesIntermediaires'] = [];
  const carcasseModifRequests: CarcassesGetResponse['data']['carcasseModifRequests'] = [];
  const usersFetched: CarcassesGetResponse['data']['users'] = [];
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
    }).then((r) => r as CarcassesGetResponse);
    if (!res.ok) return null;

    carcassesFetched.push(...(res.data.carcasses || []));
    feisFetched.push(...(res.data.feis || []));
    usersFetched.push(...(res.data.users || []));
    carcasseModifRequests.push(...(res.data.carcasseModifRequests || []));
    carcassesIntermediairesFetched.push(...(res.data.carcassesIntermediaires || []));
    hasMore = res.data.hasMore;
    page += 1;
  }

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

  const nextCarcasseModifPendingByCarcasseId = {
    ...useZustandStore.getState().carcasseModifActiveByCarcasseId,
  };
  for (const carcasseModifRequest of carcasseModifRequests) {
    if (carcasseModifRequest.deleted_at) {
      delete nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id];
    } else if (carcasseModifRequest.status === CarcasseModificationRequestStatus.PENDING) {
      nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id] = carcasseModifRequest;
    } else {
      delete nextCarcasseModifPendingByCarcasseId[carcasseModifRequest.zacharie_carcasse_id];
    }
  }

  useZustandStore.setState(() => ({
    carcasses: newCarcasses,
    carcassesRegistry: Object.values(newCarcasses),
    feis: newFeis,
    carcassesIntermediaireById: newCarcassesIntermediaires,
    carcasseModifActiveByCarcasseId: nextCarcasseModifPendingByCarcasseId,
    users: newUsers,
    lastUpdateFromServer: serverDate,
  }));
}
