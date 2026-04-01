import { useMemo } from 'react';
import { Link } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import {
  Entity,
  EntityRelationType,
  EntityTypes,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { EntityWithUserRelations } from '@api/src/types/entity';
import type { AdminUserDetailState } from './admin-user-state';
import { loadAdminUserData } from './admin-user-state';

type PeutEnvoyerDesFichesAOuTraiterAuNomDeProps = {
  relationType: EntityRelationType;
  formIdPrefix: string;
  userResponseData: AdminUserDetailState;
  setUserResponseData: (data: AdminUserDetailState) => void;
  forCCG?: boolean;
};

export default function PeutEnvoyerDesFichesAOuTraiterAuNomDe({
  relationType,
  formIdPrefix,
  userResponseData,
  setUserResponseData,
  forCCG,
}: PeutEnvoyerDesFichesAOuTraiterAuNomDeProps) {
  const { user, userEntitiesRelations, allEntities } = userResponseData;

  const shouldHaveAssociatedSvi = useMemo(() => {
    if (!user.roles.includes(UserRoles.ETG)) return false;
    if (relationType !== EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) return false;
    return true;
  }, [user.roles, relationType]);

  const associatedSvi = useMemo(() => {
    if (!shouldHaveAssociatedSvi) return null;
    const etgId = userEntitiesRelations.find((entity) => {
      return (
        entity.type === EntityTypes.ETG &&
        entity.EntityRelationsWithUsers.some(
          (r) => r.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        )
      );
    })?.id;
    if (!etgId) return null;
    const sviId = allEntities.find((entity) => entity.id === etgId)?.etg_linked_to_svi_id;
    if (!sviId) return null;
    const svi = allEntities.find((entity) => entity.id === sviId);
    if (!svi) return null;
    return {
      ...svi,
      type: EntityTypes.SVI,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
    };
  }, [allEntities, userEntitiesRelations, shouldHaveAssociatedSvi]);

  const potentialEntities = useMemo(() => {
    const userEntityIds: Record<Entity['id'], boolean> = {};
    for (const userEntityRelation of userEntitiesRelations) {
      if (userEntityRelation.EntityRelationsWithUsers.some((r) => r.relation === relationType)) {
        userEntityIds[userEntityRelation.id] = forCCG
          ? userEntityRelation.type === EntityTypes.CCG
          : userEntityRelation.type !== EntityTypes.CCG;
      }
    }
    const entities = [];
    for (const entity of allEntities) {
      if (entity.type === EntityTypes.SVI) {
        if (relationType === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) {
          continue;
        }
      }
      if (userEntityIds[entity.id]) continue;
      if (forCCG && entity.type !== EntityTypes.CCG) {
        continue;
      }
      if (!forCCG && entity.type === EntityTypes.CCG) {
        continue;
      }
      if (relationType === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY) {
        if (user.roles.includes(UserRoles.CHASSEUR)) {
          if (
            entity.type === EntityTypes.ETG ||
            entity.type === EntityTypes.COLLECTEUR_PRO ||
            entity.type === EntityTypes.CCG
          ) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.ETG)) {
          if (entity.type === EntityTypes.SVI) {
            entities.push(entity);
          }
        }
      } else if (relationType === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
        if (user.roles.includes(UserRoles.CHASSEUR)) {
          if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.ETG)) {
          if (entity.type === EntityTypes.ETG) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
          if (entity.type === EntityTypes.COLLECTEUR_PRO) {
            entities.push(entity);
          }
        } else if (user.roles.includes(UserRoles.SVI)) {
          if (entity.type === EntityTypes.SVI) {
            entities.push(entity);
          }
        }
      }
    }
    return entities;
  }, [allEntities, userEntitiesRelations, forCCG, relationType, user.roles]);

  return (
    <>
      {shouldHaveAssociatedSvi && (
        <Highlight
          className="m-0 mb-3 text-sm"
          classes={{
            root: 'fr-highlight--green-emeraude',
          }}
        >
          {associatedSvi
            ? "Un utilisateur associé à un SVI ne peut pas envoyer de fiche à un autre SVI que celui auquel est rattaché l'ETG. Conernant l'envoi à d'autres types d'entités (ETG, Collecteur Pro), à l'avenir il pourra le faire."
            : "Veuillez associer un SVI à l'ETG, il sera automatiquement ajouté à la liste des entités auxquelles l'utilisateur peut envoyer des fiches"}
        </Highlight>
      )}
      {associatedSvi && (
        <RelationEntityUser
          key={associatedSvi.id}
          relationType={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
          entity={associatedSvi as unknown as EntityWithUserRelations}
          user={user}
          displayEntity
        />
      )}
      {userEntitiesRelations
        .filter((entity) => {
          if (!entity) return false;
          if (forCCG && entity.type !== EntityTypes.CCG) return false;
          if (!forCCG && entity.type === EntityTypes.CCG) return false;
          return true;
        })
        .map((entity) => {
          if (!entity) return null;
          if (!entity?.EntityRelationsWithUsers) return null;
          const relation = entity.EntityRelationsWithUsers.find(
            (relation) => relation.owner_id === user.id && relation.relation === relationType,
          );
          if (!relation) return null;
          const isSviLinkedToEtg = associatedSvi?.id === entity.id;

          try {
            return (
              <RelationEntityUser
                key={entity.id}
                relationType={relationType}
                entity={entity}
                user={user}
                displayEntity
                entityLink={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                canApproveRelation={relationType === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY}
                canDelete={!isSviLinkedToEtg}
                onChange={() => {
                  loadAdminUserData(user.id).then((response) => {
                    if (response.data) setUserResponseData(response.data!);
                  });
                }}
              />
            );
          } catch (error) {
            console.error(error);
            return null;
          }
        })}
      {relationType === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
        user.roles.includes(UserRoles.COLLECTEUR_PRO) && (
          <Highlight className="m-0 mt-3 text-sm">
            Un collecteur indépendant ne peut pas gérer de fiches pour un ETG. <br />
            Si un ETG a un besoin de transport, c'est dans le profil de l'utilisateur que ça se gère : cet
            utilisateur n'a que le rôle ETG mais peut cocher la case "Gérer le transport dans l'ETG"
          </Highlight>
        )}
      {!!potentialEntities.length && (
        <div className="p-1 pb-0 md:p-2 [&_a]:block [&_a]:p-2 [&_a]:no-underline has-[a]:[&_td]:p-0!">
          <Table
            fixed
            noCaption
            className="[&_td]:align-middle"
            data={potentialEntities.map((entity) => [
              <form
                key={entity.id}
                id={`${formIdPrefix}-${entity.id}`}
                className="flex w-full flex-col items-start gap-2"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault();
                  API.post({
                    path: '/user-entity',
                    body: {
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.owner_id]: user.id,
                      relation: relationType,
                      [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: entity.id,
                    },
                  }).then(() => {
                    loadAdminUserData(user.id).then((response) => {
                      if (response.data) setUserResponseData(response.data!);
                    });
                  });
                }}
              >
                <Link
                  to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {entity.nom_d_usage}
                  <br />
                  {entity.siret}
                  {entity.numero_ddecpp}
                  <br />
                  {entity.code_postal} {entity.ville}
                </Link>
                <Button type="submit" className="m-1">
                  Ajouter
                </Button>
              </form>,
              <p
                key={user.id}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {entity.type}
              </p>,
            ])}
            headers={['Entité', 'Type']}
          />
        </div>
      )}
    </>
  );
}
