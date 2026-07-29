import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { type ButtonProps } from '@codegouvfr/react-dsfr/Button';
import { toast } from 'react-toastify';
import { useMemo } from 'react';
import { EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getNewCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { CarcasseTransmission } from '@app/types/carcasse';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';
import dayjs from 'dayjs';
import { useIsCircuitCourt } from '@app/utils/circuit-court';

export default function CurrentOwnerConfirm() {
  const user = useUser((state) => state.user)!;
  const isCircuitCourt = useIsCircuitCourt();
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const createCarcassesIntermediaire = useZustandStore((state) => state.createCarcassesIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const transmissionMetadata = useGetTransmissionFromURLParams();
  const fei = transmissionMetadata.fei;
  const entities = useZustandStore((state) => state.entities);
  const myCarcasses = transmissionMetadata.carcasses;
  const currentTransmission = transmissionMetadata.content;

  const nextOwnerEntity = entities[currentTransmission.next_owner_entity_id!];

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

  const canConfirmCurrentOwner = useMemo(() => {
    // Le bloc de prise en charge ne s'affiche que si la fiche est adressée à ce collecteur comme
    // prochain détenteur. Sinon il resterait visible après transmission à l'ETG puis au SVI.
    if (currentTransmission.next_owner_role !== FeiOwnerRole.COLLECTEUR_PRO) {
      return false;
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
    return true;
  }, [currentTransmission.next_owner_role, currentTransmission.next_owner_user_id, user.id, nextOwnerEntity]);

  if (isCircuitCourt) {
    return null;
  }
  if (!currentTransmission.next_owner_role) {
    return null;
  }
  if (transmissionMetadata.allCarcassesDone) {
    return null;
  }
  // Le collecteur a déjà pris en charge toutes les carcasses du groupe (il les contrôle/transporte
  // déjà) : on ne réaffiche pas le bloc de prise en charge, même après transmission au prochain détenteur.
  if (myCarcasses.length > 0 && myAlreadyHandledCarcasses.length === myCarcasses.length) {
    return null;
  }

  async function handlePriseEnCharge({ sousTraite, action }: { sousTraite: boolean; action?: string }) {
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

    const currentOwnerRole = FeiOwnerRole.COLLECTEUR_PRO;
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

    const newIntermediaireId = getNewCarcasseIntermediaireId(user.id, fei.numero);
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
    await createCarcassesIntermediaire([newIntermediaire], myCarcasseIds);
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
      history: createHistoryInput(currentTransmission, nextTransmission),
      entity_id: currentTransmission.next_owner_entity_id,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData(action || 'current-owner-confirm');
  }

  if (!canConfirmCurrentOwner) {
    return null;
  }

  function handleRenvoi() {
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
    toast.success("La fiche a été renvoyée à l'expéditeur");
  }

  const actionButtons: [ButtonProps, ...ButtonProps[]] = [
    {
      children: 'Je contrôle et transporte les carcasses',
      nativeButtonProps: {
        type: 'submit',
        onClick: () =>
          handlePriseEnCharge({
            sousTraite: false,
            action: 'current-owner-confirm-collecteur-pro',
          }),
      },
    },
    {
      children: "Renvoyer à l'expéditeur",
      priority: 'secondary',
      nativeButtonProps: {
        type: 'button',
        onClick: handleRenvoi,
      },
    },
  ];

  return (
    <div className="bg-alt-blue-france pb-8">
      <div className="rounded bg-white p-4 md:p-8">
        <ButtonsGroup
          inlineLayoutWhen="md and up"
          buttons={actionButtons}
        />
      </div>
    </div>
  );
}
