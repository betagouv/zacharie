import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useMemo } from 'react';
import { EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { CarcasseTransmission } from '@app/types/carcasse';

export default function ChasseurCurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const entities = useZustandStore((state) => state.entities);
  const feiCarcasses = useCarcassesForFei(params.fei_numero);

  const myCarcasses = useMemo(() => {
    const myEntityIds = Object.values(entities)
      .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
      .map((e) => e.id);
    return feiCarcasses.filter(
      (c) =>
        (c.next_owner_role === FeiOwnerRole.PREMIER_DETENTEUR &&
          c.next_owner_entity_id &&
          myEntityIds.includes(c.next_owner_entity_id)) ||
        c.next_owner_user_id === user.id
    );
  }, [feiCarcasses, entities, user.id]);

  if (myCarcasses.length === 0) {
    return null;
  }
  return <ChasseurCurrentOwnerConfirmLoaded />;
}

function ChasseurCurrentOwnerConfirmLoaded() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  const feiCarcasses = useCarcassesForFei(params.fei_numero);

  // For multi-recipient dispatch: filter to only carcasses assigned to this user/entity
  const userEntityIds = useMemo(() => {
    return Object.values(entities)
      .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
      .map((e) => e.id);
  }, [entities]);

  const myCarcasses = useMemo(() => {
    return feiCarcasses.filter(
      (c) =>
        (c.next_owner_entity_id && userEntityIds.includes(c.next_owner_entity_id)) ||
        c.next_owner_user_id === user.id
    );
  }, [feiCarcasses, userEntityIds, user.id]);

  const myCarcasseIds = useMemo(() => myCarcasses.map((c) => c.zacharie_carcasse_id), [myCarcasses]);

  const transmission = useMemo(() => {
    // dispatch ou pas, toutes les carcasses d'une fiche n'ont qu'un seul examinateur initial et un seul premier détenteur
    // on s'est assuré avec le calcul de `myCarcasses` que c'est bien au premier détenteur d'agir
    // construisons notre transmission à partir de la première carcasse
    const _nextEntityId = myCarcasses[0].next_owner_entity_id;
    const _nextEntityName = myCarcasses[0].next_owner_entity_name_cache;
    const _nextOwnerRole = myCarcasses[0].next_owner_role;
    const _nextOwnerUserId = myCarcasses[0].next_owner_user_id;
    for (const carcasse of myCarcasses) {
      if (carcasse.next_owner_entity_id !== _nextEntityId)
        throw new Error('Multiple entities found for the same FEI');
      if (carcasse.next_owner_role !== _nextOwnerRole)
        throw new Error('Multiple roles found for the same FEI');
      if (carcasse.next_owner_user_id !== _nextOwnerUserId)
        throw new Error('Multiple users found for the same FEI');
      if (carcasse.next_owner_entity_name_cache !== _nextEntityName)
        throw new Error('Multiple entity names found for the same FEI');
    }
    return myCarcasses[0];
  }, [myCarcasses]);

  const nextEntityId = transmission.next_owner_entity_id;
  const nextEntityName = transmission.next_owner_entity_name_cache;
  const nextOwnerRole = transmission.next_owner_role;
  const nextOwnerUserId = transmission.next_owner_user_id;
  const nextOwnerEntity = entities[nextEntityId!];

  // Detect if user already took charge of their assigned carcasses
  const myAlreadyHandledCarcasses = useMemo(() => {
    return feiCarcasses.filter(
      (c) =>
        c.current_owner_user_id === user.id &&
        c.current_owner_entity_id != null &&
        userEntityIds.includes(c.current_owner_entity_id)
    );
  }, [feiCarcasses, userEntityIds, user.id]);

  // Check if there are remaining carcasses not yet taken in charge by anyone
  const remainingUntakenCarcasses = useMemo(() => {
    return feiCarcasses.filter(
      (c) => c.next_owner_entity_id != null && !myCarcasseIds.includes(c.zacharie_carcasse_id)
    );
  }, [feiCarcasses, myCarcasseIds]);

  const canConfirmCurrentOwner = useMemo(() => {
    if (nextOwnerUserId === user.id) {
      return true;
    }
    if (!nextOwnerEntity) {
      return false;
    }
    if (nextOwnerEntity.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return false;
    }
    return true;
  }, [nextOwnerUserId, user.id, nextOwnerEntity]);

  if (!nextOwnerRole) {
    return null;
  }
  if (
    transmission.svi_automatic_closed_at ||
    transmission.svi_closed_at ||
    transmission.intermediaire_closed_at
  ) {
    return null;
  }
  // Multi-recipient: user already took charge of their assigned carcasses
  if (myCarcasses.length === 0 && myAlreadyHandledCarcasses.length > 0) {
    return null;
  }

  async function handlePriseEnCharge() {
    const currentOwnerRole = nextOwnerRole;
    const nextFei: Partial<FeiWithIntermediaires> = {
      premier_detenteur_user_id: user.id,
      premier_detenteur_offline: navigator.onLine ? false : true,
    };

    const nextTransmission: CarcasseTransmission = {
      current_owner_role: currentOwnerRole,
      current_owner_entity_id: nextEntityId,
      current_owner_entity_name_cache: nextEntityName,
      current_owner_user_id: nextOwnerUserId || user.id,
      current_owner_user_name_cache:
        transmission.next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
      prev_owner_role: transmission.current_owner_role || null,
      prev_owner_user_id: transmission.current_owner_user_id || null,
      prev_owner_entity_id: transmission.current_owner_entity_id || null,
      next_owner_wants_to_sous_traite: null,
      next_owner_role: null,
      next_owner_user_id: null,
      next_owner_user_name_cache: null,
      next_owner_entity_id: null,
      next_owner_entity_name_cache: null,
    };
    // Update carcasses transmission (source of truth) - only my carcasses
    updateCarcassesTransmission(myCarcasseIds, nextTransmission);

    // Partial take-over: if there are remaining carcasses sent to other recipients, keep the FEI open
    // Don't apply hasUnsendCarcasses for PREMIER_DETENTEUR/EXAMINATEUR_INITIAL take-over
    // (carcasses haven't been dispatched yet, that's normal)
    if (remainingUntakenCarcasses.length > 0) {
      // Don't fully transition the FEI — keep current owner so they/others can continue
      const partialNextTransmission: CarcasseTransmission = {
        prev_owner_role: transmission.current_owner_role || null,
        prev_owner_user_id: transmission.current_owner_user_id || null,
        prev_owner_entity_id: transmission.current_owner_entity_id || null,
      };
      if (transmission.latest_intermediaire_user_id) {
        partialNextTransmission.latest_intermediaire_user_id = transmission.latest_intermediaire_user_id;
        partialNextTransmission.latest_intermediaire_entity_id = transmission.latest_intermediaire_entity_id;
        partialNextTransmission.latest_intermediaire_name_cache =
          transmission.latest_intermediaire_name_cache;
      }

      updateCarcassesTransmission(
        remainingUntakenCarcasses.map((c) => c.zacharie_carcasse_id),
        partialNextTransmission
      );
      addLog({
        user_id: user.id,
        user_role: currentOwnerRole! as FeiOwnerRole,
        fei_numero: fei.numero,
        action: 'current-owner-confirm-premier-detenteur',
        history: createHistoryInput(transmission, partialNextTransmission),
        entity_id: transmission.current_owner_entity_id,
        zacharie_carcasse_id: null,
        intermediaire_id: null,
        carcasse_intermediaire_id: null,
      });
      syncData('current-owner-confirm-premier-detenteur');
      return;
    }

    // Update FEI for retrocompat (full transition)
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: nextFei.fei_current_owner_role! as UserRoles,
      fei_numero: fei.numero,
      action: 'current-owner-confirm-premier-detenteur',
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.fei_current_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('current-owner-confirm-premier-detenteur');
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
            : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        <Button
          type="submit"
          className="my-4 block"
          onClick={handlePriseEnCharge}
        >
          Prendre en charge cette fiche et les carcasses associées
        </Button>
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
                updateCarcassesTransmission(myCarcasseIds, {
                  next_owner_entity_id: null,
                  next_owner_entity_name_cache: null,
                  next_owner_user_id: null,
                  next_owner_user_name_cache: null,
                  next_owner_role: null,
                });
                // Only clear FEI-level next_owner if no other carcasses have a different next_owner
                const otherCarcassesWithNextOwner = feiCarcasses.filter(
                  (c) => c.next_owner_entity_id != null && !myCarcasseIds.includes(c.zacharie_carcasse_id)
                );
                const nextFei =
                  otherCarcassesWithNextOwner.length > 0
                    ? {} // Keep FEI-level next_owner for other recipients
                    : {
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
