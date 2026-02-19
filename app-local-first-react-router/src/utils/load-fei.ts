import dayjs from 'dayjs';
import type { FeiResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/fei-intermediaire';
import API from '@app/services/api';
import type { FeiForRefresh } from '@api/src/types/fei';

export async function loadFei(fei_numero: string) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading fei because not online');
    return;
  }
  const feiResponse = await API.get({ path: `fei/${fei_numero}` }).then((res) => res as FeiResponse);
  if (!feiResponse.ok) {
    return null;
  }

  const prevState = useZustandStore.getState();
  for (const user of feiResponse.data.users) {
    prevState.users[user.id] = user;
  }
  for (const entity of feiResponse.data.entities) {
    const existing = prevState.entities[entity.id];
    prevState.entities[entity.id] = {
      ...existing,
      ...entity,
      relation: existing?.relation ?? 'NONE',
      relationStatus: existing?.relationStatus ?? undefined,
    } satisfies EntityWithUserRelation;
  }
  useZustandStore.setState(prevState, true);

  setFeiInStore(feiResponse.data.fei!);
  return feiResponse.data.fei!;
}

export function setFeiInStore(fei: FeiForRefresh) {
  const prevState = useZustandStore.getState();

  const localFei = prevState.feis[fei.numero];
  if (!localFei) {
    prevState.feis[fei.numero] = fei;
  } else {
    const newestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? localFei : fei;
    const oldestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? fei : localFei;

    prevState.feis[fei.numero] = {
      ...oldestFei,
      ...newestFei,
      is_synced: true,
    };
  }

  for (const carcasse of fei.Carcasses) {
    const localCarcasse = prevState.carcasses[carcasse.zacharie_carcasse_id];
    if (!localCarcasse) {
      prevState.carcasses[carcasse.zacharie_carcasse_id] = carcasse;
    } else {
      const newestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasse.updated_at) > 0 ? localCarcasse : carcasse;
      const oldestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasse.updated_at) > 0 ? carcasse : localCarcasse;

      prevState.carcasses[carcasse.zacharie_carcasse_id] = {
        ...oldestCarcasse,
        ...newestCarcasse,
        is_synced: true,
      };
    }
  }

  for (const carcasseIntermediaire of fei.CarcasseIntermediaire || []) {
    const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(
      carcasseIntermediaire,
    ) as FeiAndCarcasseAndIntermediaireIds;

    const localCarcasseIntermediaire = prevState.carcassesIntermediaireById[feiAndCarcasseAndIntermediaireId];

    if (!localCarcasseIntermediaire) {
      prevState.carcassesIntermediaireById[feiAndCarcasseAndIntermediaireId] = carcasseIntermediaire;
    } else {
      const newestCarcasseIntermediaire =
        dayjs(localCarcasseIntermediaire.updated_at).diff(carcasseIntermediaire.updated_at) > 0
          ? localCarcasseIntermediaire
          : carcasseIntermediaire;
      const oldestCarcasseIntermediaire =
        dayjs(localCarcasseIntermediaire.updated_at).diff(carcasseIntermediaire.updated_at) > 0
          ? carcasseIntermediaire
          : localCarcasseIntermediaire;
      prevState.carcassesIntermediaireById[feiAndCarcasseAndIntermediaireId] = {
        ...oldestCarcasseIntermediaire,
        ...newestCarcasseIntermediaire,
        is_synced: true,
      };
    }
  }

  useZustandStore.setState(prevState, true);
}
