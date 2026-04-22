import { useState } from 'react';
import { Link } from 'react-router';
import { EntityRelationType, Prisma, EntityRelationStatus } from '@prisma/client';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { EntitiesById } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import SelectCustom from '@app/components/SelectCustom';
import RelationEntityUser from '@app/components/RelationEntityUser';

interface ListAndSelectEntitiesProps {
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  refreshKey: number;
  canChange: boolean;
  selectLabel: string;
  sectionLabel: string;
  formId: string;
  description?: React.ReactNode;
  allEntitiesById: EntitiesById;
  userEntitiesById: EntitiesById;
  children?: React.ReactNode;
}

export default function ListAndSelectEntities({
  setRefreshKey,
  refreshKey,
  selectLabel,
  sectionLabel,
  formId,
  description,
  children,
  canChange,
  allEntitiesById,
  userEntitiesById,
}: ListAndSelectEntitiesProps) {
  const user = useUser((state) => state.user)!;
  const userEntities = Object.values(userEntitiesById);
  const remainingEntities = Object.values(allEntitiesById).filter((entity) => !userEntitiesById[entity.id]);

  const [entityId, setEntityId] = useState<string | null>(null);

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <h3 className="mb-8 text-lg font-semibold text-gray-900" id={`${formId}-title`}>
          {sectionLabel}
        </h3>
        {description}
        {userEntities.map((entity) => {
          const relation = entity.EntityRelationsWithUsers.find(
            (relation) => relation.owner_id === user.id && relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
          );
          if (!relation) return null;
          console.log(entity);
          return (
            <RelationEntityUser
              key={relation.id}
              relationType={EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
              entity={entity}
              user={user}
              enableUsersView={relation.status === EntityRelationStatus.ADMIN}
              displayEntity={true}
              displayUser={false}
              onChange={() => {
                setRefreshKey((k) => k + 1);
              }}
              refreshKey={refreshKey}
              canDelete
            />
          );
        })}
        {canChange && (
          <form id={formId} className="flex w-full flex-col gap-4" method="POST">
            <p className="py-5 pr-5">
              Vous pouvez en ajouter d'autre via la liste ci-dessous.
              <br />
              Si vous ne trouvez pas votre entreprise, veuillez nous contacter via <Link to="/app/contact">le formulaire de contact</Link>.
            </p>
            <div className="flex w-full flex-col gap-4 md:flex-row [&_.fr-select-group]:mb-0">
              <SelectCustom
                options={remainingEntities.map((entity) => ({
                  label: `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`,
                  value: entity.id,
                }))}
                placeholder={selectLabel}
                value={
                  entityId
                    ? {
                        label: remainingEntities
                          .filter((entity) => entity.id === entityId)
                          .map((entity) => `${entity.nom_d_usage} - ${entity.code_postal} ${entity.ville}`)?.[0],
                        value: entityId,
                      }
                    : null
                }
                getOptionLabel={(f) => f.label!}
                getOptionValue={(f) => f.value}
                onChange={(f) => (f ? setEntityId(f.value) : setEntityId(null))}
                isClearable={!!entityId}
                inputId={`select-${formId}`}
                classNamePrefix={`select-${formId}`}
                className="basis-2/3"
              />
              <Button
                type="submit"
                className="flex basis-1/3 items-center justify-center"
                nativeButtonProps={{ form: formId }}
                onClick={(e) => {
                  e.preventDefault();
                  API.post({
                    path: '/user-entity',
                    body: {
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.relation]: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entityId,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.status]: EntityRelationStatus.REQUESTED,
                    },
                  }).then((res) => {
                    if (res.ok) {
                      setRefreshKey((k) => k + 1);
                      setEntityId(null);
                    }
                  });
                }}
                disabled={!remainingEntities.length}
              >
                Ajouter
              </Button>
            </div>
          </form>
        )}
        {children}
      </div>
    </div>
  );
}
