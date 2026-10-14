import { TrichineResultatAnalyse } from '@prisma/client';

/**
 * Ce qu'on a le droit de prélever sur une carcasse, calculé depuis ses pools
 * (cf doc/trichine.md §5.1). Un prélèvement ne se refait pas librement : il n'a de
 * sens que pour ouvrir une analyse, initiale ou de 2e intention.
 *
 * - `LIBRE` : jamais prélevée, prélèvement initial
 * - `INITIAL_A_REFAIRE` : dernier résultat « analyse impossible », on reprend à zéro
 * - `DEUXIEME_INTENTION` : dans un pool douteux qu'aucune fille ne couvre encore
 * - `BLOQUEE` : analyse en cours, résultat rendu, ou échantillon en attente de regroupement
 */
export type EtatPrelevement = 'LIBRE' | 'INITIAL_A_REFAIRE' | 'DEUXIEME_INTENTION' | 'BLOQUEE';

export type EtatTrichineCarcasse = {
  etat: EtatPrelevement;
  /** Référence du dernier pool de la carcasse, null si l'échantillon est encore à regrouper */
  pool: string | null;
  ftps: Array<string>;
  resultat: TrichineResultatAnalyse | null;
  /** Pool douteux à resserrer, renseigné quand `etat` vaut DEUXIEME_INTENTION */
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

/**
 * État de prélèvement de chaque carcasse déjà échantillonnée. Une carcasse absente de
 * la table n'a jamais été prélevée : elle est `LIBRE`.
 */
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

    // Un pool douteux appelle une 2e intention tant qu'aucune de ses filles ne couvre la carcasse.
    // On prend le plus récent : après une fille douteuse, c'est elle qu'on resserre en petite-fille.
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

/**
 * La carcasse peut-elle recevoir un prélèvement ? `parentPoolId` vaut null pour un
 * prélèvement initial, et l'id du pool douteux qu'on resserre en 2e intention.
 */
export function estPrelevable(etat: EtatTrichineCarcasse | undefined, parentPoolId: string | null): boolean {
  if (!parentPoolId) return !etat || etat.etat === 'LIBRE' || etat.etat === 'INITIAL_A_REFAIRE';
  return etat?.etat === 'DEUXIEME_INTENTION' && etat.poolDouteux?.id === parentPoolId;
}
