import { useMemo } from 'react';
import type { Carcasse, CarcasseIntermediaire, Fei } from '@prisma/client';
import useZustandStore from '@app/zustand/store';

// Ce que le propriétaire d'un CCG voit d'une carcasse : son dépôt dans le CCG et sa sortie du CCG.
// Jamais son devenir (refus, inspection SVI…).
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
  if (carcasse.premier_detenteur_depot_entity_id && ccgIds.includes(carcasse.premier_detenteur_depot_entity_id)) {
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

// Fiches passées par un CCG dont l'utilisateur est propriétaire : celles du pull CCG (lecture seule,
// sans statut) et celles de son propre périmètre qui y sont passées. La copie du périmètre l'emporte.
export function getCcgFiches({
  ccgEntityIds,
  feis,
  carcasses,
  carcassesIntermediaireById,
  ccgFeis,
  ccgCarcasses,
  ccgCarcassesIntermediaireById,
}: {
  ccgEntityIds: Array<string>;
  feis: Record<string, Fei>;
  carcasses: Record<string, Carcasse>;
  carcassesIntermediaireById: Record<string, CarcasseIntermediaire>;
  ccgFeis: Record<string, Fei>;
  ccgCarcasses: Record<string, Carcasse>;
  ccgCarcassesIntermediaireById: Record<string, CarcasseIntermediaire>;
}): Array<CcgFiche> {
  if (!ccgEntityIds.length) return [];
  const intermediairesByCarcasseId: Record<string, Array<CarcasseIntermediaire>> = {};
  const addIntermediaires = (source: Record<string, CarcasseIntermediaire>, carcasseIds: Set<string>) => {
    for (const intermediaire of Object.values(source)) {
      if (!carcasseIds.has(intermediaire.zacharie_carcasse_id)) continue;
      (intermediairesByCarcasseId[intermediaire.zacharie_carcasse_id] ??= []).push(intermediaire);
    }
  };
  const ownCarcasseIds = new Set(Object.keys(carcasses));
  const ccgOnlyCarcasseIds = new Set(Object.keys(ccgCarcasses).filter((id) => !ownCarcasseIds.has(id)));
  addIntermediaires(carcassesIntermediaireById, ownCarcasseIds);
  addIntermediaires(ccgCarcassesIntermediaireById, ccgOnlyCarcasseIds);

  const fichesByNumero: Record<string, CcgFiche> = {};
  const addCarcasse = (carcasse: Carcasse) => {
    if (carcasse.deleted_at) return;
    const fei = feis[carcasse.fei_numero] ?? ccgFeis[carcasse.fei_numero];
    if (!fei || fei.deleted_at) return;
    const view = getCcgCarcasseView(
      carcasse,
      intermediairesByCarcasseId[carcasse.zacharie_carcasse_id] ?? [],
      ccgEntityIds
    );
    if (!view) return;
    (fichesByNumero[fei.numero] ??= { fei, carcasses: [] }).carcasses.push(view);
  };
  for (const carcasse of Object.values(carcasses)) addCarcasse(carcasse);
  for (const id of ccgOnlyCarcasseIds) addCarcasse(ccgCarcasses[id]);

  return Object.values(fichesByNumero).sort(
    (a, b) => new Date(b.fei.date_mise_a_mort ?? 0).getTime() - new Date(a.fei.date_mise_a_mort ?? 0).getTime()
  );
}

export function useCcgFiches(): Array<CcgFiche> {
  const ccgEntityIds = useZustandStore((state) => state.ccgEntityIds);
  const feis = useZustandStore((state) => state.feis);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const ccgFeis = useZustandStore((state) => state.ccgFeis);
  const ccgCarcasses = useZustandStore((state) => state.ccgCarcasses);
  const ccgCarcassesIntermediaireById = useZustandStore((state) => state.ccgCarcassesIntermediaireById);
  return useMemo(
    () =>
      getCcgFiches({
        ccgEntityIds,
        feis,
        carcasses,
        carcassesIntermediaireById,
        ccgFeis,
        ccgCarcasses,
        ccgCarcassesIntermediaireById,
      }),
    [
      ccgEntityIds,
      feis,
      carcasses,
      carcassesIntermediaireById,
      ccgFeis,
      ccgCarcasses,
      ccgCarcassesIntermediaireById,
    ]
  );
}
