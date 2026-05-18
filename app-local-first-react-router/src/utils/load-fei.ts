import dayjs from 'dayjs';
import type { FeiResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore, { hydrationPromise } from '@app/zustand/store';
import { getFeiAndCarcasseAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/fei-intermediaire';
import API from '@app/services/api';
import type { FeiForRefresh } from '@api/src/types/fei';

export async function loadFei(fei_numero: string) {
  await hydrationPromise;
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
    if (!existing) {
      prevState.entities[entity.id] = {
        ...entity,
        relation: 'NONE',
        relationStatus: undefined,
      } satisfies EntityWithUserRelation;
    }
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
      is_synced: newestFei.is_synced,
    };
  }

  for (const carcasse of fei.Carcasses) {
    const localCarcasse = prevState.carcasses[carcasse.zacharie_carcasse_id];
    // Strip the nested CarcasseModificationRequests before storing — they have their own map.
    // (typed loose: the populated payload carries the array, the bare Carcasse type does not)
    const carcasseBare = (() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { CarcasseModificationRequests: _ignored, ...rest } = carcasse as typeof carcasse & {
        CarcasseModificationRequests?: unknown;
      };
      return rest as typeof carcasse;
    })();
    if (!localCarcasse) {
      prevState.carcasses[carcasse.zacharie_carcasse_id] = carcasseBare;
    } else {
      const newestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasseBare.updated_at) > 0 ? localCarcasse : carcasseBare;
      const oldestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasseBare.updated_at) > 0 ? carcasseBare : localCarcasse;

      prevState.carcasses[carcasse.zacharie_carcasse_id] = {
        ...oldestCarcasse,
        ...newestCarcasse,
        is_synced: newestCarcasse.is_synced,
      };
    }

    // Extract modification requests into their own map.
    const carcasseWithModRequests = carcasse as typeof carcasse & {
      CarcasseModificationRequests?: Array<{
        id: string;
        updated_at: Date | string;
      } & Record<string, unknown>>;
    };
    const modRequests = carcasseWithModRequests.CarcasseModificationRequests ?? [];
    for (const modRequest of modRequests) {
      const existing = prevState.carcasseModificationRequestsById[modRequest.id];
      const incoming = modRequest as unknown as (typeof prevState.carcasseModificationRequestsById)[string];
      if (!existing) {
        prevState.carcasseModificationRequestsById[modRequest.id] = incoming;
      } else {
        const incomingNewer = dayjs(incoming.updated_at).diff(existing.updated_at) > 0;
        prevState.carcasseModificationRequestsById[modRequest.id] = incomingNewer ? incoming : existing;
      }
    }
  }

  for (const carcasseIntermediaire of fei.CarcasseIntermediaire || []) {
    const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(
      carcasseIntermediaire
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
        is_synced: newestCarcasseIntermediaire.is_synced,
      };
    }
  }

  useZustandStore.setState(prevState, true);
}
