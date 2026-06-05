import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { TrichineResultatAnalyse } from '@prisma/client';
import { getTrichineCarcasse } from '@app/services/trichine';
import { isResultatDefavorable } from '@app/utils/trichine';

/**
 * Base des liens trichine selon l'espace courant (chasseur mobile / SVI desktop).
 * Les pages de src/routes/trichine/ sont montées sous les deux espaces.
 */
export function useTrichineBasePath(): string {
  const location = useLocation();
  return location.pathname.startsWith('/app/svi') ? '/app/svi/trichine' : '/app/chasseur/trichine';
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
