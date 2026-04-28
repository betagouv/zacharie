import type { CarcassesGetForRegistryResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { UserRoles } from '@prisma/client';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';

const PAGE_SIZE = 1000;
// Bump this constant to force a one-shot full re-sync on all existing clients
// (e.g. after fixing a bug that left local stores incomplete).
const CARCASSES_REGISTRY_SYNC_VERSION = 1;

export async function loadCarcasses(role: UserRoles) {
  const state = useZustandStore.getState();
  if (!state.isOnline) {
    console.log('not loading fei because not online');
    return;
  }

  // Read server time before pagination so any carcasse touched during the loop
  // is picked up on the next delta sync.
  const serverDate = await API.get({ path: 'now' }).then((res) => (res.ok ? res.data : null));

  const needsFullSync = state.carcassesRegistrySyncVersion < CARCASSES_REGISTRY_SYNC_VERSION;
  const after = needsFullSync ? '0' : String(state.lastUpdateCarcassesRegistry);

  const fetched: CarcassesGetForRegistryResponse['data']['carcasses'] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await API.get({
      path: `carcasse/${role.toLocaleLowerCase()}`,
      query: {
        after,
        withDeleted: 'true',
        page: String(page),
        limit: String(PAGE_SIZE),
      },
    }).then((r) => r as CarcassesGetForRegistryResponse);
    if (!res.ok) return null;

    fetched.push(...(res.data.carcasses || []));
    hasMore = res.data.hasMore;
    page += 1;
  }

  const newRegistry = needsFullSync
    ? fetched.filter((c) => !c.deleted_at)
    : mergeItems({
        oldItems: useZustandStore.getState().carcassesRegistry || [],
        newItems: fetched,
        idKey: 'zacharie_carcasse_id',
      });

  useZustandStore.setState(() => ({
    carcassesRegistry: newRegistry,
    lastUpdateCarcassesRegistry: serverDate,
    carcassesRegistrySyncVersion: CARCASSES_REGISTRY_SYNC_VERSION,
  }));

  return fetched;
}
