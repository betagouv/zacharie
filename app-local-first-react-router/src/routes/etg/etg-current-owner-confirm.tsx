import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useParams } from 'react-router';
import {
  DepotType,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  TransportType,
  UserEtgRoles,
  UserRoles,
} from '@prisma/client';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getNewCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { CarcasseTransmission } from '@app/types/carcasse';
import { useTransmissionWithMetadata } from '@app/utils/get-transmissions-sorted';

export default function CurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const createCarcassesIntermediaire = useZustandStore((state) => state.createCarcassesIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const transmissionMetadata = useTransmissionWithMetadata(params.fei_numero!);
  const fei = transmissionMetadata.fei;
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const myCarcasses = transmissionMetadata.carcasses;
  const currentTransmission = transmissionMetadata.content;
  const intermediaires = transmissionMetadata.intermediaires;
  const latestIntermediaire = intermediaires[0];

  const currentOwnerEntity = entities[currentTransmission.current_owner_entity_id!];
  const nextOwnerEntity = entities[currentTransmission.next_owner_entity_id!];
  const nextOwnerUser = users[currentTransmission.next_owner_user_id!];

  // For multi-recipient dispatch: filter to only carcasses assigned to this user/entity
  const userEntityIds = useMemo(() => {
    return Object.values(entities)
      .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
      .map((e) => e.id);
  }, [entities]);

  const myCarcasseIds = useMemo(() => myCarcasses.map((c) => c.zacharie_carcasse_id), [myCarcasses]);

  const myEntityName = currentTransmission.next_owner_entity_id
    ? (entities[currentTransmission.next_owner_entity_id]?.nom_d_usage ?? '')
    : '';

  // Detect if user already took charge of their assigned carcasses
  const myAlreadyHandledCarcasses = useMemo(() => {
    return myCarcasses.filter(
      (c) =>
        c.current_owner_user_id === user.id &&
        c.current_owner_entity_id != null &&
        userEntityIds.includes(c.current_owner_entity_id)
    );
  }, [myCarcasses, userEntityIds, user.id]);

  // Check if there are remaining carcasses not yet taken in charge by anyone
  const needTransportFromETG = useMemo(() => {
    if (currentTransmission.next_owner_role === FeiOwnerRole.ETG) {
      if (latestIntermediaire) {
        if (latestIntermediaire?.intermediaire_depot_type === DepotType.CCG) {
          return true;
        }
      } else {
        if (currentTransmission.premier_detenteur_transport_type === TransportType.PREMIER_DETENTEUR)
          return false;
        return true;
      }
    } else {
      return false;
    }
  }, [latestIntermediaire, currentTransmission]);

  const [checkedTransportFromETG /* setCheckedTransportFromETG */] = useState(needTransportFromETG);
  const notMyEntitySoutraite = useMemo(() => {
    const sousTraiteEntityId = currentTransmission.next_owner_sous_traite_by_entity_id;
    if (!sousTraiteEntityId) return false;
    if (sousTraiteEntityId === currentTransmission.next_owner_entity_id) return false;
    return true;
  }, [currentTransmission]);

  const isETGEmployeeAndTransportingToETG = useMemo(() => {
    if (
      currentTransmission.current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      currentTransmission.next_owner_role === FeiOwnerRole.ETG &&
      currentOwnerEntity?.type === EntityTypes.ETG &&
      currentOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY &&
      currentTransmission.current_owner_entity_id === currentTransmission.next_owner_entity_id &&
      currentTransmission.current_owner_user_id === user.id &&
      user.etg_role === UserEtgRoles.TRANSPORT
    ) {
      return true;
    }
    return false;
  }, [user, currentOwnerEntity, currentTransmission]);

  const canConfirmCurrentOwner = useMemo(() => {
    // Multi-recipient: check if user has carcasses assigned to them per-carcasse
    if (myCarcasses.length > 0) {
      if (currentTransmission.next_owner_role === FeiOwnerRole.ETG) return true;
    }

    if (currentTransmission.next_owner_user_id === user.id) {
      return true;
    }
    if (!nextOwnerEntity) {
      return false;
    }
    if (nextOwnerEntity.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return false;
    }
    if (currentTransmission.next_owner_role !== FeiOwnerRole.ETG) return false;
    if (!user.roles.includes(UserRoles.ETG)) return false;
    if (currentTransmission.current_owner_user_id === user.id) {
      if (currentTransmission.current_owner_role === FeiOwnerRole.COLLECTEUR_PRO) {
        if (user.etg_role !== UserEtgRoles.RECEPTION) {
          return false;
        }
      }
    }
    return true;
  }, [
    myCarcasses.length,
    currentTransmission.next_owner_user_id,
    currentTransmission.next_owner_role,
    currentTransmission.current_owner_user_id,
    currentTransmission.current_owner_role,
    user.id,
    user.roles,
    user.etg_role,
    nextOwnerEntity,
  ]);

  if (!currentTransmission.next_owner_role) {
    return null;
  }
  if (transmissionMetadata.allCarcassesDone) {
    return null;
  }
  // Multi-recipient: user already took charge of their assigned carcasses
  if (myCarcasses.length === 0 && myAlreadyHandledCarcasses.length > 0) {
    return null;
  }

  // Handles the case where an ETG reception employee takes charge of carcasses
  // that also need a transport step recorded. This creates both intermediaires
  // (transport + reception) and updates the FEI once, avoiding the previous
  // race condition from two separate handlePriseEnCharge calls with a setTimeout.
  async function handleETGReceptionWithTransport() {
    const entityName = myEntityName;

    // 1. Create the transport intermediaire (COLLECTEUR_PRO role)
    const transportIntermediaireId = `${user.id}_${fei.numero}_${dayjs().format('HHmmss')}_transport`;
    const transportIntermediaire: CarcassesIntermediaire = {
      id: transportIntermediaireId,
      fei_numero: fei.numero,
      intermediaire_user_id: user.id,
      intermediaire_role: FeiOwnerRole.COLLECTEUR_PRO,
      intermediaire_entity_id: currentTransmission.next_owner_entity_id || '',
      created_at: dayjs().toDate(),
      prise_en_charge_at: dayjs().toDate(),
      intermediaire_depot_type: DepotType.AUCUN,
      intermediaire_depot_entity_id: null,
      intermediaire_prochain_detenteur_role_cache: FeiOwnerRole.ETG,
      intermediaire_prochain_detenteur_id_cache: currentTransmission.next_owner_entity_id!,
    };
    await new Promise((res) => setTimeout(res, 150)); // so that the create_at differ between the two intermediaires
    // 2. Create the reception intermediaire (ETG role)
    const receptionIntermediaireId = `${user.id}_${fei.numero}_${dayjs().format('HHmmss')}_reception`;
    const receptionIntermediaire: CarcassesIntermediaire = {
      id: receptionIntermediaireId,
      fei_numero: fei.numero,
      intermediaire_user_id: user.id,
      intermediaire_role: FeiOwnerRole.ETG,
      intermediaire_entity_id: currentTransmission.next_owner_entity_id || '',
      created_at: dayjs().toDate(),
      prise_en_charge_at: dayjs().toDate(),
      intermediaire_depot_type: null,
      intermediaire_depot_entity_id: null,
      intermediaire_prochain_detenteur_role_cache: null,
      intermediaire_prochain_detenteur_id_cache: null,
    };

    // Create both intermediaires in a single store update (only for my carcasses)
    await createCarcassesIntermediaire([transportIntermediaire, receptionIntermediaire], myCarcasseIds);
    addLog({
      user_id: user.id,
      user_role: UserRoles.COLLECTEUR_PRO,
      fei_numero: fei.numero,
      action: 'intermediaire-create',
      history: createHistoryInput(null, transportIntermediaire),
      entity_id: currentTransmission.current_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: transportIntermediaireId,
      carcasse_intermediaire_id: null,
    });
    addLog({
      user_id: user.id,
      user_role: UserRoles.ETG,
      fei_numero: fei.numero,
      action: 'intermediaire-create',
      history: createHistoryInput(null, receptionIntermediaire),
      entity_id: currentTransmission.current_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: receptionIntermediaireId,
      carcasse_intermediaire_id: null,
    });

    // 3. Update carcasses transmission (source of truth) - only my carcasses
    const nextTransmission: CarcasseTransmission = {
      current_owner_role: FeiOwnerRole.ETG,
      current_owner_entity_id: currentTransmission.next_owner_entity_id ?? null,
      current_owner_entity_name_cache: entityName || null,
      current_owner_user_id: user.id,
      current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
      next_owner_role: null,
      next_owner_user_id: null,
      next_owner_user_name_cache: null,
      next_owner_entity_id: null,
      next_owner_entity_name_cache: null,
      next_owner_wants_to_sous_traite: null,
      prev_owner_role: currentTransmission.current_owner_role || null,
      prev_owner_user_id: currentTransmission.current_owner_user_id || null,
      prev_owner_entity_id: currentTransmission.current_owner_entity_id || null,
    };
    updateCarcassesTransmission(myCarcasseIds, nextTransmission);

    addLog({
      user_id: user.id,
      user_role: UserRoles.ETG,
      fei_numero: fei.numero,
      action: 'current-owner-confirm-etg-reception-with-transport',
      history: createHistoryInput(currentTransmission, nextTransmission),
      entity_id: currentTransmission.next_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('current-owner-confirm-etg-reception-with-transport');
  }

  async function handlePriseEnCharge({
    sousTraite,
    action,
    etgEmployeeTransportingToETG = false,
  }: {
    sousTraite: boolean;
    action?: string;
    etgEmployeeTransportingToETG?: boolean;
  }) {
    if (sousTraite) {
      const nextTransmission: CarcasseTransmission = {
        next_owner_wants_to_sous_traite: true,
        next_owner_sous_traite_by_user_id: user.id,
      };
      updateCarcassesTransmission(myCarcasseIds, nextTransmission);

      addLog({
        user_id: user.id,
        user_role: currentTransmission.next_owner_role! as UserRoles,
        fei_numero: fei.numero,
        action: 'current-owner-sous-traite-request',
        history: createHistoryInput(currentTransmission, nextTransmission),
        entity_id: currentTransmission.current_owner_entity_id,
        zacharie_carcasse_id: null,
        intermediaire_id: null,
        carcasse_intermediaire_id: null,
      });
      syncData('current-owner-sous-traite-request');
      return;
    }

    const currentOwnerRole = etgEmployeeTransportingToETG ? FeiOwnerRole.COLLECTEUR_PRO : FeiOwnerRole.ETG;
    const nextTransmission: CarcasseTransmission = {
      current_owner_role: currentOwnerRole,
      current_owner_entity_id: currentTransmission.next_owner_entity_id,
      current_owner_entity_name_cache: myEntityName,
      current_owner_user_id: user.id,
      current_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
      next_owner_wants_to_sous_traite: null,
      next_owner_role: null,
      next_owner_user_id: null,
      next_owner_user_name_cache: null,
      next_owner_entity_id: null,
      next_owner_entity_name_cache: null,
      prev_owner_role: currentTransmission.current_owner_role || null,
      prev_owner_user_id: currentTransmission.current_owner_user_id || null,
      prev_owner_entity_id: currentTransmission.current_owner_entity_id || null,
    };

    // deprecated anyway and broken for multi-dispatch
    if (etgEmployeeTransportingToETG) {
      nextTransmission.next_owner_entity_id = currentTransmission.next_owner_entity_id;
      nextTransmission.next_owner_entity_name_cache = myEntityName;
      nextTransmission.next_owner_role = FeiOwnerRole.ETG;
      nextTransmission.next_owner_user_id = null;
      nextTransmission.next_owner_user_name_cache = null;
    }

    const newIntermediaireId = getNewCarcasseIntermediaireId(user.id, fei.numero);
    // nextFei.latest_intermediaire_user_id = user.id;
    // nextFei.latest_intermediaire_entity_id = nextcurrentTransmission.current_owner_entity_id;
    // nextFei.latest_intermediaire_name_cache = nextFei.fei_current_owner_entity_name_cache;
    const newIntermediaire: CarcassesIntermediaire = {
      id: newIntermediaireId,
      fei_numero: fei.numero,
      intermediaire_user_id: user.id,
      intermediaire_role: currentOwnerRole,
      intermediaire_entity_id: currentTransmission.next_owner_entity_id || '',
      created_at: dayjs().toDate(),
      prise_en_charge_at: dayjs().toDate(),
      intermediaire_depot_type: null,
      intermediaire_depot_entity_id: null,
      intermediaire_prochain_detenteur_role_cache: null,
      intermediaire_prochain_detenteur_id_cache: null,
    };
    if (etgEmployeeTransportingToETG) {
      newIntermediaire.intermediaire_prochain_detenteur_id_cache = currentTransmission.next_owner_entity_id!;
      newIntermediaire.intermediaire_prochain_detenteur_role_cache = FeiOwnerRole.ETG;
      newIntermediaire.intermediaire_depot_type = DepotType.AUCUN;
      newIntermediaire.intermediaire_depot_entity_id = null;
    }
    await createCarcassesIntermediaire(
      [newIntermediaire],
      myCarcasseIds.length > 0 ? myCarcasseIds : undefined
    );
    addLog({
      user_id: user.id,
      user_role: newIntermediaire.intermediaire_role! as UserRoles,
      fei_numero: fei.numero,
      action: 'intermediaire-create',
      history: createHistoryInput(null, newIntermediaire),
      entity_id: currentTransmission.current_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: newIntermediaireId,
      carcasse_intermediaire_id: null,
    });
    // Update carcasses transmission (source of truth) - only my carcasses
    updateCarcassesTransmission(myCarcasseIds, nextTransmission);
    addLog({
      user_id: user.id,
      user_role: nextTransmission.current_owner_role! as UserRoles,
      fei_numero: fei.numero,
      action: action || 'current-owner-confirm',
      // FIXME: what history should we use here?
      history: createHistoryInput(currentTransmission, nextTransmission),
      entity_id: currentTransmission.next_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData(action || 'current-owner-confirm');
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
          currentTransmission.next_owner_user_id
            ? '🫵  Cette fiche vous a été attribuée'
            : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        {currentTransmission.next_owner_role === FeiOwnerRole.ETG && (
          <>
            {user.etg_role === UserEtgRoles.RECEPTION && (
              <>
                <Button
                  type="submit"
                  className="my-4 block"
                  onClick={async () => {
                    if (checkedTransportFromETG) {
                      await handleETGReceptionWithTransport();
                    } else {
                      await handlePriseEnCharge({
                        sousTraite: false,
                        action: 'current-owner-confirm-etg-reception',
                      });
                    }
                  }}
                >
                  Prendre en charge les carcasses
                </Button>
                {/* je ne peux pas sous-traiter une fiche si une autre entreprise a déjà décide de sous-traiter la fiche */}
                {needTransportFromETG && !notMyEntitySoutraite && (
                  <Button
                    priority="tertiary"
                    type="button"
                    className="mt-0"
                    onClick={() =>
                      handlePriseEnCharge({
                        sousTraite: true,
                        action: 'current-owner-sous-traite-request',
                      })
                    }
                  >
                    Sous-traiter le transport
                  </Button>
                )}
              </>
            )}
            {user.etg_role === UserEtgRoles.TRANSPORT && (
              <Button
                type="submit"
                className="my-4 block"
                onClick={() => {
                  handlePriseEnCharge({
                    sousTraite: false,
                    action: 'current-owner-confirm-etg-transport-by-me',
                    etgEmployeeTransportingToETG: true,
                  });
                }}
              >
                Prendre en charge les carcasses
              </Button>
            )}
          </>
        )}
        <>
          <div className="flex items-center gap-2">
            {/* <p className="m-0 text-sm">Il y a une erreur ?</p> */}
            <Button
              // priority="tertiary no outline"
              className="mt-0]"
              // type="submit"
              priority="tertiary"
              type="button"
              onClick={() => {
                // Only reset my carcasses' next_owner
                const nextTransmission: CarcasseTransmission = {
                  next_owner_entity_id: null,
                  next_owner_entity_name_cache: null,
                  next_owner_user_id: null,
                  next_owner_user_name_cache: null,
                  next_owner_role: null,
                };
                updateCarcassesTransmission(myCarcasseIds, nextTransmission);
                addLog({
                  user_id: user.id,
                  user_role: currentTransmission.next_owner_role as UserRoles,
                  fei_numero: fei.numero,
                  action: 'current-owner-renvoi',
                  entity_id: currentTransmission.next_owner_entity_id,
                  zacharie_carcasse_id: null,
                  intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                  history: createHistoryInput(currentTransmission, nextTransmission),
                });
                syncData('current-owner-renvoi');
              }}
            >
              Je renvoie la fiche à l'expéditeur
            </Button>
          </div>
        </>
      </CallOut>
    </div>
  );
}
