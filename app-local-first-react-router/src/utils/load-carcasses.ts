import type { CarcassesGetForRegistryResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { UserRoles } from '@prisma/client';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';

export async function loadCarcasses(role: UserRoles) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading fei because not online');
    return;
  }

  // Get date from server before downloading the data
  // We'll set the `lastUpdateCarcassesRegistry` to this date after all the data is downloaded
  const serverDate = await API.get({ path: 'now' }).then((res) => (res.ok ? res.data : null));

  const carcassesData = await API.get({
    path: `fei-carcasse/${role.toLocaleLowerCase()}`,
    query: {
      after: String(useZustandStore.getState().lastUpdateCarcassesRegistry),
      withDeleted: 'true',
    },
  }).then((res) => res as CarcassesGetForRegistryResponse);
  if (!carcassesData.ok) {
    return null;
  }

  const newCarcassesRegistry = mergeItems({
    oldItems: useZustandStore.getState().carcassesRegistry || [],
    newItems: carcassesData.data.carcasses || [],
    idKey: 'zacharie_carcasse_id',
  });

  useZustandStore.setState(() => ({
    carcassesRegistry: newCarcassesRegistry,
    lastUpdateCarcassesRegistry: serverDate,
  }));

  return carcassesData.data.carcasses;
}
