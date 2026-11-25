import { useMemo } from 'react';
import type { Carcasse, CarcasseIntermediaire, Fei } from '@prisma/client';
import useZustandStore from '@app/zustand/store';

export type CcgCarcasseView = {
  carcasse: Carcasse;
  ccgId: string;
  deposeAt: Date | null;
  // null : dépôt par le premier détenteur
  deposant: CarcasseIntermediaire | null;
  // null : la carcasse est encore dans le CCG
  sortie: CarcasseIntermediaire | null;
};

export type CcgFiche = {
  fei: Fei;
  carcasses: Array<CcgCarcasseView>;
};

export function getCcgCarcasseView(
  carcasse: Carcasse,
  intermediaires: Array<CarcasseIntermediaire>,
  ccgIds: Array<string>
): CcgCarcasseView | null {
  const alive = intermediaires
    .filter((intermediaire) => !intermediaire.deleted_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (
    carcasse.premier_detenteur_depot_entity_id &&
    ccgIds.includes(carcasse.premier_detenteur_depot_entity_id)
  ) {
    return {
      carcasse,
      ccgId: carcasse.premier_detenteur_depot_entity_id,
      deposeAt: carcasse.premier_detenteur_depot_ccg_at,
      deposant: null,
      sortie: alive[0] ?? null,
    };
  }
  const depositIndex = alive.findIndex(
    (intermediaire) =>
      !!intermediaire.intermediaire_depot_entity_id &&
      ccgIds.includes(intermediaire.intermediaire_depot_entity_id)
  );
  if (depositIndex === -1) return null;
  const deposant = alive[depositIndex];
  return {
    carcasse,
    ccgId: deposant.intermediaire_depot_entity_id!,
    deposeAt: deposant.prise_en_charge_at,
    deposant,
    sortie: alive[depositIndex + 1] ?? null,
  };
}

export function getCcgFiches({
  ccgEntityIds,
  ccgCarcasseIds,
  feis,
  carcasses,
  carcassesIntermediaireById,
}: {
  ccgEntityIds: Array<string>;
  ccgCarcasseIds: Array<string>;
  feis: Record<string, Fei>;
  carcasses: Record<string, Carcasse>;
  carcassesIntermediaireById: Record<string, CarcasseIntermediaire>;
}): Array<CcgFiche> {
  const ids = new Set(ccgCarcasseIds);
  const intermediairesByCarcasseId: Record<string, Array<CarcasseIntermediaire>> = {};
  for (const intermediaire of Object.values(carcassesIntermediaireById)) {
    if (!ids.has(intermediaire.zacharie_carcasse_id)) continue;
    (intermediairesByCarcasseId[intermediaire.zacharie_carcasse_id] ??= []).push(intermediaire);
  }
  const fichesByNumero: Record<string, CcgFiche> = {};
  for (const id of ids) {
    const carcasse = carcasses[id];
    if (!carcasse || carcasse.deleted_at) continue;
    const fei = feis[carcasse.fei_numero];
    if (!fei || fei.deleted_at) continue;
    const view = getCcgCarcasseView(carcasse, intermediairesByCarcasseId[id] ?? [], ccgEntityIds);
    if (!view) continue;
    (fichesByNumero[fei.numero] ??= { fei, carcasses: [] }).carcasses.push(view);
  }
  return Object.values(fichesByNumero);
}

export function useCcgFiches(): Array<CcgFiche> {
  const ccgEntityIds = useZustandStore((state) => state.ccgEntityIds);
  const ccgCarcasseIds = useZustandStore((state) => state.ccgCarcasseIds);
  const feis = useZustandStore((state) => state.feis);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  return useMemo(
    () => getCcgFiches({ ccgEntityIds, ccgCarcasseIds, feis, carcasses, carcassesIntermediaireById }),
    [ccgEntityIds, ccgCarcasseIds, feis, carcasses, carcassesIntermediaireById]
  );
}
