import { useEffect, useRef } from 'react';

import { EntityRelationType, EntityRelationStatus, User, UserRoles } from '@prisma/client';
import type { EntityWithUserRelations } from '@api/src/types/entity';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { useSearchParams } from 'react-router';
import useUser from '@app/zustand/user';
import RelationEntityUser from './RelationEntityUser';

interface RelationEntityUserProps {
  entity: EntityWithUserRelations;
  refreshKey?: number;
  user: User;
  onChange?: () => void;
}

export default function RelationEntityUsersList({
  entity,
  refreshKey,
  user,
  onChange,
}: RelationEntityUserProps) {
  const [searchParams] = useSearchParams();
  const entityUsersModal = useRef(
    createModal({
      id: `entity-users-modal-${entity.id}`,
      isOpenedByDefault: false,
    }),
  ).current;
  const isOpen = useIsModalOpen(entityUsersModal);

  const iAmAdmin = useUser((state) => state.user?.roles.includes(UserRoles.ADMIN));

  // const canTransmitCarcassesForEntity = entity.EntityRelationsWithUsers.find(
  //   (relation) =>
  //     relation.owner_id === user.id &&
  //     relation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
  // );
  const canHandleCarcassesForEntity = entity.EntityRelationsWithUsers?.find(
    (relation) =>
      relation.owner_id === user.id &&
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
  );

  const isAdminOfEntity = !canHandleCarcassesForEntity
    ? false
    : canHandleCarcassesForEntity.status === EntityRelationStatus.ADMIN &&
      canHandleCarcassesForEntity.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY;

  useEffect(() => {
    if (
      isAdminOfEntity &&
      entityUsersModal?.open &&
      searchParams.get('open-entity') === entity.id.toString() &&
      !isOpen
    ) {
      setTimeout(() => {
        entityUsersModal.open?.();
        searchParams.delete('open-entity');
      }, 100);
    }
  }, [searchParams, entityUsersModal, entity.id, isAdminOfEntity, isOpen]);

  return (
    <div>
      {entity.EntityRelationsWithUsers.sort((a, b) => {
        const userA = `${a.UserRelatedWithEntity.prenom} ${a.UserRelatedWithEntity.nom_de_famille}`;
        const userB = `${b.UserRelatedWithEntity.prenom} ${b.UserRelatedWithEntity.nom_de_famille}`;
        return userA.localeCompare(userB);
      }).map((otherUserRelation) => {
        if (otherUserRelation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) {
          return null;
        }
        return (
          <RelationEntityUser
            key={otherUserRelation.id}
            entity={entity}
            user={otherUserRelation.UserRelatedWithEntity as User}
            enableUsersView={false}
            displayEntity={false}
            displayUser={true}
            onChange={onChange}
            refreshKey={refreshKey}
            canApproveRelation={iAmAdmin || isAdminOfEntity}
            canDelete={iAmAdmin || isAdminOfEntity}
          />
        );
      })}
    </div>
  );
}
