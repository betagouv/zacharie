import { useMemo } from 'react';
import type { CarcasseIntermediaire } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { getFeiAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  FeiIntermediaire,
} from '@app/types/fei-intermediaire';
import dayjs from 'dayjs';

export function filterCarcassesIntermediairesForCarcasse(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  zacharie_carcasse_id: string,
): Array<CarcasseIntermediaire> {
  return Object.values(byId)
    .filter((ci) => ci.zacharie_carcasse_id === zacharie_carcasse_id && !ci.deleted_at)
    .sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
}

export function filterCarcassesIntermediairesForIntermediaire(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  feiAndIntermediaireIds: FeiAndIntermediaireIds,
): Array<CarcasseIntermediaire> {
  return Object.values(byId)
    .filter((ci) => getFeiAndIntermediaireIds(ci) === feiAndIntermediaireIds && !ci.deleted_at)
    .sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
}

export function useCarcassesIntermediairesForCarcasse(
  zacharie_carcasse_id: string | undefined,
): Array<CarcasseIntermediaire> {
  const byId = useZustandStore((state) => state.carcassesIntermediaireById);
  return useMemo(() => {
    if (!zacharie_carcasse_id) return [];
    return filterCarcassesIntermediairesForCarcasse(byId, zacharie_carcasse_id);
  }, [byId, zacharie_carcasse_id]);
}

export function useCarcassesIntermediairesForIntermediaire(
  feiAndIntermediaireIds: FeiAndIntermediaireIds | undefined,
): Array<CarcasseIntermediaire> {
  const byId = useZustandStore((state) => state.carcassesIntermediaireById);
  return useMemo(() => {
    if (!feiAndIntermediaireIds) return [];
    return filterCarcassesIntermediairesForIntermediaire(byId, feiAndIntermediaireIds);
  }, [byId, feiAndIntermediaireIds]);
}

export function filterFeiIntermediaires(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  fei_numero: string,
): Array<FeiIntermediaire> {
  const seen: Record<string, FeiIntermediaire> = {};
  for (const ci of Object.values(byId)) {
    if (ci.fei_numero !== fei_numero || ci.deleted_at) continue;
    if (!seen[ci.intermediaire_id]) {
      seen[ci.intermediaire_id] = {
        id: ci.intermediaire_id,
        fei_numero: ci.fei_numero,
        intermediaire_user_id: ci.intermediaire_user_id,
        intermediaire_entity_id: ci.intermediaire_entity_id,
        intermediaire_role: ci.intermediaire_role,
        created_at: ci.created_at,
        prise_en_charge_at: ci.prise_en_charge_at,
        intermediaire_depot_type: ci.intermediaire_depot_type,
        intermediaire_depot_entity_id: ci.intermediaire_depot_entity_id,
        intermediaire_prochain_detenteur_role_cache: ci.intermediaire_prochain_detenteur_role_cache,
        intermediaire_prochain_detenteur_id_cache: ci.intermediaire_prochain_detenteur_id_cache,
      };
    }
  }
  return Object.values(seen).sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
}

export function useFeiIntermediaires(fei_numero: string | undefined): Array<FeiIntermediaire> {
  const byId = useZustandStore((state) => state.carcassesIntermediaireById);
  const numberOfIntermediaires = Object.values(byId).length;
  // FIXME: if I dont put the numberOfIntermediaires, the useMemo is not triggered when the intermediaires are updated
  //  I think it's a matter of objects and references
  return useMemo(() => {
    if (!fei_numero) return [];
    if (numberOfIntermediaires === 0) return [];
    return filterFeiIntermediaires(byId, fei_numero);
  }, [byId, fei_numero, numberOfIntermediaires]);
}
