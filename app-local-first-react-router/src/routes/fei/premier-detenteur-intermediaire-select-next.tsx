import { Select } from '@codegouvfr/react-dsfr/Select';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { EntityWithUserRelation } from '~/src/types/entity';
import { UserRoles, Prisma } from '@prisma/client';
import { useMemo, useState } from 'react';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
// import { mergeFei } from '@app/db/fei.client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function SelectNextOwnerForPremierDetenteurOrIntermediaire() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const fei = state.feis[params.fei_numero!];
  const entities = state.entities;
  const ccgs = state.ccgsIds.map((id) => state.entities[id]);
  const etgs = state.etgsIds.map((id) => state.entities[id]);
  const svis = state.svisIds.map((id) => state.entities[id]);

  const collecteursPro = state.collecteursProIds.map((id) => state.entities[id]);
  const feiIntermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  const showIntermediaires = useMemo(() => {
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      if (fei.examinateur_initial_user_id === fei.premier_detenteur_user_id) {
        return true;
      }
    }
    if (!fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    if (
      UserRoles.PREMIER_DETENTEUR !== fei.fei_current_owner_role &&
      UserRoles.CCG !== fei.fei_current_owner_role &&
      UserRoles.COLLECTEUR_PRO !== fei.fei_current_owner_role
    ) {
      return false;
    }
    return true;
  }, [
    fei.premier_detenteur_user_id,
    fei.fei_current_owner_role,
    fei.examinateur_initial_user_id,
    fei.examinateur_initial_approbation_mise_sur_le_marche,
    fei.premier_detenteur_date_depot_quelque_part,
  ]);

  const showSvi = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.ETG) {
      return false;
    }
    const latestIntermediaire = feiIntermediaires[0];
    if (latestIntermediaire.fei_intermediaire_role !== UserRoles.ETG) {
      return false;
    }
    if (!latestIntermediaire.check_finished_at) {
      return false;
    }
    return true;
  }, [fei.fei_current_owner_role, feiIntermediaires]);

  const [nextRole, setNextRole] = useState<UserRoles | null>(() => {
    if (showIntermediaires) {
      return UserRoles.ETG;
    }
    if (showSvi) {
      return UserRoles.SVI;
    }
    if (fei.fei_next_owner_role) {
      return fei.fei_next_owner_role as UserRoles;
    }
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      const depotAtEntityId = fei.premier_detenteur_depot_entity_id;
      if (depotAtEntityId) {
        const potentielDepotEntity = [...collecteursPro, ...etgs].find(
          (entity) => entity.id === depotAtEntityId,
        );
        if (potentielDepotEntity) {
          return potentielDepotEntity.type;
        }
      }
    }
    return fei.fei_next_owner_role ?? null;
  });

  const nextOwners = useMemo(() => {
    switch (nextRole) {
      case UserRoles.CCG:
        return ccgs;
      case UserRoles.COLLECTEUR_PRO:
        return collecteursPro;
      case UserRoles.ETG:
        return etgs;
      case UserRoles.SVI:
        return svis;
      default:
        return [];
    }
  }, [nextRole, ccgs, collecteursPro, etgs, svis]);
  const nextOwnerSelectLabel = useMemo(() => {
    switch (nextRole) {
      case UserRoles.CCG:
      case UserRoles.COLLECTEUR_PRO:
      case UserRoles.ETG:
        return 'Sélectionnez le destinataire';
      case UserRoles.SVI:
        return "Sélectionnez le Service Vétérinaire d'Inspection pour cette fiche";
      default:
        return [];
    }
  }, [nextRole]);

  const nextOwnerName = fei.fei_next_owner_entity_id
    ? entities[fei.fei_next_owner_entity_id]?.nom_d_usage
    : '';

  const savedNextOwner = fei.fei_next_owner_entity_id;
  const [nextOwnerValue, setNextOwnerValue] = useState(() => {
    if (savedNextOwner) {
      return savedNextOwner;
    }
    if (showIntermediaires) {
      return etgs[0]?.id;
    }
    if (showSvi) {
      return svis[0]?.id;
    }
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      return fei.premier_detenteur_depot_entity_id ?? '';
    }
    return '';
  });

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }

  if (fei.svi_signed_at) {
    return null;
  }

  const nextOwnersWorkingWith = nextOwners.filter((o) => o.relation !== 'NONE');
  const nextOwnersNotWorkingWith = nextOwners.filter((o) => o.relation === 'NONE');

  return (
    <>
      <form
        id="select-next-owner"
        method="POST"
        onSubmit={(event) => {
          event.preventDefault();
          const nextFei = {
            fei_next_owner_entity_id: nextOwnerValue,
            fei_next_owner_role: nextRole,
            svi_assigned_at: nextRole === UserRoles.SVI ? dayjs().toDate() : null,
            svi_entity_id: nextRole === UserRoles.SVI ? nextOwnerValue : null,
          };
          updateFei(fei.numero, nextFei);
          addLog({
            user_id: user.id,
            action: 'premier-detenteur-intermediaire-select-next',
            fei_numero: fei.numero,
            history: createHistoryInput(fei, nextFei),
            user_role: UserRoles.PREMIER_DETENTEUR,
            entity_id: fei.premier_detenteur_entity_id,
            zacharie_carcasse_id: null,
            carcasse_intermediaire_id: null,
            fei_intermediaire_id: null,
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <div className="fr-fieldset__element hidden">
          <Select
            label="Qui doit désormais agir sur la fiche ?"
            className="!mb-0 grow"
            nativeSelectProps={{
              name: Prisma.FeiScalarFieldEnum.fei_next_owner_role,
              value: nextRole || '',
              onChange: (e) => {
                const _nextRole = e.target.value as UserRoles;
                setNextRole(_nextRole);
                switch (_nextRole) {
                  case UserRoles.CCG:
                    if (ccgs.length === 1) {
                      setNextOwnerValue(ccgs[0].id);
                    }
                    break;
                  case UserRoles.COLLECTEUR_PRO:
                    if (collecteursPro.length === 1) {
                      setNextOwnerValue(collecteursPro[0].id);
                    }
                    break;
                  case UserRoles.ETG:
                    if (etgs.length === 1) {
                      setNextOwnerValue(etgs[0].id);
                    }
                    break;
                  case UserRoles.SVI:
                    if (svis.length === 1) {
                      setNextOwnerValue(svis[0].id);
                    }
                    break;
                  default:
                    break;
                }
              },
            }}
          >
            <option value="">Sélectionnez le prochain type d'acteur à agir sur la fiche</option>
            {/* <hr /> */}
            {showIntermediaires ? (
              <>
                {/* <option value={UserRoles.COLLECTEUR_PRO}>{getUserRoleLabel(UserRoles.COLLECTEUR_PRO)}</option> */}
                <option value={UserRoles.ETG}>{getUserRoleLabel(UserRoles.ETG)}</option>
                {/* <option value={UserRoles.CCG}>{getUserRoleLabel(UserRoles.CCG)}</option> */}
              </>
            ) : showSvi ? (
              <option value={UserRoles.SVI}>{getUserRoleLabel(UserRoles.SVI)}</option>
            ) : null}
          </Select>
        </div>
        {nextRole && (
          <>
            <div className="fr-fieldset__element grow">
              <Select
                // label={`Quel ${getUserRoleLabel(nextRole)} doit intervenir sur la fiche ?`}
                label={`Qui est le destinataire de mes carcasses\u00A0?`}
                className="!mb-0 grow"
                key={fei.fei_next_owner_entity_id ?? 'no-choice-yet'}
                nativeSelectProps={{
                  name: Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id,
                  value: nextOwnerValue,
                  onChange: (e) => setNextOwnerValue(e.target.value),
                }}
              >
                <option value="">{nextOwnerSelectLabel}</option>
                {nextOwnersWorkingWith.length > 0 && (
                  <>
                    {/* <optgroup label={`Mes ${getUserRoleLabelPlural(nextRole)}`}> */}
                    {nextOwnersWorkingWith.map((potentielOwner) => {
                      return <NextOwnerOption key={potentielOwner.id} potentielOwner={potentielOwner} />;
                    })}
                    {/* </optgroup> */}
                    {/* <hr /> */}
                  </>
                )}
                {nextOwnersNotWorkingWith.map((potentielOwner) => {
                  return <NextOwnerOption key={potentielOwner.id} potentielOwner={potentielOwner} />;
                })}
              </Select>
              {(!nextOwnerValue || nextOwnerValue !== savedNextOwner) && (
                <Button type="submit" className="mt-4" disabled={!nextOwnerValue}>
                  Envoyer
                </Button>
              )}
            </div>
          </>
        )}
      </form>
      {fei.fei_next_owner_entity_id && (
        <div className="fr-fieldset__element">
          <Alert
            severity="success"
            description={`${nextOwnerName} ${fei.is_synced ? 'a été notifié' : 'sera notifié dès que vous aurez retrouvé du réseau'}.`}
            title="Attribution effectuée"
          />
          <Button
            className="mt-4"
            linkProps={{
              to: `/app/tableau-de-bord/`,
            }}
          >
            Voir toutes mes fiches
          </Button>
        </div>
      )}
    </>
  );
}

type NextOwnerOptionProps = {
  potentielOwner: EntityWithUserRelation;
};

const NextOwnerOption = ({ potentielOwner }: NextOwnerOptionProps) => {
  const user = useUser((state) => state.user)!;
  let label = '';
  label = `${potentielOwner.nom_d_usage} - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
  if (potentielOwner.id === user.id) {
    label = `Vous (${label})`;
  }
  return (
    <option key={potentielOwner.id} value={potentielOwner.id}>
      {label}
    </option>
  );
};
