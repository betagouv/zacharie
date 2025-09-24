import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { useMemo, useState } from 'react';
import { getCurrentOwnerRoleLabel } from '@app/utils/get-user-roles-label';
import {
  CarcasseIntermediaire,
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
import {
  getFeiAndIntermediaireIdsFromFeiIntermediaire,
  getNewCarcasseIntermediaireId,
} from '@app/utils/get-carcasse-intermediaire-id';
import type { FeiIntermediaire } from '@app/types/fei-intermediaire';
import dayjs from 'dayjs';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';

export default function CurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const createFeiIntermediaire = useZustandStore((state) => state.createFeiIntermediaire);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const latestIntermediaire = intermediaires[0];
  const feiAndIntermediaireIds = latestIntermediaire
    ? getFeiAndIntermediaireIdsFromFeiIntermediaire(latestIntermediaire)
    : undefined;

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
  const [checkedTransportFromETG, setCheckedTransportFromETG] = useState(false);

  const isETGEmployeeAndTransportingToETG = useMemo(() => {
    if (
      fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === FeiOwnerRole.ETG &&
      currentOwnerEntity?.type === EntityTypes.ETG &&
      currentOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
      fei.fei_current_owner_entity_id === fei.fei_next_owner_entity_id &&
      fei.fei_current_owner_user_id === user.id &&
      user.roles.includes(UserRoles.ETG) &&
      user.etg_role === UserEtgRoles.TRANSPORT
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
      if (fei.fei_current_owner_user_id === user.id) {
        if (fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
          if (user.etg_role !== UserEtgRoles.RECEPTION) {
            return false;
          }
        }
      }
    }
    if (
      user.roles.includes(UserRoles.COLLECTEUR_PRO) ||
      fei.fei_next_owner_role === FeiOwnerRole.COLLECTEUR_PRO
    ) {
      if (fei.fei_next_owner_role !== FeiOwnerRole.COLLECTEUR_PRO) return false;
      if (!user.roles.includes(UserRoles.COLLECTEUR_PRO)) return false;
    }
    return true;
  }, [
    fei.fei_next_owner_user_id,
    fei.fei_next_owner_role,
    fei.fei_current_owner_user_id,
    fei.fei_current_owner_role,
    user.id,
    user.roles,
    user.etg_role,
    nextOwnerEntity,
  ]);

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
          prise_en_charge_at: dayjs().toDate(),
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
    } else {
      if (latestIntermediaire && feiAndIntermediaireIds) {
        let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
          intermediaire_prochain_detenteur_id_cache: nextFei.fei_next_owner_entity_id!,
          intermediaire_prochain_detenteur_role_cache: entities[nextFei.fei_next_owner_entity_id!]
            ?.type as FeiOwnerRole,
          intermediaire_depot_type: DepotType.AUCUN,
          intermediaire_depot_entity_id: null,
        };
        updateAllCarcasseIntermediaire(fei.numero, feiAndIntermediaireIds, nextCarcasseIntermediaire);
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

    return (
      <div className="bg-alt-blue-france pb-8">
        <div className="bg-white">
          <Alert
            severity="info"
            title={`Les carcasses sont transportées vers\u00A0: ${nextName}`}
            description="Cette fiche lui a déjà été attribuée, il a déjà été notifié, il est prêt à recevoir votre chargement. Bonne route !"
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
        En tant que <b>{getCurrentOwnerRoleLabel(fei.fei_next_owner_role!)}</b>
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
            {user.etg_role === UserEtgRoles.RECEPTION && (
              <>
                {needTransportFromETG && (
                  <Checkbox
                    className="mt-4"
                    options={[
                      {
                        label: 'Mes carcasses ont été transportées par mon entreprise',
                        hintText:
                          "Vous voyez cette case à cocher parce que le premier détenteur a indiqué que votre entreprise doit les transporter mais aucun transporteur de votre entreprise ne l'a encore indiqué.",
                        nativeInputProps: {
                          checked: checkedTransportFromETG,
                          onChange: () => {
                            setCheckedTransportFromETG(!checkedTransportFromETG);
                          },
                        },
                      },
                    ]}
                  />
                )}
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={async () => {
                    if (checkedTransportFromETG) {
                      // FIXME: this is no good, those two actions should be one only
                      // what is done here is 1. register the fact that the ETG has transported the carcasses
                      // THEN 2. update the current owner to the ETG reception
                      // what to do better: handle this process properly, all at once
                      // why is it like this ? because before, it wasn't a checkbox, it was a button - so there WAS two actions
                      // but the button was a bad UX< the checkbox is much better - but I didn't take the time to adapt the code
                      // why a timeout ? because I don't want to overwrite the first setState in zustand state
                      // so I wait for the first setState to be "done" (I have no listener so timeout will be enough)
                      // this is a hack, but it works
                      await handlePriseEnCharge({
                        transfer: false,
                        action: 'current-owner-confirm-etg-transport-not-by-me',
                        etgEmployeeTransportingToETG: true,
                      });
                      await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                    handlePriseEnCharge({ transfer: false, action: 'current-owner-confirm-etg-reception' });
                  }}
                >
                  Je prends en charge les carcasses
                </Button>
              </>
            )}
            {user.etg_role === UserEtgRoles.TRANSPORT && (
              <Button
                type="submit"
                className="my-4 block"
                onClick={() => {
                  handlePriseEnCharge({
                    transfer: false,
                    action: 'current-owner-confirm-etg-transport-by-me',
                    etgEmployeeTransportingToETG: true,
                  });
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
          <div className="flex items-center gap-2">
            <p className="m-0 text-sm">Il y a une erreur ?</p>
            {/* <Button
                priority="tertiary"
                type="button"
                onClick={() =>
                  handlePriseEnCharge({ transfer: true, action: 'current-owner-transfer-request' })
                }
              >
                Transférer la fiche
              </Button> */}
            <Button
              priority="tertiary no outline"
              className="mt-0 text-sm"
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
        </>
      </CallOut>
    </div>
  );
}
