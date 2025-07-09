import { Select } from '@codegouvfr/react-dsfr/Select';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { EntityWithUserRelation } from '~/src/types/entity';
import { UserRoles, Prisma, Carcasse, EntityRelationType } from '@prisma/client';
import { useMemo, useState } from 'react';
// import { mergeFei } from '@app/db/fei.client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function SelectNextOwnerForPremierDetenteurOrIntermediaire({
  calledFrom,
  disabled,
}: {
  calledFrom: 'premier-detenteur-need-select-next' | 'current-owner-transfer' | 'intermediaire-next-owner';
  disabled?: boolean;
}) {
  const params = useParams();
  const isOnline = useIsOnline();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcasses = useZustandStore((state) => state.carcassesIdsByFei[fei.numero]);
  const entities = useZustandStore((state) => state.entities);
  const ccgs = useZustandStore((state) => state.ccgsIds).map((id) => entities[id]);
  const etgsIds = useZustandStore((state) => state.etgsIds);
  const etgs = etgsIds.map((id) => entities[id]);
  const svis = useZustandStore((state) => state.svisIds).map((id) => entities[id]);
  const collecteursPro = useZustandStore((state) => state.collecteursProIds).map((id) => entities[id]);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const feiIntermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id]
    : null;

  console.log({ etgs });
  const showIntermediaires = useMemo(() => {
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      if (fei.examinateur_initial_user_id === fei.premier_detenteur_user_id) {
        return true;
      }
    }
    if (
      UserRoles.PREMIER_DETENTEUR === fei.fei_current_owner_role ||
      UserRoles.CCG === fei.fei_current_owner_role ||
      UserRoles.COLLECTEUR_PRO === fei.fei_current_owner_role
    ) {
      return true;
    }
    return false;
  }, [
    fei.premier_detenteur_user_id,
    fei.fei_current_owner_role,
    fei.examinateur_initial_user_id,
    fei.examinateur_initial_approbation_mise_sur_le_marche,
  ]);

  const showSvi = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.ETG) {
      return false;
    }
    const latestIntermediaire = feiIntermediaires[0];
    if (latestIntermediaire.intermediaire_role !== UserRoles.ETG) {
      return false;
    }
    return true;
  }, [fei.fei_current_owner_role, feiIntermediaires]);

  const nextRole = useMemo(() => {
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
  }, [fei, showIntermediaires, showSvi, collecteursPro, etgs]);

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

  const isEtgWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.ETG && !!fei.fei_current_owner_entity_id) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (etgsIds.includes(fei.fei_current_owner_entity_id)) {
          const etg = entities[fei.fei_current_owner_entity_id];
          if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
            return true;
          }
        }
      }
    }
    if (
      fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === UserRoles.ETG &&
      !!fei.fei_next_owner_entity_id
    ) {
      if (user.roles.includes(UserRoles.ETG)) {
        if (etgsIds.includes(fei.fei_next_owner_entity_id)) {
          const etg = entities[fei.fei_next_owner_entity_id];
          if (etg.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
            return true;
          }
        }
      }
    }
    return false;
  }, [fei, user, etgsIds, entities]);

  const canSelectNextOwner = useMemo(() => {
    if (
      premierDetenteurEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
      fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR
    ) {
      return true;
    }
    if (isEtgWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.svi_closed_at) {
      return false;
    }
    if (fei.automatic_closed_at) {
      return false;
    }
    if (fei.intermediaire_closed_at) {
      return false;
    }
    return true;
  }, [
    premierDetenteurEntity?.relation,
    fei.fei_current_owner_role,
    fei.fei_current_owner_user_id,
    fei.svi_closed_at,
    fei.automatic_closed_at,
    isEtgWorkingFor,
    user.id,
    fei.intermediaire_closed_at,
  ]);

  if (!canSelectNextOwner) {
    return null;
  }

  const nextOwnersWorkingWith = nextOwners.filter((o) => o.relation !== 'NONE');
  const nextOwnersNotWorkingWith = nextOwners.filter((o) => o.relation === 'NONE');

  return (
    <>
      <form
        id="select-next-owner"
        method="POST"
        className={disabled ? 'pointer-events-none opacity-50' : ''}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) {
            return;
          }
          const nextFei = {
            fei_next_owner_entity_id: nextOwnerValue,
            fei_next_owner_role: nextRole,
            svi_assigned_at: nextRole === UserRoles.SVI ? dayjs().toDate() : null,
            svi_entity_id: nextRole === UserRoles.SVI ? nextOwnerValue : null,
          };
          updateFei(fei.numero, nextFei);
          if (nextRole === UserRoles.SVI) {
            const nextCarcasse: Partial<Carcasse> = {
              svi_assigned_to_fei_at: nextRole === UserRoles.SVI ? dayjs().toDate() : null,
            };
            for (const zacharie_carcasse_id of carcasses) {
              updateCarcasse(zacharie_carcasse_id, nextCarcasse);
            }
          }
          addLog({
            user_id: user.id,
            action: calledFrom,
            fei_numero: fei.numero,
            history: createHistoryInput(fei, nextFei),
            user_role: fei.fei_current_owner_role!,
            entity_id: fei.fei_current_owner_entity_id,
            zacharie_carcasse_id: null,
            carcasse_intermediaire_id: null,
            intermediaire_id: null,
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        {nextRole && (
          <>
            <Select
              // label={`Quel ${getUserRoleLabel(nextRole)} doit intervenir sur la fiche ?`}
              label={`Qui est le destinataire de mes carcasses\u00A0?`}
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
              <Button type="submit" disabled={disabled || !nextOwnerValue}>
                Envoyer
              </Button>
            )}
          </>
        )}
      </form>
      {fei.fei_next_owner_entity_id && (
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
