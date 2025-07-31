import type { UserMyRelationsResponse } from '@api/src/types/responses';
import type { UserForFei } from '@api/src/types/user';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import { EntityRelationType } from '@prisma/client';
import API from '@app/services/api';

export async function loadMyRelations() {
  const isOnline = useZustandStore.getState().isOnline;
  console.log('chargement relations ?', isOnline);
  if (!isOnline) {
    console.log('not loading relations because not online');
    return;
  }
  try {
    // we call myRelations
    // for the offline mode to work properly
    const myRelationsData = await API.get({ path: 'user/my-relations' }).then(
      (res) => res as UserMyRelationsResponse,
    );

    const entities: Record<EntityWithUserRelation['id'], EntityWithUserRelation> = {};
    const entitiesIdsWorkingDirectlyFor: Array<EntityWithUserRelation['id']> = [];

    for (const entity of [
      ...(myRelationsData.data?.associationsDeChasse || []),
      ...(myRelationsData.data?.ccgs || []),
      ...(myRelationsData.data?.collecteursPro || []),
      ...(myRelationsData.data?.etgs || []),
      ...(myRelationsData.data?.svis || []),
      ...(myRelationsData.data?.entitiesWorkingFor || []),
    ]) {
      entities[entity.id] = entity;
      if (entity.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        entitiesIdsWorkingDirectlyFor.push(entity.id);
      }
    }

    useZustandStore.setState({
      entities,
      entitiesIdsWorkingDirectlyFor,
      ccgsIds: myRelationsData.data?.ccgs.map((ccg) => ccg.id) || [],
      collecteursProIds: myRelationsData.data?.collecteursPro.map((collecteurPro) => collecteurPro.id) || [],
      etgsIds: myRelationsData.data?.etgs.map((etg) => etg.id) || [],
      svisIds: myRelationsData.data?.svis.map((svi) => svi.id) || [],
    });

    const detenteursInitiaux: Record<UserForFei['id'], UserForFei> = {};
    const users = useZustandStore.getState().users;

    for (const detenteurInitial of [...(myRelationsData.data?.detenteursInitiaux || [])]) {
      detenteursInitiaux[detenteurInitial.id] = detenteurInitial;
      users[detenteurInitial.id] = detenteurInitial;
    }

    useZustandStore.setState({ detenteursInitiaux, users });

    console.log('chargement relations fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}
