import { useEffect, useMemo, useState } from 'react';
import { TrichineResultatAnalyse } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { getTrichineCarcasse } from '@app/services/trichine';
import { isResultatDefavorable } from '@app/utils/trichine';

/** Base des liens trichine : les pages de src/routes/trichine/ sont montées sous l'espace SVI. */
export function useTrichineBasePath(): string {
  return '/app/svi/trichine';
}

/** Carcasses sur lesquelles le SVI a statué (IPM2), pour écarter les résultats déjà traités. */
export function useCarcassesAvecIpm2(): Set<string> {
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  return useMemo(
    () =>
      new Set(
        carcassesRegistry
          .filter((carcasse) => carcasse.svi_ipm2_date)
          .map((carcasse) => carcasse.zacharie_carcasse_id)
      ),
    [carcassesRegistry]
  );
}

/** Lien vers la fiche carcasse SVI depuis les écrans trichine : le numéro de fiche fait partie de l'URL. */
export function useTrichineCarcasseLink() {
  return (carcasse: { fei_numero?: string | null; zacharie_carcasse_id: string }): string | null => {
    if (!carcasse.fei_numero) return null;
    return `/app/svi/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;
  };
}

export type TrichineResultatSummary = {
  hasTriedLoading: boolean;
  /** Résultats (non null) de tous les pools couvrant la carcasse */
  resultats: Array<TrichineResultatAnalyse>;
  /** Au moins un pool négatif : IPM autorisée en circuit agréé */
  hasNegatif: boolean;
  /** POSITIF / NON_NEGATIF / PRESENCE_PARASITE_NON_IDENTIFIE */
  resultatDefavorable: TrichineResultatAnalyse | null;
};

/**
 * Résumé des résultats trichine d'une carcasse pour conditionner les décisions
 * IPM côté SVI (cf doc/trichine.md §6.2). Ne fetch que si `enabled`.
 */
export function useTrichineResultat(zacharieCarcasseId: string, enabled: boolean): TrichineResultatSummary {
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [resultats, setResultats] = useState<Array<TrichineResultatAnalyse>>([]);

  useEffect(() => {
    if (!enabled) return;
    getTrichineCarcasse(zacharieCarcasseId)
      .then((response) => {
        if (response.ok && response.data) {
          const pools = new Map<string, TrichineResultatAnalyse | null>();
          for (const echantillon of response.data.carcasse.TrichineEchantillons) {
            const pool = echantillon.TrichinePool;
            if (pool && !pool.deleted_at) pools.set(pool.id, pool.resultat_analyse);
          }
          setResultats([...pools.values()].filter((resultat) => resultat !== null));
        }
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, [zacharieCarcasseId, enabled]);

  return useMemo(
    () => ({
      hasTriedLoading,
      resultats,
      hasNegatif: resultats.includes(TrichineResultatAnalyse.NEGATIF),
      resultatDefavorable: resultats.find((resultat) => isResultatDefavorable(resultat)) ?? null,
    }),
    [hasTriedLoading, resultats]
  );
}
