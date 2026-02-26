import { useState, useCallback, useEffect, Fragment } from 'react';

import { Button } from '@codegouvfr/react-dsfr/Button';
import { EntityRelationType, Prisma, EntityRelationStatus } from '@prisma/client';
import type { PartenairesResponse, UserConnexionResponse } from '@api/src/types/responses';
import type { EntitiesById } from '@api/src/types/entity';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import RelationEntityUser from '@app/components/RelationEntityUser';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { useSearchParams } from 'react-router';
import PartenaireNouveau from '@app/components/PartenaireNouveau';

const empytEntitiesByTypeAndId: EntitiesById = {};

export default function MesPartenaires() {
  const user = useUser((state) => state.user)!;
  const [userEntitiesById, setUserEntitiesById] = useState<EntitiesById>(empytEntitiesByTypeAndId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    API.get({ path: 'entite/partenaires' })
      .then((res) => res as PartenairesResponse)
      .then((res) => {
        if (res.ok) {
          setUserEntitiesById(res.data.userEntitiesById);
        }
      });
  }, [refreshKey]);

  const handleUserSubmit = useCallback(
    async (checked_has_partenaires: boolean) => {
      const body: Record<string, string | null> = {};
      body.checked_has_partenaires =
        checked_has_partenaires == null ? null : checked_has_partenaires ? 'true' : 'false';
      const response = await API.post({
        path: `/user/${user.id}`,
        body,
      }).then((data) => data as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    },
    [user.id],
  );

  const userEntities = Object.values(userEntitiesById);

  const userHasPartenaires = userEntities.length > 0;

  const [showForm, setShowForm] = useState(searchParams.get('raison-sociale') || !userHasPartenaires);

  useEffect(() => {
    setShowForm(searchParams.get('raison-sociale') || !userHasPartenaires);
  }, [userHasPartenaires, searchParams]);

  return (
    <div className="mb-6 bg-white md:shadow-sm">
      <div className="p-4 md:p-8">
        <h3 className="mb-8 text-lg font-semibold text-gray-900" id="onboarding-etape-2-partenaires-data-title">
          Partenaires
        </h3>
        <Fragment key={refreshKey}>
          {!userHasPartenaires && (
            <RadioButtons
              legend="Avez-vous des partenaires dans le circuit court de transport des carcasses ? *"
              hintText="On parle ici de boucheries, charcuteries, restaurants, ou encore repas de chasse ou associatifs, ou encore des consommateurs finaux."
              orientation="horizontal"
              options={[
                {
                  nativeInputProps: {
                    required: true,
                    checked: !!user.checked_has_partenaires,
                    name: Prisma.UserScalarFieldEnum.checked_has_partenaires,
                    onChange: () => {
                      handleUserSubmit(true);
                    },
                  },
                  label: 'Oui',
                },
                {
                  nativeInputProps: {
                    required: true,
                    checked: !user.checked_has_partenaires,
                    name: 'not_checked_has_partenaires',
                    onChange: () => {
                      handleUserSubmit(false);
                    },
                  },
                  label: 'Non',
                },
              ]}
            />
          )}
          {userEntities.map((entity) => {
            const relation = entity.EntityRelationsWithUsers.find(
              (relation) =>
                relation.owner_id === user.id &&
                relation.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            );
            if (!relation) return null;
            return (
              <RelationEntityUser
                key={relation.id}
                relationType={EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY}
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

          {(userHasPartenaires || user.checked_has_partenaires) && (
            <>
              {!showForm ? (
                <>
                  <Button
                    priority="secondary"
                    className="mt-4"
                    nativeButtonProps={{
                      onClick: () => setShowForm(true),
                    }}
                  >
                    Me rattacher à un autre partenaire
                  </Button>
                </>
              ) : (
                <div className="mt-8">
                  <div className="rounded-lg border border-gray-300 px-8 py-6">
                    <PartenaireNouveau
                      onFinish={() => {
                        setRefreshKey((k) => k + 1);
                        setShowForm(false);
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </Fragment>
      </div>
    </div>
  );
}
