import type { UserMyRelationsResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';

export async function loadMyRelations() {
  const isOnline = useZustandStore.getState().isOnline;
  console.log('chargement relations ?', isOnline);
  if (!isOnline) {
    console.log('not loading relations because not online');
    return;
  }
  try {
    const myRelationsData = await API.get({ path: 'user/my-relations' }).then(
      (res) => res as UserMyRelationsResponse,
    );

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

    useZustandStore.setState({ entities, users, detenteursInitiauxIds });

    console.log('chargement relations fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}
