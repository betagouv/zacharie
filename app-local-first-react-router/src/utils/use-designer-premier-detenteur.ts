import { useMemo } from 'react';
import { Entity, EntityTypes, Fei, FeiOwnerRole, UserRoles } from '@prisma/client';
import type { UserForFei } from '~/src/types/user';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getCarcasseTransmission } from '@app/utils/get-carcasses-transmission';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { CarcasseTransmission } from '@app/types/carcasse';
import { track } from '@app/services/matomo';
import { useEntitiesIdsWorkingDirectlyFor, useDetenteursInitiaux } from '@app/utils/get-entity-relations';

// Désigne le propriétaire initial de la fiche (formulaire de la fiche et assistant Zacharie) :
// moi, une de mes associations, ou un autre utilisateur.
export function useDesignerPremierDetenteur(feiNumero: string) {
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);

  // isMe : « Je suis le propriétaire initial » (ou mon email saisi dans la recherche)
  return function designerPremierDetenteur({
    ownerUser,
    ownerEntity,
    isMe = false,
    assistantRequestId,
  }: {
    ownerUser?: UserForFei | null;
    ownerEntity?: Entity | null;
    isMe?: boolean;
    // désigné par l'assistant Zacharie : relie le log à celui de l'échange
    assistantRequestId?: string;
  }) {
    // lues au moment de l'appel : l'assistant crée des carcasses juste avant de désigner le propriétaire
    const myCarcasses = filterCarcassesForFei(useZustandStore.getState().carcasses, feiNumero);
    const nextIsMe = isMe;
    const nextIsMyAssociation = !!ownerEntity?.id;
    const offline = navigator.onLine ? false : true;
    let nextFei: Partial<Fei>;
    let nextCarcassesTransmission: Partial<CarcasseTransmission> = {};
    if (nextIsMe) {
      nextFei = {
        premier_detenteur_user_id: user.id,
        premier_detenteur_offline: offline,
        premier_detenteur_name_cache: `${user.prenom} ${user.nom_de_famille}`,
        premier_detenteur_entity_id: null,
      };
      nextCarcassesTransmission = {
        next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        next_owner_user_id: user.id,
        next_owner_user_name_cache: `${user.prenom} ${user.nom_de_famille}`,
        next_owner_entity_id: null,
        premier_detenteur_offline: offline,
        premier_detenteur_user_id: user.id,
        premier_detenteur_name_cache: `${user.prenom} ${user.nom_de_famille}`,
        premier_detenteur_entity_id: null,
      };
    } else if (nextIsMyAssociation) {
      const nextOwnerName = ownerEntity.nom_d_usage;
      nextFei = {
        premier_detenteur_user_id: user.id,
        premier_detenteur_name_cache: nextOwnerName,
        premier_detenteur_entity_id: ownerEntity.id,
        premier_detenteur_offline: offline,
      };
      nextCarcassesTransmission = {
        next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        next_owner_user_id: user.id,
        next_owner_user_name_cache: nextOwnerName,
        next_owner_entity_id: ownerEntity.id,
        next_owner_entity_name_cache: ownerEntity.nom_d_usage,
        premier_detenteur_user_id: user.id,
        premier_detenteur_offline: offline,
        premier_detenteur_entity_id: ownerEntity.id,
        premier_detenteur_name_cache: nextOwnerName,
      };
    } else {
      const nextOwnerName = ownerUser ? `${ownerUser.prenom} ${ownerUser.nom_de_famille}` : '';
      nextFei = {
        premier_detenteur_user_id: ownerUser?.id,
        premier_detenteur_name_cache: nextOwnerName,
        premier_detenteur_entity_id: null,
        premier_detenteur_offline: offline,
      };
      nextCarcassesTransmission = {
        next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        next_owner_user_id: ownerUser?.id,
        next_owner_user_name_cache: nextOwnerName,
        next_owner_entity_id: null,
        next_owner_entity_name_cache: null,
        premier_detenteur_user_id: ownerUser?.id,
        premier_detenteur_offline: offline,
        premier_detenteur_entity_id: null,
        premier_detenteur_name_cache: nextOwnerName,
      };
    }
    updateCarcassesTransmission(
      myCarcasses.map((c) => c.zacharie_carcasse_id),
      nextCarcassesTransmission
    );
    updateFei(feiNumero, nextFei);
    track(
      'fiche',
      'designer-premier-detenteur',
      nextIsMe ? 'moi' : nextIsMyAssociation ? 'association' : 'autre-utilisateur'
    );
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: feiNumero,
      action: 'examinateur-select-next',
      history: {
        ...createHistoryInput(
          myCarcasses[0] ? getCarcasseTransmission(myCarcasses[0]) : null,
          nextCarcassesTransmission
        ),
        ...(assistantRequestId ? { assistant_request_id: assistantRequestId } : {}),
      },
      entity_id: null,
      zacharie_carcasse_id: null,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
    syncData('examinateur-select-next');
  };
}

// Les propriétaires initiaux proposés : mes associations de chasse, puis les détenteurs déjà utilisés.
export function usePremierDetenteurOptions() {
  const entities = useZustandStore((state) => state.entities);
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const detenteursInitiaux = useDetenteursInitiaux();
  const associationsDeChasse = useMemo(() => {
    const associationsDeChasse: typeof entities = {};
    for (const entityId of Object.values(entitiesIdsWorkingDirectlyFor)) {
      const entity = entities[entityId];
      if (entity.type === EntityTypes.PREMIER_DETENTEUR) {
        associationsDeChasse[entityId] = entity;
      }
    }
    return associationsDeChasse;
  }, [entities, entitiesIdsWorkingDirectlyFor]);
  return { associationsDeChasse, detenteursInitiaux };
}
