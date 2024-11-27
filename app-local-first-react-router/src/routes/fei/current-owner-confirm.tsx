import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { useMemo } from 'react';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import { UserRoles, FeiIntermediaire } from '@prisma/client';
import dayjs from 'dayjs';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';

export default function CurrentOwnerConfirm({
  setSelectedTabId,
}: {
  setSelectedTabId: (id: string) => void;
}) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const fei = state.feis[params.fei_numero!];
  const collecteursProsRelatedWithMyETGs = state.collecteursProsRelatedWithMyETGs;
  const collecteursPro = state.collecteursProIds.map((id) => state.entities[id]);

  const nextOwnerEntity = state.entities[fei.fei_next_owner_entity_id!];

  const canConfirmCurrentOwner = useMemo(() => {
    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }
    if (
      nextOwnerEntity &&
      (nextOwnerEntity.relation === 'WORKING_FOR' ||
        nextOwnerEntity.relation === 'WORKING_FOR_ENTITY_RELATED_WITH')
    ) {
      return true;
    }
    return false;
  }, [fei, user, nextOwnerEntity]);

  const nextOwnerCollecteurProEntityId = useMemo(() => {
    if (fei.fei_next_owner_role === UserRoles.COLLECTEUR_PRO) {
      return fei.fei_next_owner_entity_id;
    }
    if (fei.fei_next_owner_role === UserRoles.ETG) {
      if (!user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
        return '';
      }
      const etgId = fei.fei_next_owner_entity_id;
      console.log('etgId', etgId);
      console.log('collecteursProsRelatedWithMyETGs', collecteursProsRelatedWithMyETGs);
      const collecteurProId = collecteursProsRelatedWithMyETGs.find((c) => c.etg_id === etgId)?.entity_id;
      if (collecteurProId) {
        return collecteurProId;
      }
    }
    return '';
  }, [fei, user, collecteursProsRelatedWithMyETGs]);

  const needNextOwnerButNotMe = useMemo(() => {
    if (!fei.fei_next_owner_user_id && !fei.fei_next_owner_entity_id) {
      return false;
    }
    if (canConfirmCurrentOwner) {
      return false;
    }
    return true;
  }, [fei, canConfirmCurrentOwner]);

  if (!fei.fei_next_owner_role) {
    return null;
  }

  if (!canConfirmCurrentOwner) {
    if (needNextOwnerButNotMe) {
      return (
        <div className="bg-alt-blue-france pb-8">
          <div className="bg-white">
            <Alert
              severity="info"
              description={`Cette fiche a été attribuée à un intervenant que vous ne pouvez pas représenter.\u00a0C'est à elle ou lui d'intervenir.`}
              title={`Fiche en attente de prise en charge par\u00A0: ${nextOwnerEntity?.nom_d_usage}`}
            />
          </div>
        </div>
      );
    }
    return null;
  }

  function handlePriseEnCharge({
    transfer,
    forcedNextRole,
    forceNextEntityId,
    forceNextEntityName,
  }: {
    transfer: boolean;
    forcedNextRole?: UserRoles;
    forceNextEntityId?: string;
    forceNextEntityName?: string;
  }) {
    const currentOwnerRole = forcedNextRole || fei.fei_next_owner_role;
    const nextFei: Partial<FeiWithIntermediaires> = {
      fei_current_owner_role: currentOwnerRole,
      fei_current_owner_entity_id: forceNextEntityId || fei.fei_next_owner_entity_id,
      fei_current_owner_entity_name_cache: forceNextEntityName || fei.fei_next_owner_entity_name_cache,
      fei_current_owner_user_id: fei.fei_next_owner_user_id || user.id,
      fei_current_owner_user_name_cache:
        fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
      fei_current_owner_wants_to_transfer: transfer ? true : null,
      fei_next_owner_role: null,
      fei_next_owner_user_id: null,
      fei_next_owner_user_name_cache: null,
      fei_next_owner_entity_id: null,
      fei_next_owner_entity_name_cache: null,
      fei_prev_owner_role: fei.fei_current_owner_role || null,
      fei_prev_owner_user_id: fei.fei_current_owner_user_id || null,
      fei_prev_owner_entity_id: fei.fei_current_owner_entity_id || null,
    };
    if (nextFei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      nextFei.examinateur_initial_user_id = user.id;
      nextFei.examinateur_initial_offline = navigator.onLine ? false : true;
    }
    if (nextFei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      nextFei.premier_detenteur_user_id = user.id;
      nextFei.premier_detenteur_offline = navigator.onLine ? false : true;
    }
    if (nextFei.fei_current_owner_role === UserRoles.SVI) {
      nextFei.svi_user_id = user.id;
    }

    updateFei(fei.numero, nextFei);

    const intermediaireRole: (keyof typeof UserRoles)[] = [
      UserRoles.COLLECTEUR_PRO,
      UserRoles.ETG,
      UserRoles.CCG,
    ];

    if (intermediaireRole.includes(nextFei.fei_current_owner_role!)) {
      const newIntermediaireId = `${user.id}_${fei.numero}_${dayjs().format('HHmmss')}`;
      const newIntermediaire: FeiIntermediaire = {
        id: newIntermediaireId,
        fei_numero: fei.numero,
        fei_intermediaire_offline: navigator.onLine ? false : true,
        fei_intermediaire_user_id: user.id,
        fei_intermediaire_role: forcedNextRole || fei.fei_next_owner_role!,
        fei_intermediaire_entity_id: forceNextEntityId || fei.fei_next_owner_entity_id || '',
        check_finished_at: null,
        created_at: dayjs().toDate(),
        updated_at: dayjs().toDate(),
        commentaire: null,
        deleted_at: null,
        handover_at: null,
        received_at: null,
        is_synced: false,
      };
      useZustandStore.getState().createFeiIntermediaire(newIntermediaire);
    }
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <CallOut
        title={
          fei.fei_next_owner_user_id
            ? '🫵  Cette fiche vous a été attribuée'
            : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role)}</b>
        {nextOwnerEntity?.nom_d_usage ? ` (${nextOwnerEntity?.nom_d_usage})` : ''}, vous pouvez prendre en
        charge cette fiche et les carcasses associées.
        <br />
        {fei.fei_next_owner_role === UserRoles.PREMIER_DETENTEUR && (
          <Button
            type="submit"
            className="my-4 block"
            onClick={() => handlePriseEnCharge({ transfer: false })}
          >
            <>Je prends en charge cette fiche et les carcasses associées</>
          </Button>
        )}
        {fei.fei_next_owner_role === UserRoles.SVI && (
          <Button
            type="submit"
            className="my-4 block"
            onClick={() => {
              handlePriseEnCharge({ transfer: false });
              setSelectedTabId(UserRoles.SVI);
            }}
          >
            <>Je prends en charge cette fiche</>
          </Button>
        )}
        {fei.fei_next_owner_role === UserRoles.ETG && (
          <>
            {nextOwnerCollecteurProEntityId ? (
              <>
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={() => {
                    handlePriseEnCharge({
                      transfer: false,
                      forcedNextRole: UserRoles.COLLECTEUR_PRO,
                      forceNextEntityId: nextOwnerCollecteurProEntityId,
                      forceNextEntityName:
                        collecteursPro.find((c) => c.id === nextOwnerCollecteurProEntityId)?.nom_d_usage ||
                        '',
                    });
                    setSelectedTabId('Destinataires');
                  }}
                >
                  Je transporte le gibier
                </Button>
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={() => {
                    handlePriseEnCharge({ transfer: false });
                    setSelectedTabId('Destinataires');
                  }}
                >
                  Je suis à l'atelier pour réceptionner le gibier
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                className="my-4 block"
                onClick={() => {
                  handlePriseEnCharge({ transfer: false });
                  setSelectedTabId('Destinataires');
                }}
              >
                Je réceptionne le gibier
              </Button>
            )}
          </>
        )}
        <span>
          Vous souhaitez la transférer à un autre acteur&nbsp;? (exemple: erreur d'attribution, assignation à
          un autre collecteur)
        </span>
        <Button
          priority="tertiary"
          type="button"
          className="!mt-2 block"
          onClick={() => handlePriseEnCharge({ transfer: true })}
        >
          Transférer la fiche
        </Button>
        <span className="mt-4 inline-block text-sm">Vous souhaitez la renvoyer à l'expéditeur&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="!mt-0 text-sm"
          onClick={() => {
            updateFei(fei.numero, {
              fei_next_owner_entity_id: null,
              fei_next_owner_entity_name_cache: null,
              fei_next_owner_user_id: null,
              fei_next_owner_user_name_cache: null,
            });
          }}
        >
          Renvoyer la fiche
        </Button>
      </CallOut>
    </div>
  );
}
