import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useMemo } from 'react';
import { EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import type { FeiWithIntermediaires } from '~/src/types/fei';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';

export default function CurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  const feiCarcasses = useCarcassesForFei(params.fei_numero);

  const nextOwnerEntity = entities[fei.fei_next_owner_entity_id!];

  // For multi-recipient dispatch: filter to only carcasses assigned to this user/entity
  const userEntityIds = useMemo(() => {
    return Object.values(entities)
      .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
      .map((e) => e.id);
  }, [entities]);

  const myCarcasses = useMemo(() => {
    return feiCarcasses.filter(
      (c) =>
        (c.next_owner_entity_id && userEntityIds.includes(c.next_owner_entity_id)) || c.next_owner_user_id === user.id
    );
  }, [feiCarcasses, userEntityIds, user.id]);

  const myCarcasseIds = useMemo(() => myCarcasses.map((c) => c.zacharie_carcasse_id), [myCarcasses]);

  // For multi-recipient dispatch: derive the actual entity ID from per-carcasse assignment
  // (fei.fei_next_owner_entity_id is always the FIRST group's entity due to retrocompat)
  const myEntityId = useMemo(() => {
    if (myCarcasses.length > 0) {
      const perCarcasseEntityId = myCarcasses[0].next_owner_entity_id;
      if (perCarcasseEntityId) return perCarcasseEntityId;
    }
    return fei.fei_next_owner_entity_id;
  }, [myCarcasses, fei.fei_next_owner_entity_id]);
  const myEntityName = myEntityId ? (entities[myEntityId]?.nom_d_usage ?? '') : '';

  const myNextOwnerRole = useMemo(() => {
    if (myCarcasses.length > 0) {
      return myCarcasses[0].next_owner_role;
    }
    return fei.fei_next_owner_role;
  }, [myCarcasses, fei.fei_next_owner_role]);

  // Detect if user already took charge of their assigned carcasses
  const myAlreadyHandledCarcasses = useMemo(() => {
    return feiCarcasses.filter(
      (c) =>
        c.current_owner_user_id === user.id &&
        c.current_owner_entity_id != null &&
        userEntityIds.includes(c.current_owner_entity_id)
    );
  }, [feiCarcasses, userEntityIds, user.id]);

  // Fallback: if no per-carcasse assignment, use all carcasses (retrocompat)
  const carcasseIds = myCarcasseIds.length > 0 ? myCarcasseIds : feiCarcasses.map((c) => c.zacharie_carcasse_id);

  // Check if there are remaining carcasses not yet taken in charge by anyone
  const hasRemainingUntakenCarcasses = useMemo(() => {
    return feiCarcasses.some((c) => c.next_owner_entity_id != null && !myCarcasseIds.includes(c.zacharie_carcasse_id));
  }, [feiCarcasses, myCarcasseIds]);

  const canConfirmCurrentOwner = useMemo(() => {
    // Multi-recipient: check if user has carcasses assigned to them per-carcasse

    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }

    if (!nextOwnerEntity) {
      return false;
    }
    if (nextOwnerEntity.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return false;
    }
    return true;
  }, [fei.fei_next_owner_user_id, user.id, nextOwnerEntity]);

  if (!myNextOwnerRole) {
    return null;
  }
  if (fei.automatic_closed_at || fei.svi_closed_at || fei.intermediaire_closed_at) {
    return null;
  }
  // Multi-recipient: user already took charge of their assigned carcasses
  if (myCarcasses.length === 0 && myAlreadyHandledCarcasses.length > 0) {
    return null;
  }

  async function handlePriseEnCharge() {
    const currentOwnerRole = fei.fei_next_owner_role;
    const nextFei: Partial<FeiWithIntermediaires> = {
      fei_current_owner_role: currentOwnerRole,
      fei_current_owner_entity_id: myEntityId,
      fei_current_owner_entity_name_cache: myEntityName,
      fei_current_owner_user_id: fei.fei_next_owner_user_id || user.id,
      fei_current_owner_user_name_cache: fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
      fei_prev_owner_role: fei.fei_current_owner_role || null,
      fei_prev_owner_user_id: fei.fei_current_owner_user_id || null,
      fei_prev_owner_entity_id: fei.fei_current_owner_entity_id || null,
      fei_next_owner_wants_to_sous_traite: null,
      fei_next_owner_role: null,
      fei_next_owner_user_id: null,
      fei_next_owner_user_name_cache: null,
      fei_next_owner_entity_id: null,
      fei_next_owner_entity_name_cache: null,
    };

    if (nextFei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
      nextFei.examinateur_initial_user_id = user.id;
      nextFei.examinateur_initial_offline = navigator.onLine ? false : true;
    }
    if (nextFei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
      nextFei.premier_detenteur_user_id = user.id;
      nextFei.premier_detenteur_offline = navigator.onLine ? false : true;
    }

    // Update carcasses transmission (source of truth) - only my carcasses
    updateCarcassesTransmission(carcasseIds, {
      current_owner_role: nextFei.fei_current_owner_role ?? null,
      current_owner_entity_id: nextFei.fei_current_owner_entity_id ?? null,
      current_owner_entity_name_cache: nextFei.fei_current_owner_entity_name_cache ?? null,
      current_owner_user_id: nextFei.fei_current_owner_user_id ?? null,
      current_owner_user_name_cache: nextFei.fei_current_owner_user_name_cache ?? null,
      next_owner_wants_to_sous_traite: nextFei.fei_next_owner_wants_to_sous_traite ?? null,
      next_owner_role: nextFei.fei_next_owner_role ?? null,
      next_owner_user_id: nextFei.fei_next_owner_user_id ?? null,
      next_owner_user_name_cache: nextFei.fei_next_owner_user_name_cache ?? null,
      next_owner_entity_id: nextFei.fei_next_owner_entity_id ?? null,
      next_owner_entity_name_cache: nextFei.fei_next_owner_entity_name_cache ?? null,
      prev_owner_role: nextFei.fei_prev_owner_role ?? null,
      prev_owner_user_id: nextFei.fei_prev_owner_user_id ?? null,
      prev_owner_entity_id: nextFei.fei_prev_owner_entity_id ?? null,
    });

    // Partial take-over: if there are remaining carcasses sent to other recipients, keep the FEI open
    // Don't apply hasUnsendCarcasses for PREMIER_DETENTEUR/EXAMINATEUR_INITIAL take-over
    // (carcasses haven't been dispatched yet, that's normal)
    if (hasRemainingUntakenCarcasses) {
      // Don't fully transition the FEI — keep current owner so they/others can continue
      const partialNextFei: Partial<FeiWithIntermediaires> = {
        fei_prev_owner_role: fei.fei_current_owner_role || null,
        fei_prev_owner_user_id: fei.fei_current_owner_user_id || null,
        fei_prev_owner_entity_id: fei.fei_current_owner_entity_id || null,
      };
      if (nextFei.latest_intermediaire_user_id) {
        partialNextFei.latest_intermediaire_user_id = nextFei.latest_intermediaire_user_id;
        partialNextFei.latest_intermediaire_entity_id = nextFei.latest_intermediaire_entity_id;
        partialNextFei.latest_intermediaire_name_cache = nextFei.latest_intermediaire_name_cache;
      }
      updateFei(fei.numero, partialNextFei);
      addLog({
        user_id: user.id,
        user_role: nextFei.fei_current_owner_role! as UserRoles,
        fei_numero: fei.numero,
        action: 'current-owner-confirm-premier-detenteur',
        history: createHistoryInput(fei, partialNextFei),
        entity_id: fei.fei_current_owner_entity_id,
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
                updateCarcassesTransmission(carcasseIds, {
                  next_owner_entity_id: null,
                  next_owner_entity_name_cache: null,
                  next_owner_user_id: null,
                  next_owner_user_name_cache: null,
                  next_owner_role: null,
                });
                // Only clear FEI-level next_owner if no other carcasses have a different next_owner
                const otherCarcassesWithNextOwner = feiCarcasses.filter(
                  (c) => c.next_owner_entity_id != null && !carcasseIds.includes(c.zacharie_carcasse_id)
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
