import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { useMemo } from 'react';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import {
  DepotType,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  TransportType,
  UserEtgRoles,
  UserRoles,
} from '@prisma/client';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getNewCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';
import dayjs from 'dayjs';

export default function CurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const createFeiIntermediaire = useZustandStore((state) => state.createFeiIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const latestIntermediaire = intermediaires[0];

  const currentOwnerEntity = entities[fei.fei_current_owner_entity_id!];
  const nextOwnerEntity = entities[fei.fei_next_owner_entity_id!];
  const nextOwnerUser = users[fei.fei_next_owner_user_id!];

  const needTransportFromETG = useMemo(() => {
    if (fei.fei_next_owner_role === FeiOwnerRole.ETG) {
      if (latestIntermediaire) {
        if (latestIntermediaire?.intermediaire_depot_type === DepotType.CCG) {
          return true;
        }
      } else {
        if (fei.premier_detenteur_transport_type === TransportType.PREMIER_DETENTEUR) return false;
        return true;
      }
    } else {
      return false;
    }
  }, [latestIntermediaire, fei]);

  const isETGEmployeeAndTransportingToETG = useMemo(() => {
    if (
      fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === FeiOwnerRole.ETG &&
      currentOwnerEntity?.type === EntityTypes.ETG &&
      currentOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
      fei.fei_current_owner_entity_id === fei.fei_next_owner_entity_id &&
      fei.fei_current_owner_user_id === user.id &&
      user.roles.includes(UserRoles.ETG) &&
      user.etg_roles.includes(UserEtgRoles.TRANSPORT) &&
      user.etg_roles.includes(UserEtgRoles.RECEPTION)
    ) {
      return true;
    }
    return false;
  }, [fei, user, currentOwnerEntity]);

  const canConfirmCurrentOwner = useMemo(() => {
    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }
    if (!nextOwnerEntity) {
      return false;
    }
    if (nextOwnerEntity.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return false;
    }
    if (user.roles.includes(UserRoles.SVI) || fei.fei_next_owner_role === FeiOwnerRole.SVI) {
      if (fei.fei_next_owner_role !== FeiOwnerRole.SVI) return false;
      if (!user.roles.includes(UserRoles.SVI)) return false;
    }
    if (user.roles.includes(UserRoles.ETG) || fei.fei_next_owner_role === FeiOwnerRole.ETG) {
      if (fei.fei_next_owner_role !== FeiOwnerRole.ETG) return false;
      if (!user.roles.includes(UserRoles.ETG)) return false;
    }
    if (
      user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
      fei.fei_next_owner_role === FeiOwnerRole.COLLECTEUR_PRO
    ) {
      if (fei.fei_next_owner_role !== FeiOwnerRole.COLLECTEUR_PRO) return false;
      if (!user.roles.includes(UserRoles.COLLECTEUR_PRO)) return false;
    }
    return true;
  }, [fei.fei_next_owner_user_id, fei.fei_next_owner_role, user.id, user.roles, nextOwnerEntity]);

  if (!fei.fei_next_owner_role) {
    return null;
  }
  if (fei.automatic_closed_at || fei.svi_closed_at || fei.intermediaire_closed_at) {
    return null;
  }

  async function handlePriseEnCharge({
    transfer,
    action,
    etgEmployeeTransportingToETG = false,
  }: {
    transfer: boolean;
    action?: string;
    etgEmployeeTransportingToETG?: boolean;
  }) {
    const currentOwnerRole = etgEmployeeTransportingToETG
      ? FeiOwnerRole.COLLECTEUR_PRO
      : fei.fei_next_owner_role;
    const nextFei: Partial<FeiWithIntermediaires> = {
      fei_current_owner_role: currentOwnerRole,
      fei_current_owner_entity_id: fei.fei_next_owner_entity_id,
      fei_current_owner_entity_name_cache:
        fei.fei_next_owner_entity_name_cache || entities[fei.fei_next_owner_entity_id!]?.nom_d_usage || '',
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
    if (!transfer) {
      if (etgEmployeeTransportingToETG) {
        nextFei.fei_next_owner_entity_id = fei.fei_next_owner_entity_id;
        nextFei.fei_next_owner_entity_name_cache = fei.fei_next_owner_entity_name_cache;
        nextFei.fei_next_owner_role = FeiOwnerRole.ETG;
        nextFei.fei_next_owner_user_id = null;
        nextFei.fei_next_owner_user_name_cache = null;
      }
      if (nextFei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
        nextFei.examinateur_initial_user_id = user.id;
        nextFei.examinateur_initial_offline = navigator.onLine ? false : true;
      }
      if (nextFei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
        nextFei.premier_detenteur_user_id = user.id;
        nextFei.premier_detenteur_offline = navigator.onLine ? false : true;
      }
      if (nextFei.fei_current_owner_role === FeiOwnerRole.SVI) {
        nextFei.svi_user_id = user.id;
      }

      const intermediaireRole: (keyof typeof FeiOwnerRole)[] = [
        FeiOwnerRole.COLLECTEUR_PRO,
        FeiOwnerRole.ETG,
      ];

      if (intermediaireRole.includes(nextFei.fei_current_owner_role!)) {
        const newIntermediaireId = getNewCarcasseIntermediaireId(user.id, fei.numero);
        nextFei.latest_intermediaire_user_id = user.id;
        nextFei.latest_intermediaire_entity_id = nextFei.fei_current_owner_entity_id;
        nextFei.latest_intermediaire_name_cache = nextFei.fei_current_owner_entity_name_cache;
        const newIntermediaire: FeiIntermediaire = {
          id: newIntermediaireId,
          fei_numero: fei.numero,
          intermediaire_user_id: user.id,
          intermediaire_role: currentOwnerRole,
          intermediaire_entity_id: fei.fei_next_owner_entity_id || '',
          created_at: dayjs().toDate(),
          prise_en_charge_at:
            nextFei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO ? dayjs().toDate() : null,
          intermediaire_depot_type: null,
          intermediaire_depot_entity_id: null,
          intermediaire_prochain_detenteur_role_cache: null,
          intermediaire_prochain_detenteur_id_cache: null,
        };
        if (etgEmployeeTransportingToETG) {
          newIntermediaire.intermediaire_prochain_detenteur_id_cache = nextFei.fei_next_owner_entity_id!;
          newIntermediaire.intermediaire_prochain_detenteur_role_cache = FeiOwnerRole.ETG;
          newIntermediaire.intermediaire_depot_type = DepotType.AUCUN;
          newIntermediaire.intermediaire_depot_entity_id = null;
        }
        await createFeiIntermediaire(newIntermediaire);
        addLog({
          user_id: user.id,
          user_role: newIntermediaire.intermediaire_role! as UserRoles,
          fei_numero: fei.numero,
          action: 'intermediaire-create',
          history: createHistoryInput(null, newIntermediaire),
          entity_id: fei.fei_current_owner_entity_id,
          zacharie_carcasse_id: null,
          intermediaire_id: newIntermediaireId,
          carcasse_intermediaire_id: null,
        });
        if (nextFei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
          // la fiche était destinée à un ETG, qui envoie un de ses transporteurs,
          // le transporteur récupère les carcasses, on sait déjà à qui il va les envoyer: son ETG
          // donc on met directement les infos de l'ETG
          if (fei.fei_next_owner_role === FeiOwnerRole.ETG) {
            nextFei.fei_next_owner_role = FeiOwnerRole.ETG;
            nextFei.fei_next_owner_entity_id = fei.fei_next_owner_entity_id;
            nextFei.fei_next_owner_entity_name_cache = fei.fei_next_owner_entity_name_cache;
            nextFei.fei_next_owner_user_id = null;
            nextFei.fei_next_owner_user_name_cache = null;
          }
        }
      }
    }

    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: nextFei.fei_current_owner_role! as UserRoles,
      fei_numero: fei.numero,
      action: action || 'current-owner-confirm',
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.fei_current_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  }

  if (isETGEmployeeAndTransportingToETG) {
    if (!canConfirmCurrentOwner) {
      return null;
    }
    const nextName =
      nextOwnerEntity?.nom_d_usage || `${nextOwnerUser?.prenom} ${nextOwnerUser?.nom_de_famille}`;
    const canReception =
      user.roles.includes(UserRoles.ETG) && user.etg_roles.includes(UserEtgRoles.RECEPTION);
    let description = canReception ? (
      <button
        onClick={() => {
          handlePriseEnCharge({ transfer: false });
        }}
        type="button"
      >
        Bonne route ! Vous êtes arrivé à destination et souhaitez réceptionner le gibier ? <u>Cliquez ici</u>
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

  if (!canConfirmCurrentOwner) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <CallOut
        title={
          fei.fei_next_owner_user_id
            ? '🫵  Cette fiche vous a été attribuée'
            : fei.fei_next_owner_role === FeiOwnerRole.SVI
              ? '🫵  Cette fiche a été attribuée à votre service'
              : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role!)}</b>
        {nextOwnerEntity?.nom_d_usage ? ` (${nextOwnerEntity?.nom_d_usage})` : ''}, vous pouvez prendre en
        charge cette fiche et les carcasses associées.
        <br />
        {fei.fei_next_owner_role === FeiOwnerRole.PREMIER_DETENTEUR && (
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
        {fei.fei_next_owner_role === FeiOwnerRole.SVI && (
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
        {fei.fei_next_owner_role === FeiOwnerRole.ETG && user.roles.includes(UserRoles.ETG) && (
          <>
            {user.etg_roles.includes(UserEtgRoles.RECEPTION) &&
            user.etg_roles.includes(UserEtgRoles.TRANSPORT) &&
            needTransportFromETG ? (
              <>
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={() => {
                    handlePriseEnCharge({
                      transfer: false,
                      action: 'current-owner-confirm-etg-transporte',
                      etgEmployeeTransportingToETG: true,
                    });
                  }}
                >
                  Je contrôle et transporte les carcasses
                </Button>
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={() => {
                    handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-etg-reception' });
                  }}
                >
                  Je réceptionne et traite les carcasses
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                className="my-4 block"
                onClick={() => {
                  handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-etg-reception' });
                }}
              >
                Je prends en charge les carcasses
              </Button>
            )}
          </>
        )}
        {fei.fei_next_owner_role === FeiOwnerRole.COLLECTEUR_PRO && (
          <Button
            type="submit"
            className="my-4 block"
            onClick={() => {
              handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-collecteur-pro' });
            }}
          >
            Je contrôle et transporte les carcasses
          </Button>
        )}
        <>
          <div>
            <span>Il y a une erreur ?</span>
            <div className="flex items-center gap-2">
              <Button
                priority="tertiary"
                type="button"
                onClick={() => handlePriseEnCharge({ transfer: true, action: 'current-owner-transfer' })}
              >
                Transférer la fiche
              </Button>
              <Button
                priority="tertiary no outline"
                type="submit"
                onClick={() => {
                  const nextFei = {
                    fei_next_owner_entity_id: null,
                    fei_next_owner_entity_name_cache: null,
                    fei_next_owner_user_id: null,
                    fei_next_owner_user_name_cache: null,
                    fei_next_owner_role: null,
                  };
                  updateFei(fei.numero, nextFei);
                  addLog({
                    user_id: user.id,
                    user_role: fei.fei_next_owner_role as UserRoles,
                    fei_numero: fei.numero,
                    action: 'current-owner-renvoi',
                    entity_id: fei.fei_next_owner_entity_id,
                    zacharie_carcasse_id: null,
                    intermediaire_id: null,
                    carcasse_intermediaire_id: null,
                    history: createHistoryInput(fei, nextFei),
                  });
                }}
              >
                Renvoyer la fiche à l'expéditeur
              </Button>
            </div>
          </div>
        </>
      </CallOut>
    </div>
  );
}
