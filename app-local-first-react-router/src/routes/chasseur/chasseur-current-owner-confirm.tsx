import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { useMemo } from 'react';
import { Fei, EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { CompteEnAttenteValidationAlert } from '@app/components/CompteEnAttenteValidation';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';
import { CarcasseTransmission } from '@app/types/carcasse';

export default function ChasseurCurrentOwnerConfirm() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const transmission = useGetTransmissionFromURLParams();
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const entities = useZustandStore((state) => state.entities);
  // Sur la route de base /fei/:fei_numero d'une fiche déjà dispatchée, aucune transmission ne
  // correspond (l'id se construit sans prochain détenteur) : on garde tout null-safe puis on ne rend rien.
  const carcasses = transmission?.carcasses ?? [];

  const nextOwnerEntityId = transmission?.content.next_owner_entity_id!;
  const myNextOwnerRole = transmission?.content.next_owner_role!;
  const nextOwnerEntity = entities[nextOwnerEntityId];

  // const userEntityIds = useMemo(() => {
  //   return Object.values(entities)
  //     .filter((e) => e.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY)
  //     .map((e) => e.id);
  // }, [entities]);

  const carcasseIds = useMemo(() => carcasses.map((c) => c.zacharie_carcasse_id), [carcasses]);

  // // Detect if user already took charge of their assigned carcasses
  // const myAlreadyHandledCarcasses = useMemo(() => {
  //   return carcasses.filter(
  //     (c) =>
  //       c.current_owner_user_id === user.id &&
  //       c.current_owner_entity_id != null &&
  //       userEntityIds.includes(c.current_owner_entity_id)
  //   );
  // }, [carcasses, userEntityIds, user.id]);

  // // Check if there are remaining carcasses not yet taken in charge by anyone
  // const hasRemainingUntakenCarcasses = myAlreadyHandledCarcasses.length < carcasses.length;

  const canConfirmCurrentOwner = useMemo(() => {
    if (transmission?.content.next_owner_user_id === user.id) {
      return true;
    }
    if (!nextOwnerEntity) {
      return false;
    }
    if (nextOwnerEntity.relation !== EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      return false;
    }
    return true;
  }, [transmission?.content.next_owner_user_id, user.id, nextOwnerEntity]);

  if (!transmission) {
    return null;
  }

  if (myNextOwnerRole !== FeiOwnerRole.PREMIER_DETENTEUR) {
    return null;
  }

  const notActivated = !user.activated;

  async function handlePriseEnCharge() {
    if (notActivated) {
      return;
    }
    const currentOwnerRole = transmission.content.next_owner_role;
    const nextTransmission: CarcasseTransmission = {
      current_owner_role: currentOwnerRole,
      current_owner_entity_id: nextOwnerEntityId,
      current_owner_entity_name_cache: nextOwnerEntity?.nom_d_usage ?? nextOwnerEntity?.raison_sociale ?? '',
      current_owner_user_id: transmission.content.next_owner_user_id || user.id,
      current_owner_user_name_cache:
        transmission.content.next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
      prev_owner_role: transmission.content.current_owner_role || null,
      prev_owner_user_id: transmission.content.current_owner_user_id || null,
      prev_owner_entity_id: transmission.content.current_owner_entity_id || null,
      next_owner_wants_to_sous_traite: null,
      next_owner_role: null,
      next_owner_user_id: null,
      next_owner_user_name_cache: null,
      next_owner_entity_id: null,
      next_owner_entity_name_cache: null,
    };

    const nextFei: Partial<Fei> = {};
    if (nextTransmission.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL) {
      nextTransmission.examinateur_initial_user_id = user.id;
      nextFei.examinateur_initial_user_id = user.id;
      nextFei.examinateur_initial_offline = navigator.onLine ? false : true;
    }
    if (nextTransmission.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
      nextTransmission.premier_detenteur_user_id = user.id;
      nextFei.premier_detenteur_user_id = user.id;
      nextFei.premier_detenteur_offline = navigator.onLine ? false : true;
    }

    updateCarcassesTransmission(carcasseIds, nextTransmission);
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role: myNextOwnerRole,
      fei_numero: fei.numero,
      action: 'current-owner-confirm-premier-detenteur',
      history: createHistoryInput(transmission.content, nextTransmission),
      entity_id: nextOwnerEntityId,
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
          transmission.content.next_owner_user_id
            ? '🫵  Cette fiche vous a été attribuée'
            : '🫵  Cette fiche a été attribuée à votre société'
        }
        className="m-0 bg-white"
      >
        {notActivated && <CompteEnAttenteValidationAlert className="mb-4" />}
        <Button
          type="submit"
          className="my-4 block"
          disabled={notActivated}
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
              disabled={notActivated}
              onClick={() => {
                if (notActivated) {
                  return;
                }
                const nextTransmission: CarcasseTransmission = {
                  next_owner_entity_id: null,
                  next_owner_entity_name_cache: null,
                  next_owner_user_id: null,
                  next_owner_user_name_cache: null,
                  next_owner_role: null,
                };
                // Only reset my carcasses' next_owner
                updateCarcassesTransmission(carcasseIds, nextTransmission);
                addLog({
                  user_id: user.id,
                  user_role: transmission.content.next_owner_role as UserRoles,
                  fei_numero: fei.numero,
                  action: 'current-owner-renvoi',
                  entity_id: transmission.content.next_owner_entity_id,
                  zacharie_carcasse_id: null,
                  intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                  history: createHistoryInput(transmission.content, nextTransmission),
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
