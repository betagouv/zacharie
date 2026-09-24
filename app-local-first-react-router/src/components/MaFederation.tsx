import { useEffect, useState } from 'react';
import { EntityRelationStatus, EntityRelationType, EntityTypes, Prisma } from '@prisma/client';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { EntitiesWorkingForResponse } from '@api/src/types/responses';
import type { EntityWithUserRelations } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import RelationEntityUsersList from '@app/components/RelationEntityUsersList';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';

// Fédération dont l'utilisateur est membre (rattachement par l'équipe Zacharie ou par un admin de la
// fédération). Rien n'est affiché si l'utilisateur n'est membre d'aucune fédération.
export default function MaFederation() {
  const user = useUser((state) => state.user)!;
  const [federation, setFederation] = useState<EntityWithUserRelations | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    API.get({ path: 'entite/working-for' })
      .then((res) => res as EntitiesWorkingForResponse)
      .then((res) => {
        if (!res.ok) return;
        const { userEntitiesByTypeAndId } = res.data;
        const [mine] = [EntityTypes.FDC, EntityTypes.FRC, EntityTypes.FNC].flatMap((type) =>
          Object.values(userEntitiesByTypeAndId[type])
        );
        setFederation(mine ?? null);
      });
  }, [refreshKey]);

  if (!federation) return null;

  const myRelation = federation.EntityRelationsWithUsers.find(
    (relation) =>
      relation.owner_id === user.id &&
      relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
  );
  const iAmAdmin = myRelation?.status === EntityRelationStatus.ADMIN;

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <h3
          className="mb-2 text-lg font-semibold text-gray-900"
          id="federation-title"
        >
          Ma fédération : {federation.nom_d_usage}
        </h3>
        <p className="mb-8 text-sm text-gray-600">
          {getUserRoleLabel(federation.type)} — {iAmAdmin ? 'Administrateur' : 'Membre'}
        </p>
        {iAmAdmin && (
          <>
            <form
              id="federation-invite-form"
              method="POST"
              onSubmit={(e) => {
                e.preventDefault();
                API.post({
                  path: 'user/invite-user',
                  body: {
                    [Prisma.UserScalarFieldEnum.email]: newUserEmail,
                    [Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id]: federation.id,
                  },
                }).then((res) => {
                  if (res.ok) {
                    setNewUserEmail('');
                    setRefreshKey((k) => k + 1);
                  }
                });
              }}
            >
              <Input
                label="Inviter un collègue par email"
                hintText="Il aura accès au tableau de bord de la fédération."
                nativeInputProps={{
                  id: 'federation-invite-email',
                  type: 'email',
                  placeholder: 'Email du collègue',
                  autoComplete: 'off',
                  required: true,
                  value: newUserEmail,
                  onChange: (e) => setNewUserEmail(e.target.value),
                }}
              />
              <Button type="submit">Inviter</Button>
            </form>
            <h4 className="mt-8 mb-4 text-base font-semibold text-gray-900">Membres de la fédération</h4>
            <RelationEntityUsersList
              entity={federation}
              refreshKey={refreshKey}
              user={user}
              onChange={() => setRefreshKey((k) => k + 1)}
            />
          </>
        )}
      </div>
    </div>
  );
}
