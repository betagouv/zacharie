import { TrichineResultatAnalyse } from '@prisma/client';

export type EtatPrelevement = 'LIBRE' | 'INITIAL_A_REFAIRE' | 'DEUXIEME_INTENTION' | 'BLOQUEE';

export type EtatTrichineCarcasse = {
  etat: EtatPrelevement;
  pool: string | null;
  ftps: Array<string>;
  resultat: TrichineResultatAnalyse | null;
  poolDouteux: { id: string; reference_pool: string } | null;
};

type PoolPourEtat = {
  id: string;
  reference_pool: string;
  pool_parent_id: string | null;
  resultat_analyse: TrichineResultatAnalyse | null;
  created_at: Date | string;
  deleted_at: Date | string | null;
  TrichineEchantillons: Array<{ zacharie_carcasse_id: string; deleted_at: Date | string | null }>;
  TrichinePoolFTPs: Array<{ TrichineFTP: { numero_fiche: string; deleted_at: Date | string | null } }>;
};

type EchantillonPourEtat = { zacharie_carcasse_id: string; deleted_at: Date | string | null };

const parDateCroissante = (a: PoolPourEtat, b: PoolPourEtat) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

export function etatsTrichineParCarcasse(
  echantillons: Array<EchantillonPourEtat>,
  pools: Array<PoolPourEtat>
): Map<string, EtatTrichineCarcasse> {
  const poolsActifs = pools.filter((pool) => !pool.deleted_at);

  const poolsParCarcasse = new Map<string, Array<PoolPourEtat>>();
  for (const pool of poolsActifs) {
    for (const echantillon of pool.TrichineEchantillons) {
      if (echantillon.deleted_at) continue;
      const liste = poolsParCarcasse.get(echantillon.zacharie_carcasse_id) ?? [];
      liste.push(pool);
      poolsParCarcasse.set(echantillon.zacharie_carcasse_id, liste);
    }
  }

  const etats = new Map<string, EtatTrichineCarcasse>();
  const carcasseIds = new Set([
    ...echantillons.filter((echantillon) => !echantillon.deleted_at).map((e) => e.zacharie_carcasse_id),
    ...poolsParCarcasse.keys(),
  ]);

  for (const carcasseId of carcasseIds) {
    const poolsDeLaCarcasse = (poolsParCarcasse.get(carcasseId) ?? []).sort(parDateCroissante);
    const dernier = poolsDeLaCarcasse[poolsDeLaCarcasse.length - 1] ?? null;

    const douteuxNonCouvert = [...poolsDeLaCarcasse]
      .reverse()
      .find(
        (pool) =>
          pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX &&
          !poolsDeLaCarcasse.some((autre) => autre.pool_parent_id === pool.id)
      );

    const etat: EtatPrelevement = douteuxNonCouvert
      ? 'DEUXIEME_INTENTION'
      : dernier?.resultat_analyse === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE
        ? 'INITIAL_A_REFAIRE'
        : 'BLOQUEE';

    etats.set(carcasseId, {
      etat,
      pool: dernier?.reference_pool ?? null,
      ftps: (dernier?.TrichinePoolFTPs ?? [])
        .filter((lien) => !lien.TrichineFTP.deleted_at)
        .map((lien) => lien.TrichineFTP.numero_fiche),
      resultat: dernier?.resultat_analyse ?? null,
      poolDouteux: douteuxNonCouvert
        ? { id: douteuxNonCouvert.id, reference_pool: douteuxNonCouvert.reference_pool }
        : null,
    });
  }

  return etats;
}

export function estPrelevable(etat: EtatTrichineCarcasse | undefined, parentPoolId: string | null): boolean {
  if (!parentPoolId) return !etat || etat.etat === 'LIBRE' || etat.etat === 'INITIAL_A_REFAIRE';
  return etat?.etat === 'DEUXIEME_INTENTION' && etat.poolDouteux?.id === parentPoolId;
}
