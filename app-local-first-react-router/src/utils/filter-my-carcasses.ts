import { useMemo } from 'react';
import type { Carcasse, CarcasseIntermediaire } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/fei-intermediaire';

const userFields = [
  'current_owner_user_id',
  'next_owner_user_id',
  'prev_owner_user_id',
  'premier_detenteur_user_id',
  'examinateur_initial_user_id',
  'svi_user_id',
  'latest_intermediaire_user_id',
  'created_by_user_id',
] as const;

const entityFields = [
  'current_owner_entity_id',
  'next_owner_entity_id',
  'prev_owner_entity_id',
  'premier_detenteur_entity_id',
  'svi_entity_id',
  'latest_intermediaire_entity_id',
  'premier_detenteur_depot_entity_id',
  'next_owner_sous_traite_by_entity_id',
] as const;

export function filterMyCarcasses(
  carcasses: Array<Carcasse>,
  userId: string,
  entityIds: string[],
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
): Array<Carcasse> {
  const entityIdSet = new Set(entityIds);

  return carcasses.filter((carcasse) => {
    for (const field of userFields) {
      if ((carcasse as Record<string, unknown>)[field] === userId) return true;
    }

    for (const field of entityFields) {
      const value = (carcasse as Record<string, unknown>)[field] as string | null | undefined;
      if (value && entityIdSet.has(value)) return true;
    }

    // Check CarcasseIntermediaire entries for this carcasse
    for (const ci of Object.values(carcassesIntermediaireById)) {
      console.log('✌️ ~ ci.zacharie_carcasse_id:', ci.zacharie_carcasse_id);
      if (ci.zacharie_carcasse_id !== carcasse.zacharie_carcasse_id || ci.deleted_at) continue;
      console.log('✌️ ~ ci.intermediaire_user_id:', ci.intermediaire_user_id);
      console.log('✌️ ~ userId:', userId);
      if (ci.intermediaire_user_id === userId) return true;
      if (entityIdSet.has(ci.intermediaire_entity_id)) return true;
    }

    return false;
  });
}

export function useMyCarcassesForFei(fei_numero: string | undefined): Array<Carcasse> {
  const user = useUser((state) => state.user);
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const feiCarcasses = useCarcassesForFei(fei_numero);

  const entityIds = useMemo(() => Object.keys(entities), [entities]);

  console.log('✌️ ~ carcassesIntermediaireById:', carcassesIntermediaireById);
  return useMemo(() => {
    if (!user?.id || !fei_numero) return [];
    return filterMyCarcasses(feiCarcasses, user.id, entityIds, carcassesIntermediaireById);
  }, [feiCarcasses, user?.id, entityIds, carcassesIntermediaireById, fei_numero]);
}
