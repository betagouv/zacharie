import type { UserMyRelationsResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import { EntityRelationType } from '@prisma/client';
import useZustandStore, { hydrationPromise } from '@app/zustand/store';
import API from '@app/services/api';
import useUser from '@app/zustand/user';
import { isLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';

let loadMyRelationsAbortController: AbortController | null = null;

export function abortLoadMyRelations(reason: string = 'aborted') {
  if (loadMyRelationsAbortController && !loadMyRelationsAbortController.signal.aborted) {
    loadMyRelationsAbortController.abort(reason);
  }
  loadMyRelationsAbortController = null;
}

export async function loadMyRelations() {
  // on attend le store local : sinon le résultat serait écrasé par la réhydratation
  await hydrationPromise;
  if (isLocalTeardownInProgress()) {
    console.log('not loading relations because local state is being cleared');
    return;
  }
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
      (res) => res as UserMyRelationsResponse | { ok: false }
    );
    // API.get ne lève pas d'erreur : en cas d'échec on garde les relations déjà en mémoire
    if (signal.aborted || !myRelationsData.ok) return;

    // Seed with the entities referenced by fiches only (relation NONE, loaded by load-carcasses). The
    // user's own relations come from the server alone: one the server no longer returns (entity
    // deleted by an admin, relation removed) leaves the store and the pickers.
    const entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation> = {};
    for (const entity of Object.values(useZustandStore.getState().entities)) {
      if (entity.relation === EntityRelationType.NONE) {
        entities[entity.id] = entity;
      }
    }
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

    const users = { ...useZustandStore.getState().users };
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
