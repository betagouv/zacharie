import { useMemo, useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, Entity, UserRoles, EntityTypes } from '@prisma/client';
import type { UserForFeiResponse } from '@api/src/types/responses';
import type { UserForFei } from '~/src/types/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useParams } from 'react-router';
import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function SelectNextForExaminateur() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const detenteursInitiaux = state.detenteursInitiaux;
  const associationsDeChasse = useMemo(() => {
    const associationsDeChasse: typeof state.entities = {};
    for (const entityId of Object.values(state.entitiesIdsWorkingDirectlyFor)) {
      const entity = state.entities[entityId];
      if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
        associationsDeChasse[entityId] = entity;
      }
    }
    return associationsDeChasse;
  }, [state]);

  const updateFei = state.updateFei;
  const isOnline = useIsOnline();

  const nextOwnerSelectLabel = 'Sélectionnez le Premier Détenteur de pour cette fiche';
  const [nextValue, setNextValue] = useState(
    fei.fei_next_owner_user_id ?? fei.fei_next_owner_entity_id ?? '',
  );

  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchingUserError, setSearchingUserError] = useState<string | null>(null);

  const { nextOwnerUser, nextOwnerEntity } = useMemo(() => {
    const _nextOwner = detenteursInitiaux[nextValue];
    if (_nextOwner) {
      return { nextOwnerUser: _nextOwner, nextOwnerEntity: null };
    }
    const _nextEntity = associationsDeChasse[nextValue];
    if (_nextEntity) {
      return { nextOwnerUser: null, nextOwnerEntity: _nextEntity };
    }
    return { nextOwnerUser: null, nextOwnerEntity: null };
  }, [detenteursInitiaux, associationsDeChasse, nextValue]);

  const nextOwnerName = useMemo(() => {
    if (nextOwnerUser) {
      return `${nextOwnerUser.prenom} ${nextOwnerUser.nom_de_famille}`;
    }
    if (nextOwnerEntity) {
      return nextOwnerEntity.nom_d_usage;
    }
    return '';
  }, [nextOwnerUser, nextOwnerEntity]);

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }

  return (
    <>
      <form
        id="select-next-owner"
        method="POST"
        onSubmit={(event) => {
          event.preventDefault();
          const nextIsMe = nextOwnerUser?.id === user.id;
          const nextIsMyAssociation = !!nextOwnerEntity?.id;
          if (nextIsMe) {
            console.log('nextIsMe');
            updateFei(fei.numero, {
              fei_next_owner_user_id: null,
              fei_next_owner_user_name_cache: null,
              fei_next_owner_role: null,
              fei_next_owner_entity_id: null,
              fei_next_owner_entity_name_cache: null,
              fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
              fei_current_owner_user_id: user.id,
              fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
              premier_detenteur_user_id: user.id,
              premier_detenteur_offline: navigator.onLine ? false : true,
              premier_detenteur_name_cache: `${user.prenom} ${user.nom_de_famille}`,
            });
          } else if (nextIsMyAssociation) {
            updateFei(fei.numero, {
              fei_next_owner_user_id: null,
              fei_next_owner_role: null,
              fei_next_owner_entity_id: null,
              fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
              fei_current_owner_entity_id: nextOwnerEntity.id,
              fei_current_owner_entity_name_cache: nextOwnerEntity.nom_d_usage ?? null,
              fei_current_owner_user_id: user.id,
              fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
              premier_detenteur_user_id: user.id,
              premier_detenteur_offline: navigator.onLine ? false : true,
              premier_detenteur_entity_id: nextOwnerEntity.id,
              premier_detenteur_name_cache: nextOwnerEntity?.nom_d_usage ?? null,
            });
          } else {
            console.log('nextIsSomeoneElse');
            updateFei(fei.numero, {
              fei_next_owner_user_id: nextOwnerUser?.id,
              fei_next_owner_user_name_cache: nextOwnerName,
              fei_next_owner_role: UserRoles.PREMIER_DETENTEUR,
              fei_next_owner_entity_id: nextOwnerEntity?.id,
            });
          }
        }}
      >
        <div className="fr-fieldset__element grow">
          <Select
            label="Quel Premier Détenteur doit désormais agir sur la fiche ?"
            className="!mb-0 grow"
            key={fei.fei_next_owner_user_id ?? 'no-choice-yet'}
            nativeSelectProps={{
              name: 'next_owner',
              value: nextValue,
              onChange: (event) => {
                setNextValue(event.target.value);
              },
            }}
          >
            <option value="">{nextOwnerSelectLabel}</option>
            {Object.values(associationsDeChasse).map((potentielOwner) => {
              return (
                <NextOwnerOption
                  nextOwnerIsEntity
                  key={potentielOwner.id}
                  potentielOwner={potentielOwner}
                  user={user}
                />
              );
            })}
            {Object.values(detenteursInitiaux).map((potentielOwner) => {
              return (
                <NextOwnerOption
                  nextOwnerIsUser
                  key={potentielOwner.id}
                  potentielOwner={potentielOwner}
                  user={user}
                />
              );
            })}
          </Select>
          {!nextValue ||
            (nextValue !== fei.fei_next_owner_user_id && (
              <Button className="mt-2" type="submit" disabled={!nextValue}>
                Envoyer
              </Button>
            ))}
        </div>
      </form>
      {!fei.fei_next_owner_user_id && !nextValue && (
        <>
          <form
            className="fr-fieldset__element relative flex w-full flex-row items-end gap-4"
            method="POST"
            onSubmit={async (event) => {
              event.preventDefault();
              setIsSearchingUser(true);
              const formData = new FormData(event.currentTarget);
              const userSearchResponse = await fetch(
                `${import.meta.env.VITE_API_URL}/user/fei/trouver-premier-detenteur`,
                {
                  method: 'POST',
                  credentials: 'include',
                  body: JSON.stringify({
                    email: formData.get(Prisma.UserScalarFieldEnum.email) as string,
                    numero: fei.numero,
                  }),
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                },
              )
                .then((response) => response.json())
                .then((response) => response as UserForFeiResponse);
              setIsSearchingUser(false);
              if (userSearchResponse.ok) {
                const nextPremierDetenteur = userSearchResponse.data?.user;
                if (!nextPremierDetenteur) {
                  setSearchingUserError("L'utilisateur n'existe pas");
                  return;
                }
                useZustandStore.setState((state) => ({
                  detenteursInitiaux: {
                    ...state.detenteursInitiaux,
                    [nextPremierDetenteur.id]: {
                      ...nextPremierDetenteur,
                    },
                  },
                }));
                updateFei(fei.numero, {
                  fei_next_owner_user_id: nextPremierDetenteur.id,
                  fei_next_owner_user_name_cache: `${nextPremierDetenteur.prenom} ${nextPremierDetenteur.nom_de_famille}`,
                  fei_next_owner_role: UserRoles.PREMIER_DETENTEUR,
                });
                setNextValue(nextPremierDetenteur.id);
              } else {
                setSearchingUserError(userSearchResponse.error ?? 'Erreur inconnue');
              }
            }}
          >
            <Input
              label="...ou saisissez l'email du Premier Détenteur si vous ne le trouvez pas"
              className="!mb-0"
              hintText="Nous l'ajouterons automatiquement à la liste de vos partenaires pour la prochaine fois"
              nativeInputProps={{
                id: Prisma.UserScalarFieldEnum.email,
                name: Prisma.UserScalarFieldEnum.email,
                autoComplete: 'off',
              }}
            />
            <Button type="submit" disabled={isSearchingUser}>
              {!isSearchingUser ? 'Envoyer' : 'Recherche en cours...'}
            </Button>
            {!isOnline && (
              <div className="absolute inset-0 z-50 flex items-end bg-white/70">
                <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                  ✋ ❌ Cette fonctionnalité n'existe pas sans connexion internet.
                </p>
              </div>
            )}
          </form>
          {searchingUserError === "L'utilisateur n'existe pas" && (
            <Alert
              severity="error"
              title="Nous ne connaissons pas cet email"
              description="Vérifiez avec le Premier Détenteur s'il est avec vous ?"
            />
          )}
        </>
      )}

      {nextOwnerName &&
        (fei.fei_next_owner_user_id === nextOwnerUser?.id ||
          fei.fei_next_owner_entity_id === nextOwnerEntity?.id) && (
          <>
            <Alert
              severity="success"
              description={`${nextOwnerName} ${fei.is_synced ? 'a été notifié' : 'sera notifié dès que vous aurez retrouvé du réseau'}.`}
              title="Attribution effectuée"
            />
            <Button
              className="mt-2"
              linkProps={{
                to: `/app/tableau-de-bord/`,
              }}
            >
              Voir toutes mes fiches
            </Button>
          </>
        )}
    </>
  );
}

type NextOwnerOptionProps = {
  potentielOwner: UserForFei | Entity;
  user: UserForFei;
  nextOwnerIsEntity?: boolean;
  nextOwnerIsUser?: boolean;
};

const NextOwnerOption = ({
  potentielOwner,
  nextOwnerIsEntity,
  nextOwnerIsUser,
  user,
}: NextOwnerOptionProps) => {
  let label = '';
  if (nextOwnerIsEntity) {
    potentielOwner = potentielOwner as unknown as Entity;
    label = `${potentielOwner.nom_d_usage}`;
    if (potentielOwner.code_postal) {
      label += ` - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
    }
  }
  if (nextOwnerIsUser) {
    potentielOwner = potentielOwner as unknown as UserForFei;
    label = `${potentielOwner.prenom} ${potentielOwner.nom_de_famille}`;
    if (potentielOwner.code_postal) {
      label += ` - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
    }
  }
  if (potentielOwner.id === user.id) {
    label = `Vous (${label})`;
  }
  return (
    <option key={potentielOwner.id} value={potentielOwner.id}>
      {label}
    </option>
  );
};
