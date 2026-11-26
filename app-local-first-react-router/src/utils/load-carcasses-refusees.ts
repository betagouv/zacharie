import type { CarcassesRefuseesResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { mergeItems } from './merge-fetched-items';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';

export async function loadCarcassesRefusees(feiNumero: string) {
  if (!feiNumero) return;
  if (!useZustandStore.getState().isOnline) return;

  const res = (await API.get({ path: `/carcasse/refusees/${feiNumero}` }).then((r) => r)) as
    | CarcassesRefuseesResponse
    | undefined;
  if (!res?.ok || !res.data) return;
  if (!useUser.getState().user) return;

  const { carcasses, carcassesIntermediaires, entities } = res.data;
  if (!carcasses.length) return;

  const newCarcasses = mergeItems({
    oldItems: Object.values(useZustandStore.getState().carcasses) || [],
    newItems: carcasses,
    idKey: (c) => c.zacharie_carcasse_id,
  });

  const newCarcassesIntermediaires = mergeItems({
    oldItems: Object.values(useZustandStore.getState().carcassesIntermediaireById) || [],
    newItems: carcassesIntermediaires,
    idKey: getFeiAndCarcasseAndIntermediaireIds,
  });

  const newEntities = { ...useZustandStore.getState().entities };
  for (const entity of entities) {
    if (!entity.deleted_at && !newEntities[entity.id]) {
      newEntities[entity.id] = entity;
    }
  }

  useZustandStore.setState(() => ({
    carcasses: newCarcasses,
    carcassesIntermediaireById: newCarcassesIntermediaires,
    entities: newEntities,
  }));
}
