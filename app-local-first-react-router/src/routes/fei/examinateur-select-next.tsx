import { useMemo, useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, Entity, UserRoles, EntityTypes, FeiOwnerRole } from '@prisma/client';
import type { UserForFeiResponse } from '@api/src/types/responses';
import type { UserForFei } from '~/src/types/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useNavigate, useParams } from 'react-router';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { createHistoryInput } from '@app/utils/create-history-entry';
import API from '@app/services/api';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import { Tag } from '@codegouvfr/react-dsfr/Tag';

export default function SelectNextForExaminateur({ disabled }: { disabled?: boolean }) {
  const params = useParams();
  const navigate = useNavigate();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const entitiesIdsWorkingDirectlyFor = useZustandStore((state) => state.entitiesIdsWorkingDirectlyFor);
  const fei = feis[params.fei_numero!];
  const detenteursInitiaux = useZustandStore((state) => state.detenteursInitiaux);
  const [showSearchUserByEmail, setShowSearchUserByEmail] = useState(false);
  const prefilledInfos = usePrefillPremierDétenteurInfos();
  const associationsDeChasse = useMemo(() => {
    const associationsDeChasse: typeof entities = {};
    for (const entityId of Object.values(entitiesIdsWorkingDirectlyFor)) {
      const entity = entities[entityId];
      if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
        associationsDeChasse[entityId] = entity;
      }
    }
    return associationsDeChasse;
  }, [entities, entitiesIdsWorkingDirectlyFor]);

  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);

  const isOnline = useIsOnline();

  const nextOwnerSelectLabel = 'Sélectionnez le Premier Détenteur de pour cette fiche *';
  const [nextOwnerUserOrEntityId, setNextOwnerUserOrEntityId] = useState(
    fei.fei_next_owner_user_id ?? fei.fei_next_owner_entity_id ?? '',
  );

  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchingUserError, setSearchingUserError] = useState<string | null>(null);

  const { nextOwnerUser, nextOwnerEntity } = useMemo(() => {
    const _nextOwner = detenteursInitiaux[nextOwnerUserOrEntityId];
    if (_nextOwner) {
      return { nextOwnerUser: _nextOwner, nextOwnerEntity: null };
    }
    const _nextEntity = associationsDeChasse[nextOwnerUserOrEntityId];
    if (_nextEntity) {
      return { nextOwnerUser: null, nextOwnerEntity: _nextEntity };
    }
    return { nextOwnerUser: null, nextOwnerEntity: null };
  }, [detenteursInitiaux, associationsDeChasse, nextOwnerUserOrEntityId]);

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

  function handleSubmitFromSelect(nextOwnerUserId?: string) {
    const nextIsMe = nextOwnerUserId === user.id;
    const nextIsMyAssociation = !!nextOwnerEntity?.id;
    let nextFei: Partial<typeof fei>;
    if (nextIsMe) {
      nextFei = {
        fei_next_owner_user_id: null,
        fei_next_owner_user_name_cache: null,
        fei_next_owner_role: null,
        fei_next_owner_entity_id: null,
        fei_next_owner_entity_name_cache: null,
        fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        fei_current_owner_user_id: user.id,
        fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
        premier_detenteur_user_id: user.id,
        premier_detenteur_offline: navigator.onLine ? false : true,
        premier_detenteur_name_cache: `${user.prenom} ${user.nom_de_famille}`,
      };
    } else if (nextIsMyAssociation) {
      nextFei = {
        fei_next_owner_user_id: null,
        fei_next_owner_role: null,
        fei_next_owner_entity_id: null,
        fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        fei_current_owner_entity_id: nextOwnerEntity.id,
        fei_current_owner_entity_name_cache: nextOwnerEntity.nom_d_usage ?? null,
        fei_current_owner_user_id: user.id,
        fei_current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
        premier_detenteur_user_id: user.id,
        premier_detenteur_offline: navigator.onLine ? false : true,
        premier_detenteur_entity_id: nextOwnerEntity.id,
        premier_detenteur_name_cache: nextOwnerEntity?.nom_d_usage ?? null,
      };
    } else {
      console.log('nextIsSomeoneElse');
      nextFei = {
        fei_next_owner_user_id: nextOwnerUser?.id,
        fei_next_owner_user_name_cache: nextOwnerName,
        fei_next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        fei_next_owner_entity_id: nextOwnerEntity?.id,
      };
    }
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: fei.numero,
      action: 'examinateur-select-next',
      history: createHistoryInput(fei, nextFei),
      entity_id: null,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  }

  const isFirstFei =
    !prefilledInfos?.premier_detenteur_entity_id && !prefilledInfos?.premier_detenteur_user_id;

  return (
    <>
      <label className="mb-4 block">Qui est le premier détenteur&nbsp;?&nbsp;*</label>
      {isFirstFei &&
      !Object.values(associationsDeChasse).length &&
      !Object.values(detenteursInitiaux).length ? (
        <>
          {!showSearchUserByEmail && (
            <div>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  priority="primary"
                  linkProps={{
                    to: `/app/tableau-de-bord/mon-profil/mes-associations-de-chasse?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
                  }}
                >
                  Ajouter une association / société / domaine de chasse
                </Button>
                <Button
                  priority="secondary"
                  type="button"
                  onClick={() => setShowSearchUserByEmail(true)}
                  className="text-left"
                >
                  Chercher un Premier Détenteur par email
                </Button>
                <Button priority="tertiary" type="button" onClick={() => handleSubmitFromSelect(user.id)}>
                  Je suis le Premier Détenteur
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <form
          id="select-next-owner"
          method="POST"
          aria-disabled={disabled}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitFromSelect(nextOwnerUser?.id);
          }}
        >
          <Select
            label=""
            key={fei.fei_next_owner_user_id ?? 'no-choice-yet'}
            disabled={disabled}
            hint={
              <>
                {!nextOwnerUserOrEntityId && !disabled ? (
                  <div>
                    {Object.values(associationsDeChasse).map((entity) => {
                      return (
                        <Tag
                          key={entity.id}
                          iconId="fr-icon-checkbox-circle-line"
                          className="mr-2"
                          nativeButtonProps={{
                            onClick: () => {
                              setNextOwnerUserOrEntityId(entity.id);
                            },
                          }}
                        >
                          {entity.nom_d_usage}
                        </Tag>
                      );
                    })}
                    {Object.values(detenteursInitiaux).map((user) => {
                      return (
                        <Tag
                          key={user.id}
                          iconId="fr-icon-checkbox-circle-line"
                          className="mr-2"
                          nativeButtonProps={{
                            onClick: () => {
                              setNextOwnerUserOrEntityId(user.id);
                            },
                          }}
                        >
                          {`${user.prenom} ${user.nom_de_famille}`}
                        </Tag>
                      );
                    })}
                  </div>
                ) : null}
              </>
            }
            nativeSelectProps={{
              name: 'next_owner',
              value: nextOwnerUserOrEntityId,
              disabled,
              onChange: (event) => {
                if (event.target.value === 'new-user') {
                  setShowSearchUserByEmail(true);
                } else if (event.target.value === 'new-entity') {
                  navigate(
                    `/app/tableau-de-bord/mon-profil/mes-associations-de-chasse?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
                  );
                } else {
                  setNextOwnerUserOrEntityId(event.target.value);
                }
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
            <option value="new-entity">+ Ajouter une association / société / domaine de chasse</option>
            <option value="new-user">
              + Chercher par email un autre Premier Détenteur inscrit dans Zacharie
            </option>
          </Select>
          {(!nextOwnerUserOrEntityId || nextOwnerUserOrEntityId !== fei.fei_next_owner_user_id) && (
            <Button type="submit" disabled={!nextOwnerUserOrEntityId || disabled}>
              Valider l’examen initial
            </Button>
          )}
        </form>
      )}

      {showSearchUserByEmail && (
        <>
          <form
            className="mt-4"
            method="POST"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const email = formData.get(Prisma.UserScalarFieldEnum.email) as string;
              if (email === user.email) {
                // it's me !
                setNextOwnerUserOrEntityId(user.id);
                handleSubmitFromSelect(user.id);
                return;
              }
              setIsSearchingUser(true);
              const userSearchResponse = await API.post({
                path: 'user/fei/trouver-premier-detenteur',
                body: {
                  email: email,
                  numero: fei.numero,
                },
              }).then((response) => response as UserForFeiResponse);
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
                setShowSearchUserByEmail(false);
                // const nextFei = {
                //   fei_next_owner_user_id: nextPremierDetenteur.id,
                //   fei_next_owner_user_name_cache: `${nextPremierDetenteur.prenom} ${nextPremierDetenteur.nom_de_famille}`,
                //   fei_next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
                // };
                // updateFei(fei.numero, nextFei);
                // addLog({
                //   user_id: user.id,
                //   user_role: UserRoles.CHASSEUR,
                //   fei_numero: fei.numero,
                //   action: 'examinateur-trouver-premier-detenteur',
                //   history: createHistoryInput(fei, nextFei),
                //   entity_id: null,
                //   zacharie_carcasse_id: null,
                //   intermediaire_id: null,
                //   carcasse_intermediaire_id: null,
                // });
                setNextOwnerUserOrEntityId(nextPremierDetenteur.id);
              } else {
                setSearchingUserError(userSearchResponse.error ?? 'Erreur inconnue');
              }
            }}
          >
            <Input
              label="Saisissez l'email du Premier Détenteur"
              disabled={disabled}
              hintText="Nous l'ajouterons automatiquement à la liste de vos partenaires pour la prochaine fiche"
              nativeInputProps={{
                id: Prisma.UserScalarFieldEnum.email,
                name: Prisma.UserScalarFieldEnum.email,
                type: 'email',
                autoComplete: 'off',
              }}
            />
            <Button type="submit" disabled={isSearchingUser || disabled}>
              {!isSearchingUser ? 'Rechercher' : 'Recherche en cours...'}
            </Button>
            {!isOnline && (
              <div className="absolute inset-0 z-50 flex items-end bg-white/70">
                <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                  ✋ ❌ Cette fonctionnalité n'existe pas sans connexion internet.
                </p>
              </div>
            )}
          </form>
          {searchingUserError && (
            <>
              {searchingUserError === "L'utilisateur n'existe pas" ? (
                <Alert
                  severity="error"
                  title="Aucun premier détenteur est inscrit avec cette adresse mail."
                  description="Merci de vérifier cette adresse auprès du premier détenteur."
                  className="mt-4"
                />
              ) : (
                <Alert severity="error" title={searchingUserError} className="mt-4" />
              )}
            </>
          )}
          <Button
            priority="secondary"
            className="mt-4 block"
            linkProps={{
              to: `/app/tableau-de-bord/mon-profil/mes-associations-de-chasse?redirect=/app/tableau-de-bord/fei/${fei.numero}`,
            }}
          >
            Ajouter une association / société / domaine de chasse
          </Button>
          <Button
            priority="tertiary no outline"
            className="mt-4 block"
            type="button"
            onClick={() => setShowSearchUserByEmail(false)}
          >
            Retour
          </Button>
        </>
      )}

      {nextOwnerName &&
        (fei.fei_next_owner_user_id === nextOwnerUser?.id ||
          fei.fei_next_owner_entity_id === nextOwnerEntity?.id) && (
          <>
            <Alert
              severity="success"
              className="mt-6"
              description={`${nextOwnerName} ${fei.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
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
