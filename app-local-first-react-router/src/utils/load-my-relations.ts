import type { UserMyRelationsResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';
import useUser from '@app/zustand/user';

let loadMyRelationsAbortController: AbortController | null = null;

export function abortLoadMyRelations(reason: string = 'aborted') {
  if (loadMyRelationsAbortController && !loadMyRelationsAbortController.signal.aborted) {
    loadMyRelationsAbortController.abort(reason);
  }
  loadMyRelationsAbortController = null;
}

export async function loadMyRelations() {
  const isOnline = useZustandStore.getState().isOnline;
  console.log('chargement relations ?', isOnline);
  if (!isOnline) {
    console.log('not loading relations because not online');
    return;
  }

  if (loadMyRelationsAbortController && !loadMyRelationsAbortController.signal.aborted) {
    loadMyRelationsAbortController.abort('new load requested');
  }
  loadMyRelationsAbortController = new AbortController();
  const signal = loadMyRelationsAbortController.signal;

  try {
    const myRelationsData = await API.get({ path: 'user/my-relations', signal }).then(
      (res) => res as UserMyRelationsResponse
    );
    if (signal.aborted) return;

    const entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation> = {};
    for (const entity of [
      ...(myRelationsData.data?.associationsDeChasse || []),
      ...(myRelationsData.data?.ccgs || []),
      ...(myRelationsData.data?.collecteursPro || []),
      ...(myRelationsData.data?.etgs || []),
      ...(myRelationsData.data?.svis || []),
      ...(myRelationsData.data?.circuitCourt || []),
      ...(myRelationsData.data?.entitiesICanHandleCarcassOnBehalf || []),
    ]) {
      if (!entity.deleted_at) {
        entities[entity.id] = entity;
      }
    }

    const users = useZustandStore.getState().users;
    const detenteursInitiauxIds: string[] = [];
    for (const detenteurInitial of myRelationsData.data?.detenteursInitiaux || []) {
      detenteursInitiauxIds.push(detenteurInitial.id);
      users[detenteurInitial.id] = detenteurInitial;
    }

    if (signal.aborted || !useUser.getState().user) return;

    useZustandStore.setState({ entities, users, detenteursInitiauxIds });

    console.log('chargement relations fini');
  } catch (error) {
    if (signal.aborted) return;
    console.error('Error fetching data:', error);
    return null;
  } finally {
    if (loadMyRelationsAbortController?.signal === signal) {
      loadMyRelationsAbortController = null;
    }
  }
}
