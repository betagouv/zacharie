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
    }),
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
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
  );
  const relationsToApprove = entity.EntityRelationsWithUsers?.filter(
    (relation) =>
      relation.status === EntityRelationStatus.REQUESTED &&
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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

  return (
    <div
      className={[
        'flex basis-full flex-row items-center justify-between border-solid text-left',
        'bg-contrast-grey mb-2 border-0',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-1 flex-col border-none p-4 text-left font-bold">
        {displayEntity && (
          <>
            {entityLink ? (
              <Link to={entityLink} className="block bg-none px-3 py-4 no-underline!">
                {entity.nom_d_usage}
                <br />
                {getUserRoleLabel(entity.type)}
                <br />
                {entity.siret}
                {entity.numero_ddecpp}
                <br />
                {entity.code_postal} {entity.ville}
              </Link>
            ) : (
              <>
                {entity.nom_d_usage}
                <br />
                {getUserRoleLabel(entity.type)}
                <br />
                {entity.siret}
                {entity.numero_ddecpp}
                <br />
                {entity.code_postal} {entity.ville}
              </>
            )}
          </>
        )}
        {displayUser && (
          <>
            {userLink ? (
              <Link to={userLink} className="block bg-none px-3 py-4 no-underline!">
                <span className="font-bold">
                  {user.prenom} {user.nom_de_famille} {user.id === me.id ? ' (Vous)' : ''}
                </span>
                <small className="text-sm font-normal">{user.email}</small>
              </Link>
            ) : (
              <>
                <span className="font-bold">
                  {user.prenom} {user.nom_de_famille} {user.id === me.id ? ' (Vous)' : ''}
                </span>
                <small className="text-sm font-normal">{user.email}</small>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex flex-row gap-2 pr-4">
        {enableUsersView && (
          <div className="flex flex-col gap-2 py-4">
            <Button
              type="button"
              iconId="fr-icon-user-setting-fill"
              onClick={() => entityUsersModal.open()}
              title="Voir la liste des utilisateurs"
              priority="tertiary no outline"
            >
              Voir la liste des utilisateurs
            </Button>
            {relationsToApprove.length > 0 && (
              <Button
                type="button"
                key={refreshKey}
                iconId="fr-icon-user-setting-fill"
                onClick={() => entityUsersModal.open()}
                title="Voir la liste des utilisateurs"
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
            <div className="flex flex-col justify-center gap-2 py-4">
              <p className="italic">En attente de validation</p>
            </div>
          )}
        {canApproveRelation && (
          <div className="flex basis-3xs flex-col justify-center gap-2 py-4">
            <RelationStatusSelector
              entity={entity}
              relation={canHandleCarcassesForEntity}
              user={user}
              onChange={onChange}
            />
          </div>
        )}
        {canDelete && (
          <div className="flex flex-col justify-center gap-2 py-4">
            <Button
              type="button"
              iconId="fr-icon-delete-bin-line"
              onClick={() => {
                if (!window.confirm('Voulez-vous vraiment supprimer cette relation ?')) return;
                API.post({
                  path: `user/user-entity/${user.id}`,
                  body: {
                    _action: 'delete',
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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
      {enableUsersView && (
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
          <div className={isOpen ? '' : 'pointer-events-none'}>
            <RelationEntityUsersList
              entity={entity}
              refreshKey={refreshKey}
              user={user}
              onChange={onChange}
            />
          </div>
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
        API.post({
          path: `user/user-entity/${user.id}`,
          body: {
            _action: 'update',
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
