import { useEffect, useRef, useState } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { EntityRelationType, EntityRelationStatus, User, Prisma } from '@prisma/client';
import type { EntityWithUserRelations } from '@api/src/types/entity';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import API from '@app/services/api';
import { Link, useSearchParams } from 'react-router';
import SelectCustom from './SelectCustom';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import RelationEntityUsersList from './RelationEntityUsersList';
import useUser from '@app/zustand/user';

interface RelationEntityUserProps {
  entity: EntityWithUserRelations;
  refreshKey?: number;
  user: User;
  relationType?: EntityRelationType;
  enableUsersView?: boolean;
  canApproveRelation?: boolean;
  onChange?: () => void;
  userLink?: string;
  entityLink?: string;
  displayEntity?: boolean;
  displayUser?: boolean;
  canDelete?: boolean;
}

export default function RelationEntityUser({
  entity,
  refreshKey,
  user,
  enableUsersView = false,
  canApproveRelation = false,
  relationType,
  onChange,
  userLink,
  entityLink,
  displayEntity = true,
  displayUser = false,
  canDelete = false,
}: RelationEntityUserProps) {
  const me = useUser((state) => state.user)!;
  const [searchParams] = useSearchParams();
  const entityUsersModal = useRef(
    createModal({
      id: `entity-users-modal-${entity.id}`,
      isOpenedByDefault: false,
    })
  ).current;
  const isOpen = useIsModalOpen(entityUsersModal);

  // const canTransmitCarcassesForEntity = entity.EntityRelationsWithUsers.find(
  //   (relation) =>
  //     relation.owner_id === user.id &&
  //     relation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
  // );
  const canHandleCarcassesForEntity = entity.EntityRelationsWithUsers?.find(
    (relation) =>
      relation.owner_id === user.id &&
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
  );
  const relationsToApprove = entity.EntityRelationsWithUsers?.filter(
    (relation) =>
      relation.status === EntityRelationStatus.REQUESTED &&
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
  );

  const isAdminOfEntity = !canHandleCarcassesForEntity
    ? false
    : canHandleCarcassesForEntity.status === EntityRelationStatus.ADMIN &&
      canHandleCarcassesForEntity.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY;

  const myRelationIsPending = !canHandleCarcassesForEntity
    ? false
    : canHandleCarcassesForEntity.status === EntityRelationStatus.REQUESTED;

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

  const entityContent = (
    <span className="flex flex-col gap-0.5">
      <span className="font-bold">{entity.nom_d_usage}</span>
      <small className="text-sm">{getUserRoleLabel(entity.type)}</small>
      {(entity.siret || entity.numero_ddecpp) && (
        <small className="text-sm">
          {entity.siret}
          {entity.numero_ddecpp}
        </small>
      )}
      {(entity.code_postal || entity.ville) && (
        <small className="text-sm">
          {entity.code_postal} {entity.ville}
        </small>
      )}
    </span>
  );

  const userContent = (
    <span className="flex flex-col gap-0.5">
      <span className="font-bold">
        {user.prenom} {user.nom_de_famille} {user.id === me.id ? ' (Vous)' : ''}
      </span>
      <small className="text-sm break-all">{user.email}</small>
    </span>
  );

  return (
    <div
      className={[
        'flex basis-full flex-col items-stretch gap-3 border-solid text-left',
        'bg-contrast-grey mb-2 border-0 p-4',
        'md:flex-row md:items-center md:justify-between md:gap-4',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-1 flex-col border-none text-left">
        {displayEntity &&
          (entityLink ? (
            <Link
              to={entityLink}
              className="block bg-none no-underline!"
            >
              {entityContent}
            </Link>
          ) : (
            entityContent
          ))}
        {displayUser &&
          (userLink ? (
            <Link
              to={userLink}
              className="block bg-none no-underline!"
            >
              {userContent}
            </Link>
          ) : (
            userContent
          ))}
      </div>
      <div className="flex flex-row flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
        {enableUsersView && user.activated && (
          <div className="flex flex-1 flex-col items-start gap-2 md:flex-none">
            <Button
              type="button"
              iconId="fr-icon-user-setting-fill"
              onClick={() => entityUsersModal.open()}
              title="Voir les utilisateurs"
              priority="tertiary no outline"
            >
              Voir les utilisateurs
            </Button>
            {relationsToApprove.length > 0 && (
              <Button
                type="button"
                key={refreshKey}
                iconId="fr-icon-user-setting-fill"
                onClick={() => entityUsersModal.open()}
                title="Voir les utilisateurs"
                priority="secondary"
              >
                {relationsToApprove.length} demande{relationsToApprove.length > 1 ? 's' : ''} en attente
              </Button>
            )}
          </div>
        )}
        {myRelationIsPending &&
          !canApproveRelation &&
          relationType === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY && (
            <p className="flex-1 self-center italic md:flex-none">En attente de validation</p>
          )}
        {canApproveRelation && (
          <div className="flex min-w-40 flex-1 flex-col justify-center md:flex-none md:basis-3xs">
            <RelationStatusSelector
              entity={entity}
              relation={canHandleCarcassesForEntity}
              user={user}
              onChange={onChange}
            />
          </div>
        )}
        {canDelete && (
          <div className="ml-auto flex shrink-0 flex-col justify-center md:ml-0">
            <Button
              type="button"
              iconId="fr-icon-delete-bin-line"
              onClick={() => {
                if (!window.confirm('Voulez-vous vraiment supprimer cette relation ?')) return;
                API.delete({
                  path: '/user-entity',
                  body: {
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    relation: relationType,
                  },
                }).then((res) => {
                  if (res.ok) {
                    onChange?.();
                  }
                });
              }}
              title="Retirer"
              priority="tertiary no outline"
            />
          </div>
        )}
      </div>
      {enableUsersView && user.activated && (
        <entityUsersModal.Component
          size="large"
          title={`${entity.nom_d_usage} - Liste des utilisateurs`}
          buttons={[
            {
              children: 'Fermer',
              onClick: () => entityUsersModal.close(),
            },
          ]}
        >
          {isOpen && (
            <RelationEntityUsersList
              entity={entity}
              refreshKey={refreshKey}
              user={user}
              onChange={onChange}
            />
          )}
        </entityUsersModal.Component>
      )}
    </div>
  );
}

const relationStatusOptions: Array<{
  label: string;
  value: EntityRelationStatus;
}> = [
  {
    label: 'Admin',
    value: EntityRelationStatus.ADMIN,
  },
  {
    label: 'Membre',
    value: EntityRelationStatus.MEMBER,
  },
  {
    label: 'En attente',
    value: EntityRelationStatus.REQUESTED,
  },
];

function RelationStatusSelector({
  entity,
  relation,
  user,
  onChange,
}: {
  entity: EntityWithUserRelations;
  user: User;
  relation?: EntityWithUserRelations['EntityRelationsWithUsers'][number];
  onChange?: () => void;
}) {
  const [status, setStatus] = useState<EntityRelationStatus | null>(relation?.status || null);
  return (
    <SelectCustom
      options={relationStatusOptions}
      getOptionLabel={(f) => f.label!}
      getOptionValue={(f) => f.value}
      onChange={(f) => {
        const newStatus = f?.value;
        if (status === EntityRelationStatus.ADMIN && newStatus !== EntityRelationStatus.ADMIN) {
          if (!window.confirm("Voulez-vous vraiment retirer les droits d'administrateur à cet utilisateur ?"))
            return;
        }
        API.put({
          path: '/user-entity',
          body: {
            [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
            [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            status: newStatus,
          },
        }).then((res) => {
          if (res.ok) {
            onChange?.();
            setStatus(newStatus || null);
          }
        });
      }}
      className="w-full bg-white"
      value={relationStatusOptions.find((opt) => opt.value === status)}
    />
  );
}
