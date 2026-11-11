import { useMemo } from 'react';
import type { CarcasseIntermediaire } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { getFeiAndIntermediaireIds } from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  CarcassesIntermediaire,
} from '@app/types/carcasses-intermediaire';
import dayjs from 'dayjs';

type CarcasseIntermediaireWithId = CarcasseIntermediaire & { id: CarcassesIntermediaire['id'] };

const NO_INTERMEDIAIRES: Array<CarcasseIntermediaireWithId> = [];

// Index carcasse → intermédiaires, construit une seule fois par version du store et partagé par
// toutes les cartes : sans lui, chaque carte parcourait tous les intermédiaires de l'utilisateur
// (300 cartes × 20 000 intermédiaires ≈ 1 s à chaque modification du store).
const indexByStoreVersion = new WeakMap<
  Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  Map<string, Array<CarcasseIntermediaireWithId>>
>();

function getIndexByCarcasse(byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>) {
  let index = indexByStoreVersion.get(byId);
  if (index) return index;
  index = new Map();
  for (const ci of Object.values(byId)) {
    if (ci.deleted_at) continue;
    let intermediaires = index.get(ci.zacharie_carcasse_id);
    if (!intermediaires) {
      intermediaires = [];
      index.set(ci.zacharie_carcasse_id, intermediaires);
    }
    intermediaires.push({ id: ci.intermediaire_id, ...ci });
  }
  for (const intermediaires of index.values()) {
    intermediaires.sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
  }
  indexByStoreVersion.set(byId, index);
  return index;
}

// Le tableau renvoyé est partagé entre les appelants : ne pas le modifier.
export function filterCarcassesIntermediairesForCarcasse(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  zacharie_carcasse_id: string
): ReadonlyArray<CarcasseIntermediaireWithId> {
  return getIndexByCarcasse(byId).get(zacharie_carcasse_id) ?? NO_INTERMEDIAIRES;
}

export function filterCarcassesIntermediairesForIntermediaire(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  feiAndIntermediaireIds: FeiAndIntermediaireIds
): Array<CarcasseIntermediaire> {
  return Object.values(byId)
    .filter((ci) => getFeiAndIntermediaireIds(ci) === feiAndIntermediaireIds && !ci.deleted_at)
    .sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
}

export function useCarcassesIntermediairesForCarcasse(
  zacharie_carcasse_id: string | undefined
): ReadonlyArray<CarcasseIntermediaireWithId> {
  const byId = useZustandStore((state) => state.carcassesIntermediaireById);
  return useMemo(() => {
    if (!zacharie_carcasse_id) return NO_INTERMEDIAIRES;
    return filterCarcassesIntermediairesForCarcasse(byId, zacharie_carcasse_id);
  }, [byId, zacharie_carcasse_id]);
}

export function useCarcassesIntermediairesForIntermediaire(
  feiAndIntermediaireIds: FeiAndIntermediaireIds | undefined
): Array<CarcasseIntermediaire> {
  const byId = useZustandStore((state) => state.carcassesIntermediaireById);
  return useMemo(() => {
    if (!feiAndIntermediaireIds) return [];
    return filterCarcassesIntermediairesForIntermediaire(byId, feiAndIntermediaireIds);
  }, [byId, feiAndIntermediaireIds]);
}

export function filterFeiIntermediaires(
  byId: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>,
  fei_numero: string
): Array<CarcassesIntermediaire> {
  const seen: Record<string, CarcassesIntermediaire> = {};
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
        numero_bon_reception: ci.numero_bon_reception,
        intermediaire_depot_type: ci.intermediaire_depot_type,
        intermediaire_depot_entity_id: ci.intermediaire_depot_entity_id,
        intermediaire_prochain_detenteur_role_cache: ci.intermediaire_prochain_detenteur_role_cache,
        intermediaire_prochain_detenteur_id_cache: ci.intermediaire_prochain_detenteur_id_cache,
      };
    }
    // Les champs de décision de transmission (prochain détenteur, dépôt, n° de bon de réception) ne
    // sont posés que sur les
    // carcasses prises en charge, jamais sur les refusées/manquantes. Le représentant doit donc
    // retenir la valeur non-nulle de n'importe quelle carcasse de l'intermédiaire, quel que soit
    // l'ordre d'itération (sinon une carcasse refusée en tête masque la décision réelle).
    const rep = seen[ci.intermediaire_id];
    if (ci.intermediaire_prochain_detenteur_id_cache != null) {
      rep.intermediaire_prochain_detenteur_id_cache = ci.intermediaire_prochain_detenteur_id_cache;
      rep.intermediaire_prochain_detenteur_role_cache = ci.intermediaire_prochain_detenteur_role_cache;
    }
    if (ci.intermediaire_depot_type != null) {
      rep.intermediaire_depot_type = ci.intermediaire_depot_type;
      rep.intermediaire_depot_entity_id = ci.intermediaire_depot_entity_id;
    }
    if (ci.numero_bon_reception != null) {
      rep.numero_bon_reception = ci.numero_bon_reception;
    }
  }
  // ordre chronologique décroissant, du plus récent au plus ancien
  return Object.values(seen).sort((a, b) => (dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1));
}
