import { Link, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import { UserRoles, Prisma, EntityTypes } from '@prisma/client';
import dayjs from 'dayjs';
import UserNotEditable from '@app/components/UserNotEditable';
import SelectNextOwnerForPremierDetenteurOrIntermediaire from './premier-detenteur-intermediaire-select-next';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Select } from '@codegouvfr/react-dsfr/Select';
import InputNotEditable from '@app/components/InputNotEditable';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import EntityNotEditable from '@app/components/EntityNotEditable';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function FeiPremierDetenteur({ showIdentity }: { showIdentity: boolean }) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id]
    : null;
  const premierDetenteurDepotEntity = fei.premier_detenteur_depot_entity_id
    ? state.entities[fei.premier_detenteur_depot_entity_id]
    : null;
  const ccgs = state.ccgsIds.map((id) => state.entities[id]);
  const etgs = state.etgsIds.map((id) => state.entities[id]);

  // console.log('fei', fei);
  const [depotType, setDepotType] = useState(() => {
    if (fei.premier_detenteur_depot_type) {
      return fei.premier_detenteur_depot_type;
    }
    if (fei.premier_detenteur_depot_entity_id) {
      return state.entities[fei.premier_detenteur_depot_entity_id]?.type;
    }
    return EntityTypes.ETG;
  });

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.premier_detenteur_date_depot_quelque_part) {
    //   return false;
    // }
    return true;
  }, [fei, user]);

  const canChangeNextOwner = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;

  const needSelectNextUser = useMemo(() => {
    if (depotType === EntityTypes.ETG) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    return true;
  }, [fei, user, depotType]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y as pas encore de premier détenteur pour cette fiche";
  }

  return (
    <>
      {showIdentity && (
        <>
          {premierDetenteurEntity ? (
            <EntityNotEditable hideType entity={premierDetenteurEntity} user={premierDetenteurUser!} />
          ) : (
            <UserNotEditable user={premierDetenteurUser!} />
          )}
          <hr />
        </>
      )}

      <div className={['fr-fieldset__element', canEdit ? '' : 'pointer-events-none'].join(' ')}>
        <RadioButtons
          legend="Qui prend en charge mes carcasses ?"
          hintText={canEdit ? 'Étape requise pour la suite du processus' : ''}
          options={[
            {
              label: (
                <span className="inline-block">
                  Je transporte <b>le jour-même</b> mes carcasses à un Établissement de Traitement du Gibier
                  sauvage
                </span>
              ),
              nativeInputProps: {
                checked: depotType === EntityTypes.ETG,
                readOnly: !canEdit,
                onChange: () => setDepotType(EntityTypes.ETG),
              },
            },
            {
              label:
                'J’ai déposé mes carcasses dans un centre de collecte du gibier sauvage (chambre froide)',
              nativeInputProps: {
                checked: depotType === EntityTypes.CCG,
                readOnly: !canEdit,
                onChange: () => setDepotType(EntityTypes.CCG),
              },
            },
          ]}
        />
      </div>
      <form
        method="POST"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          // if the depot is ETG then the next role is ETG
          // if the depot is CCG then the next role is we don't know yet
          const premier_detenteur_depot_entity_id = formData.get(
            Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
          ) as string;
          let nextFei: Partial<typeof fei>;
          if (depotType === EntityTypes.ETG) {
            nextFei = {
              premier_detenteur_depot_type: depotType,
              premier_detenteur_depot_entity_id,
              premier_detenteur_date_depot_quelque_part: dayjs(
                formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string,
              ).toDate(),
              fei_next_owner_entity_id: premier_detenteur_depot_entity_id,
              fei_next_owner_role: EntityTypes.ETG,
            };
          } else {
            nextFei = {
              premier_detenteur_depot_type: depotType,
              premier_detenteur_depot_entity_id,
              premier_detenteur_date_depot_quelque_part: dayjs(
                formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part) as string,
              ).toDate(),
            };
          }
          updateFei(fei.numero, nextFei);
          addLog({
            user_id: user.id,
            user_role: UserRoles.PREMIER_DETENTEUR,
            action: 'premier-detenteur-depot',
            fei_numero: fei.numero,
            history: createHistoryInput(fei, nextFei),
            entity_id: fei.premier_detenteur_entity_id,
            zacharie_carcasse_id: null,
            carcasse_intermediaire_id: null,
            fei_intermediaire_id: null,
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <div className="fr-fieldset__element">
          {canChangeNextOwner && depotType === EntityTypes.CCG && (
            <Select
              label="Centre de collecte"
              hint={
                <Link
                  className="!bg-none !no-underline"
                  to={`/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`}
                >
                  Vous n'avez pas encore renseigné votre centre de collecte ? Vous pouvez le faire en{' '}
                  <u className="inline">cliquant ici</u>
                </Link>
              }
              className="!mb-0 grow"
              nativeSelectProps={{
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                required: true,
                defaultValue: ccgs.length === 1 ? ccgs[0].id : (fei.premier_detenteur_depot_entity_id ?? ''),
              }}
            >
              <option value="">Sélectionnez un centre de collecte</option>
              {/* <hr /> */}
              {ccgs.map((entity) => {
                return (
                  <option key={entity.id} value={entity.id}>
                    {entity.nom_d_usage} - {entity.code_postal} {entity.ville} (
                    {getUserRoleLabel(entity.type)})
                  </option>
                );
              })}
            </Select>
          )}
          {canChangeNextOwner && depotType === EntityTypes.ETG && (
            <Select
              label="Sélectionnez un Établissement de Transformation du Gibier sauvage"
              hint="La fiche lui sera transmise"
              className="!mb-0 grow"
              nativeSelectProps={{
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                required: true,
                defaultValue: etgs.length === 1 ? etgs[0].id : (fei.premier_detenteur_depot_entity_id ?? ''),
              }}
            >
              <option value="">Sélectionnez</option>
              {/* <hr /> */}
              {etgs.map((entity) => {
                return (
                  <option key={entity.id} value={entity.id}>
                    {entity.nom_d_usage} - {entity.code_postal} {entity.ville} (
                    {getUserRoleLabel(entity.type)})
                  </option>
                );
              })}
            </Select>
          )}
          {!canChangeNextOwner && (
            <InputNotEditable
              label={
                depotType === EntityTypes.CCG
                  ? 'Centre de collecte'
                  : 'Établissement de Traitement du Gibier sauvage'
              }
              nativeInputProps={{
                type: 'text',
                autoComplete: 'off',
                defaultValue: `${premierDetenteurDepotEntity?.nom_d_usage} - ${premierDetenteurDepotEntity?.code_postal} ${premierDetenteurDepotEntity?.ville}`,
              }}
            />
          )}
        </div>
        <div className="fr-fieldset__element">
          <Component
            label="Date de dépôt dans la chambre froide"
            // click here to set now
            hintText={
              <button
                className="inline-block"
                type="button"
                onClick={() => {
                  updateFei(fei.numero, {
                    premier_detenteur_date_depot_quelque_part: dayjs().toDate(),
                  });
                }}
              >
                Vous les déposez à l'instant ? <u className="inline">Cliquez ici</u> pour définir la date du
                jour
              </button>
            }
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              name: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              type: 'datetime-local',
              autoComplete: 'off',
              suppressHydrationWarning: true,
              defaultValue: fei?.premier_detenteur_date_depot_quelque_part
                ? dayjs(fei?.premier_detenteur_date_depot_quelque_part).format('YYYY-MM-DDTHH:mm')
                : undefined,
            }}
          />
        </div>
        {canChangeNextOwner && canEdit && (
          <Button type="submit">
            {depotType === EntityTypes.ETG ? 'Enregistrer et envoyer la fiche' : 'Enregistrer'}
          </Button>
        )}
      </form>
      {needSelectNextUser && (
        <>
          <hr className="mt-8" />
          <div className="z-50 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
            <SelectNextOwnerForPremierDetenteurOrIntermediaire />
          </div>
        </>
      )}
      {canChangeNextOwner &&
        depotType === EntityTypes.ETG &&
        (fei.fei_next_owner_user_id || fei.fei_next_owner_entity_id) && (
          <>
            <Alert
              className="mt-8"
              severity="success"
              description={`${premierDetenteurDepotEntity?.nom_d_usage} ${fei.is_synced ? 'a été notifié' : 'sera notifié dès que vous aurez retrouvé du réseau'}.`}
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
