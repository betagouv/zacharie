import { useEffect, useMemo, useState } from 'react';
import { TrichineResultatAnalyse } from '@prisma/client';
import { useCarcassesRegistry } from '@app/utils/useCarcassesRegistry';
import { getTrichineCarcasse } from '@app/services/trichine';
import { isResultatDefavorable } from '@app/utils/trichine';

export function useTrichineBasePath(): string {
  return '/app/svi/trichine';
}

export function useCarcassesAvecIpm2(): Set<string> {
  const carcassesRegistry = useCarcassesRegistry();
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

export function useTrichineCarcasseLink() {
  return (carcasse: { fei_numero?: string | null; zacharie_carcasse_id: string }): string | null => {
    if (!carcasse.fei_numero) return null;
    return `/app/svi/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;
  };
}

export type TrichineResultatSummary = {
  hasTriedLoading: boolean;
  resultats: Array<TrichineResultatAnalyse>;
  hasNegatif: boolean;
  resultatDefavorable: TrichineResultatAnalyse | null;
};

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
