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
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useGetMyNextRoleForThisFei, useNextOwnerCollecteurProEntityId } from '@app/utils/collecteurs-pros';

export default function CurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const createFeiIntermediaire = useZustandStore((state) => state.createFeiIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const collecteursProIds = useZustandStore((state) => state.collecteursProIds);
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const collecteursPro = collecteursProIds.map((id) => entities[id]);

  const nextOwnerEntity = entities[fei.fei_next_owner_entity_id!];
  const nextOwnerUser = users[fei.fei_next_owner_user_id!];

  const isTransporting = useMemo(() => {
    if (!user.roles.includes(UserRoles.ETG) && !user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
      return false;
    }
    return (
      fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO && fei.fei_next_owner_role === UserRoles.ETG
    );
  }, [fei, user]);

  const canConfirmCurrentOwner = useMemo(() => {
    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }
    if (!nextOwnerEntity) {
      return false;
    }
    if (
      nextOwnerEntity.relation !== 'WORKING_FOR' &&
      nextOwnerEntity.relation !== 'WORKING_FOR_ENTITY_RELATED_WITH'
    ) {
      return false;
    }
    if (user.roles.includes(UserRoles.SVI)) {
      if (fei.fei_next_owner_role !== UserRoles.SVI) {
        return false;
      }
    }
    if (fei.fei_next_owner_role === UserRoles.SVI) {
      if (!user.roles.includes(UserRoles.SVI)) {
        return false;
      }
    }

    if (fei.fei_next_owner_role === UserRoles.ETG) {
      // if (user.roles.includes(UserRoles.COLLECTEUR_PRO) && !user.roles.includes(UserRoles.ETG)) {
      // FIXME: il ne peut y avoir pour le moment qu'un seul collecteur pro pour une fiche
      if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) {
        if (fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
          return false;
        }
      }
    }
    return true;
  }, [fei, user, nextOwnerEntity]);

  const needNextOwnerButNotMe = useMemo(() => {
    if (!fei.fei_next_owner_user_id && !fei.fei_next_owner_entity_id) {
      return false;
    }
    if (canConfirmCurrentOwner) {
      return false;
    }
    return true;
  }, [fei, canConfirmCurrentOwner]);

  const nextOwnerCollecteurProEntityId = useNextOwnerCollecteurProEntityId(fei, user);
  const myNextRoleForThisFei = useGetMyNextRoleForThisFei(fei, user);

  const myNextRoleForThisFeiIsCollecteurPro = myNextRoleForThisFei === UserRoles.COLLECTEUR_PRO;

  if (!fei.fei_next_owner_role) {
    return null;
  }

  async function handlePriseEnCharge({
    transfer,
    action,
    forcedNextRole,
    forceNextEntityId,
    forceNextEntityName,
  }: {
    transfer: boolean;
    action?: string;
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
        // on met le check fini pour que le transporteur n'ait qu'un seul clic à faire
        check_finished_at:
          nextFei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO ? dayjs().toDate() : null,
        created_at: dayjs().toDate(),
        updated_at: dayjs().toDate(),
        commentaire: null,
        deleted_at: null,
        handover_at: null,
        received_at: null,
        is_synced: false,
      };
      await createFeiIntermediaire(newIntermediaire);
      addLog({
        user_id: user.id,
        user_role: newIntermediaire.fei_intermediaire_role!,
        fei_numero: fei.numero,
        action: 'intermediaire-create',
        history: createHistoryInput(null, newIntermediaire),
        entity_id: fei.fei_current_owner_entity_id,
        zacharie_carcasse_id: null,
        fei_intermediaire_id: newIntermediaireId,
        carcasse_intermediaire_id: null,
      });
      if (nextFei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO) {
        // on envoie directement à l'ETG
        if (fei.fei_next_owner_role === UserRoles.ETG) {
          nextFei.fei_next_owner_role = UserRoles.ETG;
          nextFei.fei_next_owner_entity_id = fei.fei_next_owner_entity_id;
          nextFei.fei_next_owner_entity_name_cache = fei.fei_next_owner_entity_name_cache;
          nextFei.fei_next_owner_user_id = null;
          nextFei.fei_next_owner_user_name_cache = null;
        }
      }
    }
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: nextFei.fei_current_owner_role!,
      fei_numero: fei.numero,
      action: action || 'current-owner-confirm',
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.fei_current_owner_entity_id,
      zacharie_carcasse_id: null,
      fei_intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  }

  if (!canConfirmCurrentOwner) {
    if (isTransporting) {
      const nextName =
        nextOwnerEntity?.nom_d_usage || `${nextOwnerUser?.prenom} ${nextOwnerUser?.nom_de_famille}`;
      const canReception = user.roles.includes(UserRoles.ETG);
      let description = canReception ? (
        <button
          onClick={() => {
            handlePriseEnCharge({ transfer: false });
          }}
          type="button"
        >
          Bonne route ! Vous êtes arrivé à destination et souhaitez réceptionner le gibier ?{' '}
          <u>Cliquez ici</u>
        </button>
      ) : (
        `Cette fiche lui a déjà été attribuée, il a déjà été notifié, il est prêt à recevoir votre chargement. Bonne route !`
      );

      return (
        <div className="bg-alt-blue-france pb-8">
          <div className="bg-white">
            <Alert
              severity="info"
              title={`Vous transportez les carcasses vers\u00A0: ${nextName}`}
              description={description}
            />
          </div>
        </div>
      );
    }
    if (needNextOwnerButNotMe) {
      const nextName =
        nextOwnerEntity?.nom_d_usage || `${nextOwnerUser?.prenom} ${nextOwnerUser?.nom_de_famille}`;
      return (
        <div className="bg-alt-blue-france pb-8">
          <div className="bg-white">
            <Alert
              severity="info"
              description={`Cette fiche a été attribuée à un intervenant que vous ne pouvez pas représenter.\u00a0C'est à elle ou lui d'intervenir.`}
              title={`Fiche en attente de prise en charge par\u00A0: ${nextName}`}
            />
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <CallOut
        title={
          fei.fei_next_owner_user_id
            ? '🫵  Cette fiche vous a été attribuée'
            : fei.fei_next_owner_role === UserRoles.SVI
              ? '🫵  Cette fiche a été attribuée à votre service'
              : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        En tant que <b>{getUserRoleLabel(myNextRoleForThisFei!)}</b>
        {nextOwnerEntity?.nom_d_usage ? ` (${nextOwnerEntity?.nom_d_usage})` : ''}, vous pouvez prendre en
        charge cette fiche et les carcasses associées.
        <br />
        {fei.fei_next_owner_role === UserRoles.PREMIER_DETENTEUR && (
          <Button
            type="submit"
            className="my-4 block"
            onClick={() =>
              handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-premier-detenteur' })
            }
          >
            Je prends en charge cette fiche et les carcasses associées
          </Button>
        )}
        {fei.fei_next_owner_role === UserRoles.SVI && (
          <Button
            type="submit"
            className="my-4 block"
            onClick={() => {
              handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-svi' });
            }}
          >
            Je prends en charge cette fiche
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
                      action: 'current-owner-confirm-etg-and-transporteur-transporte',
                      forcedNextRole: UserRoles.COLLECTEUR_PRO,
                      forceNextEntityId: nextOwnerCollecteurProEntityId,
                      forceNextEntityName:
                        collecteursPro.find((c) => c.id === nextOwnerCollecteurProEntityId)?.nom_d_usage ||
                        '',
                    });
                  }}
                >
                  Je transporte le gibier
                </Button>
                {user.roles.includes(UserRoles.ETG) && (
                  <Button
                    type="submit"
                    className="my-4 block"
                    onClick={() => {
                      handlePriseEnCharge({
                        transfer: false,
                        action: 'current-owner-confirm-etg-and-transporteur-receptionne',
                      });
                    }}
                  >
                    Je suis à l'atelier pour réceptionner le gibier
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="submit"
                className="my-4 block"
                onClick={() => {
                  handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-etg-reception' });
                }}
              >
                Je réceptionne le gibier
              </Button>
            )}
          </>
        )}
        {!myNextRoleForThisFeiIsCollecteurPro && (
          <>
            <span>
              Vous souhaitez la transférer à un autre acteur&nbsp;? (exemple: erreur d'attribution,
              assignation à un autre collecteur)
            </span>
            <Button
              priority="tertiary"
              type="button"
              className="!mt-2 block"
              onClick={() => handlePriseEnCharge({ transfer: true, action: 'current-owner-transfer' })}
            >
              Transférer la fiche
            </Button>
            <span className="mt-4 inline-block text-sm">
              Vous souhaitez la renvoyer à l'expéditeur&nbsp;?
            </span>
            <Button
              priority="tertiary no outline"
              type="submit"
              className="!mt-0 text-sm"
              onClick={() => {
                const nextFei = {
                  fei_next_owner_entity_id: null,
                  fei_next_owner_entity_name_cache: null,
                  fei_next_owner_user_id: null,
                  fei_next_owner_user_name_cache: null,
                };
                updateFei(fei.numero, nextFei);
                addLog({
                  user_id: user.id,
                  user_role: fei.fei_next_owner_role!,
                  fei_numero: fei.numero,
                  action: 'current-owner-renvoi',
                  entity_id: fei.fei_next_owner_entity_id,
                  zacharie_carcasse_id: null,
                  fei_intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                  history: createHistoryInput(fei, nextFei),
                });
              }}
            >
              Renvoyer la fiche
            </Button>
          </>
        )}
      </CallOut>
    </div>
  );
}
