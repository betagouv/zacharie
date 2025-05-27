import { Link, useParams } from 'react-router';
import { useMemo, useState } from 'react';
import { UserRoles, Prisma, EntityTypes } from '@prisma/client';
import dayjs from 'dayjs';
import SelectNextOwnerForPremierDetenteurOrIntermediaire from './premier-detenteur-intermediaire-select-next';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Select } from '@codegouvfr/react-dsfr/Select';
import InputNotEditable from '@app/components/InputNotEditable';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { usePrefillPremierDétenteurInfos } from '@app/utils/usePrefillPremierDétenteur';
import Section from '@app/components/Section';

export default function FeiPremierDetenteur() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const prefilledInfos = usePrefillPremierDétenteurInfos();

  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id]
    : null;
  const premierDetenteurDepotEntity = fei.premier_detenteur_depot_entity_id
    ? state.entities[fei.premier_detenteur_depot_entity_id]
    : prefilledInfos?.premier_detenteur_depot_entity_id
      ? state.entities[prefilledInfos.premier_detenteur_depot_entity_id]
      : null;
  const ccgs = state.ccgsIds.map((id) => state.entities[id]);
  const etgs = state.etgsIds.map((id) => state.entities[id]);

  const premierDetenteurInput = useMemo(() => {
    if (premierDetenteurEntity) {
      return premierDetenteurEntity.nom_d_usage;
    }
    return `${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  // console.log('fei', fei);
  const [depotType, setDepotType] = useState(() => {
    if (fei.premier_detenteur_depot_type) {
      return fei.premier_detenteur_depot_type;
    }
    if (fei.premier_detenteur_depot_entity_id) {
      return state.entities[fei.premier_detenteur_depot_entity_id]?.type;
    }
    if (prefilledInfos?.premier_detenteur_depot_type) {
      return prefilledInfos.premier_detenteur_depot_type;
    }
    return EntityTypes.ETG;
  });

  const canEdit = useMemo(() => {
    if (fei.automatic_closed_at || fei.svi_signed_at || fei.svi_assigned_at) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return false;
    }
    if (premierDetenteurEntity?.relation === 'WORKING_FOR') {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.premier_detenteur_date_depot_quelque_part) {
    //   return false;
    // }
    return true;
  }, [fei, user, premierDetenteurEntity]);

  const canChangeNextOwner = useMemo(() => {
    if (fei.automatic_closed_at || fei.svi_signed_at || fei.svi_assigned_at) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (premierDetenteurEntity?.relation === 'WORKING_FOR') {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user, premierDetenteurEntity]);

  const showAsDisabled = useMemo(() => {
    if (canEdit) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return true;
    }
    if (premierDetenteurEntity?.relation === 'WORKING_FOR') {
      return false;
    }
    return true;
  }, [fei, user, premierDetenteurEntity, canEdit]);

  const Component = canEdit ? Input : InputNotEditable;

  const needSelectNextUser = useMemo(() => {
    if (depotType === EntityTypes.ETG) {
      return false;
    }
    if (!fei.premier_detenteur_depot_entity_id) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id && premierDetenteurEntity?.relation !== 'WORKING_FOR') {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    return true;
  }, [fei, user, depotType, premierDetenteurEntity]);

  const entityDisplay = useMemo(() => {
    let entityDisplay = premierDetenteurDepotEntity?.nom_d_usage;
    if (premierDetenteurDepotEntity?.numero_ddecpp) {
      entityDisplay += ` - ${premierDetenteurDepotEntity?.numero_ddecpp}`;
    }
    if (premierDetenteurDepotEntity?.code_postal) {
      entityDisplay += ` - ${premierDetenteurDepotEntity?.code_postal} ${premierDetenteurDepotEntity?.ville}`;
    }
    return entityDisplay;
  }, [premierDetenteurDepotEntity]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y as pas encore de premier détenteur pour cette fiche";
  }

  return (
    <Section title={`Action du Premier détenteur | ${premierDetenteurInput}`}>
      <p className="mb-5 text-sm text-gray-500">* Les champs marqués d'une étoile sont obligatoires.</p>
      {showAsDisabled && (
        <Alert
          severity="success"
          title="En attente du premier détenteur"
          description="Vous ne pouvez pas modifier la fiche car vous n'êtes pas le Premier Détenteur"
          className="mb-5"
        />
      )}
      <div className={showAsDisabled ? 'cursor-not-allowed opacity-50' : canEdit ? '' : 'cursor-not-allowed'}>
        <RadioButtons
          legend="Où sont entreposées les carcasses ? *"
          className={canEdit ? '' : 'radio-black'}
          options={[
            {
              label: (
                <span className="inline-block">
                  Je transporte mes carcasses à un Établissement de Traitement du Gibier sauvage
                </span>
              ),
              hintText: (
                <span>
                  Elle doivent être transportées <b>le jour-même</b>
                </span>
              ),
              nativeInputProps: {
                checked: depotType === EntityTypes.ETG,
                readOnly: !canEdit,
                // disabled: !canEdit,
                onChange: () => setDepotType(EntityTypes.ETG),
              },
            },
            {
              label: 'J’ai déposé mes carcasses dans une autre chambre froide',
              hintText: `On appelle ce type de chambre froide un "centre de collecte du gibier sauvage"`,
              nativeInputProps: {
                checked: depotType === EntityTypes.CCG,
                // disabled: !canEdit,
                readOnly: !canEdit,
                onChange: () => setDepotType(EntityTypes.CCG),
              },
            },
          ]}
        />
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
          {canChangeNextOwner && depotType === EntityTypes.CCG && (
            <Select
              label="Sélectionnez la chambre froide, qui doit être un centre de collecte préalablement enregistré"
              className={canEdit ? '' : 'pointer-events-none'}
              hint={
                <Link
                  className="!bg-none !no-underline"
                  to={`/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`}
                >
                  Vous n'avez pas encore renseigné votre centre de collecte ? Vous pouvez le faire en{' '}
                  <u className="inline">cliquant ici</u>
                </Link>
              }
              nativeSelectProps={{
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                required: true,
                disabled: !canEdit,
                defaultValue:
                  prefilledInfos?.premier_detenteur_depot_entity_id ??
                  (ccgs.length === 1 ? ccgs[0].id : (fei.premier_detenteur_depot_entity_id ?? '')),
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
              label="Sélectionnez l'Établissement de Transformation du Gibier sauvage qui prendra en charge les carcasses"
              hint="La fiche lui sera transmise"
              nativeSelectProps={{
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                required: true,
                defaultValue:
                  prefilledInfos?.premier_detenteur_depot_entity_id ??
                  (etgs.length === 1 ? etgs[0].id : (fei.premier_detenteur_depot_entity_id ?? '')),
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
                defaultValue: entityDisplay ?? '',
              }}
            />
          )}
          <Component
            label={depotType === EntityTypes.CCG ? 'Date de dépôt dans la chambre froide' : 'Date de dépôt'}
            // click here to set now
            hintText={
              canEdit ? (
                <button
                  className="inline-block"
                  type="button"
                  onClick={() => {
                    updateFei(fei.numero, {
                      premier_detenteur_date_depot_quelque_part: dayjs().toDate(),
                    });
                  }}
                >
                  <u className="inline">Cliquez ici</u> pour définir la date du jour et maintenant
                </button>
              ) : null
            }
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              name: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              type: 'datetime-local',
              required: true,
              autoComplete: 'off',
              suppressHydrationWarning: true,
              defaultValue: fei?.premier_detenteur_date_depot_quelque_part
                ? dayjs(fei?.premier_detenteur_date_depot_quelque_part).format('YYYY-MM-DDTHH:mm')
                : undefined,
            }}
          />
          {canChangeNextOwner && canEdit && (
            <Button type="submit">
              {depotType === EntityTypes.ETG ? 'Enregistrer et envoyer la fiche' : 'Enregistrer'}
            </Button>
          )}
        </form>
        {depotType === EntityTypes.CCG && (
          <div
            key={needSelectNextUser ? 'true' : 'false'}
            className="z-50 mt-5 flex flex-col bg-white md:w-auto md:items-start [&_ul]:md:min-w-96"
          >
            <SelectNextOwnerForPremierDetenteurOrIntermediaire
              calledFrom="premier-detenteur-need-select-next"
              disabled={!needSelectNextUser}
            />
          </div>
        )}
        {canChangeNextOwner &&
          depotType === EntityTypes.ETG &&
          (fei.fei_next_owner_user_id || fei.fei_next_owner_entity_id) && (
            <>
              <Alert
                className="mt-6"
                severity="success"
                description={`${premierDetenteurDepotEntity?.nom_d_usage} ${fei.is_synced ? 'a été notifié' : 'sera notifié dès que vous aurez retrouvé du réseau'}.`}
                title="Attribution effectuée"
              />
            </>
          )}
      </div>
    </Section>
  );
}
