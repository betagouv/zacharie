import { useState, useEffect } from 'react';

import { EntityTypes, EntityRelationType, UserRoles, Prisma, EntityRelationStatus } from '@prisma/client';
import type { EntitiesWorkingForResponse } from '@api/src/types/responses';
import type { EntitiesByTypeAndId } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import RelationEntityUsersList from '@app/components/RelationEntityUsersList';
import { Input } from '@codegouvfr/react-dsfr/Input';
import Button from '@codegouvfr/react-dsfr/Button';

const empytEntitiesByTypeAndId: EntitiesByTypeAndId = {
  [EntityTypes.PREMIER_DETENTEUR]: {},
  [EntityTypes.CCG]: {},
  [EntityTypes.COLLECTEUR_PRO]: {},
  [EntityTypes.ETG]: {},
  [EntityTypes.SVI]: {},
  [EntityTypes.COMMERCE_DE_DETAIL]: {},
  [EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]: {},
  [EntityTypes.ASSOCIATION_CARITATIVE]: {},
  [EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]: {},
  [EntityTypes.CONSOMMATEUR_FINAL]: {},
};

export default function UtilisateursDeMonEntreprise() {
  const user = useUser((state) => state.user)!;
  const [newUserEmail, setNewUserEmail] = useState('');
  const [userEntitiesByTypeAndId, setUserEntitiesByTypeAndId] =
    useState<EntitiesByTypeAndId>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);

  let entityType: EntityTypes = EntityTypes.COLLECTEUR_PRO;
  if (user.roles.includes(UserRoles.ETG)) {
    entityType = EntityTypes.ETG;
  } else if (user.roles.includes(UserRoles.SVI)) {
    entityType = EntityTypes.SVI;
  } else if (user.roles.includes(UserRoles.COMMERCE_DE_DETAIL)) {
    entityType = EntityTypes.COMMERCE_DE_DETAIL;
  } else if (user.roles.includes(UserRoles.CANTINE_OU_RESTAURATION_COLLECTIVE)) {
    entityType = EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE;
  } else if (user.roles.includes(UserRoles.ASSOCIATION_CARITATIVE)) {
    entityType = EntityTypes.ASSOCIATION_CARITATIVE;
  } else if (user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF)) {
    entityType = EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF;
  }
  const userEntities = Object.values(userEntitiesByTypeAndId[entityType]);

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (res.ok) {
          setUserEntitiesByTypeAndId(res.data.userEntitiesByTypeAndId);
        }
      });
  }, [refreshKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const title = user.roles.includes(UserRoles.SVI)
    ? 'Ajouter un utilisateur à mon service'
    : 'Ajouter un utilisateur à mon entreprise';

  return (
    <>
      <title>{`${title} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <h1 className="fr-h2 fr-mb-2w">{title}</h1>
            {userEntities
              .filter((entity) => entity.type === entityType)
              .map((entity) => {
                const relation = entity.EntityRelationsWithUsers.find(
                  (relation) =>
                    relation.owner_id === user.id &&
                    relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                );
                if (!relation) return null;
                if (
                  relation.status !== EntityRelationStatus.ADMIN &&
                  relation.status !== EntityRelationStatus.MEMBER
                )
                  return null;
                return (
                  <div className="mb-6 bg-white md:shadow-sm">
                    <div className="p-4 md:p-8">
                      <Input
                        label="Email *"
                        disabled={relation.status !== EntityRelationStatus.ADMIN}
                        hintText={
                          relation.status === EntityRelationStatus.MEMBER
                            ? 'Vous devez être administrateur de votre entité pour inviter un utilisateur'
                            : ''
                        }
                        nativeInputProps={{
                          id: Prisma.UserScalarFieldEnum.email,
                          name: Prisma.UserScalarFieldEnum.email,
                          autoComplete: 'off',
                          disabled: relation.status !== EntityRelationStatus.ADMIN,
                          defaultValue: newUserEmail,
                          onChange: (e) => setNewUserEmail(e.target.value),
                          required: true,
                        }}
                      />
                      <Button
                        type="submit"
                        disabled={relation.status !== EntityRelationStatus.ADMIN}
                        onClick={() => {
                          API.post({
                            path: 'user/invite-user',
                            body: {
                              email: newUserEmail,
                              entity_id: entity.id,
                            },
                          }).then((res) => {
                            if (res.ok) {
                              alert(
                                'Utilisateur invité avec succès. Il recevra un email pour se connecter à Zacharie.',
                              );
                              setNewUserEmail('');
                              setRefreshKey((k) => k + 1);
                            }
                          });
                        }}
                      >
                        Inviter
                      </Button>
                      <h3 className="my-8 text-lg font-semibold text-gray-900">
                        Utilisateurs existants de {entity.nom_d_usage}
                      </h3>
                      <RelationEntityUsersList
                        entity={entity}
                        refreshKey={refreshKey}
                        user={user}
                        onChange={() => {
                          setRefreshKey((k) => k + 1);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
