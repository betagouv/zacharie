import { TrichineResultatAnalyse, TrichineStatutAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import prisma from '~/prisma';
import { logTrichineStatutChange, TrichineActionRequise, TrichineObjetType } from '~/utils/trichine';

/**
 * Recalcul des statuts trichine (cf doc/trichine.md §4.11).
 * Les fonctions compute* sont pures (testables sans DB), les fonctions
 * recompute* persistent + alimentent TrichineHistoriqueStatut.
 */

// DOUTEUX n'est PAS terminal : la confirmation LNR est obligatoire.
const TERMINAL_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NEGATIF,
  TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];

export function isTerminalResult(resultat: TrichineResultatAnalyse | null): boolean {
  return !!resultat && TERMINAL_RESULTS.includes(resultat);
}

/* -------------------------------------------------------------------------- */
/* Fonctions pures                                                             */
/* -------------------------------------------------------------------------- */

export function computePoolStatut({
  resultatAnalyse,
  hasChildEnCours,
  isInSentFtp,
}: {
  resultatAnalyse: TrichineResultatAnalyse | null;
  hasChildEnCours: boolean;
  isInSentFtp: boolean;
}): TrichineStatutAnalyse {
  // Règle pool mère : pas ANALYSES_TERMINEES tant qu'une fille / petite-fille est EN_COURS
  if (hasChildEnCours) return TrichineStatutAnalyse.EN_COURS_ANALYSES;
  if (isTerminalResult(resultatAnalyse)) return TrichineStatutAnalyse.ANALYSES_TERMINEES;
  // DOUTEUX = en attente de confirmation LNR
  if (resultatAnalyse === TrichineResultatAnalyse.DOUTEUX) return TrichineStatutAnalyse.EN_COURS_ANALYSES;
  if (isInSentFtp) return TrichineStatutAnalyse.EN_COURS_ANALYSES;
  return TrichineStatutAnalyse.A_COMPLETER;
}

export function computeFtpStatutAnalytique({
  poolResults,
  statutLogistique,
}: {
  poolResults: Array<TrichineResultatAnalyse | null>;
  statutLogistique: TrichineStatutLogistiqueFTP;
}): TrichineStatutAnalyse {
  if (poolResults.length && poolResults.every((resultat) => isTerminalResult(resultat))) {
    return TrichineStatutAnalyse.ANALYSES_TERMINEES;
  }
  if (statutLogistique !== TrichineStatutLogistiqueFTP.BROUILLON) {
    return TrichineStatutAnalyse.EN_COURS_ANALYSES;
  }
  return TrichineStatutAnalyse.A_COMPLETER;
}

export function computeFtpStatutLogistique({
  current,
  poolResults,
}: {
  current: TrichineStatutLogistiqueFTP;
  poolResults: Array<TrichineResultatAnalyse | null>;
}): TrichineStatutLogistiqueFTP {
  // Auto-clôture : une FTP reçue passe à TRAITEE dès que tous les résultats sont saisis
  // (question ouverte §11.6 tranchée côté simple : automatique, pas d'action manuelle labo)
  if (
    current === TrichineStatutLogistiqueFTP.RECUE &&
    poolResults.length &&
    poolResults.every((resultat) => resultat !== null)
  ) {
    return TrichineStatutLogistiqueFTP.TRAITEE;
  }
  return current;
}

type CarcassePoolView = {
  id: string;
  pool_parent_id: string | null;
  statut: TrichineStatutAnalyse;
  resultat_analyse: TrichineResultatAnalyse | null;
  created_at: Date;
};

/**
 * Calcule Carcasse.trichine_action_requise à partir des pools contenant un
 * échantillon de la carcasse. Retourne null quand il n'y a rien à signaler
 * (pas d'échantillon, ou échantillon/pool pas encore expédié).
 */
export function computeCarcasseActionRequise(
  pools: CarcassePoolView[],
  hasEchantillon: boolean
): string | null {
  if (!hasEchantillon || !pools.length) return null;

  const hasResult = (resultat: TrichineResultatAnalyse) =>
    pools.some((pool) => pool.resultat_analyse === resultat);

  // Résultat final LNR (favorable ou non) : plus d'action de prélèvement attendue,
  // le retrait éventuel de la FEI est une décision affichée depuis le résultat.
  if (
    hasResult(TrichineResultatAnalyse.POSITIF) ||
    hasResult(TrichineResultatAnalyse.NON_NEGATIF) ||
    hasResult(TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE)
  ) {
    return TrichineActionRequise.AUCUNE;
  }

  const douteux = pools.filter((pool) => pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX);
  if (douteux.length) {
    const douteuxIds = new Set(douteux.map((pool) => pool.id));
    const filles = pools.filter((pool) => pool.pool_parent_id && douteuxIds.has(pool.pool_parent_id));
    // Une 2e intention couvre cette carcasse et est au labo
    if (filles.some((pool) => pool.statut === TrichineStatutAnalyse.EN_COURS_ANALYSES)) {
      return TrichineActionRequise.ANALYSE_EN_COURS_LVD;
    }
    // Pas de 2e intention engagée (ou pas terminée d'être constituée) : à l'émetteur d'agir
    if (!filles.length || filles.some((pool) => pool.statut === TrichineStatutAnalyse.A_COMPLETER)) {
      return TrichineActionRequise.PRELEVEMENT_COMPLEMENTAIRE;
    }
    // 2e intention terminée sans résultat défavorable : reste la confirmation LNR
    return TrichineActionRequise.CONFIRMATION_EN_COURS_LNR;
  }

  if (pools.some((pool) => pool.statut === TrichineStatutAnalyse.EN_COURS_ANALYSES)) {
    return TrichineActionRequise.ANALYSE_EN_COURS_LVD;
  }

  const latest = [...pools].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0];
  if (latest.resultat_analyse === TrichineResultatAnalyse.NEGATIF) {
    return TrichineActionRequise.AUCUNE;
  }
  if (latest.resultat_analyse === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE) {
    return TrichineActionRequise.PRELEVEMENT_COMPLEMENTAIRE;
  }
  // Pool constitué mais pas encore expédié
  return null;
}

/* -------------------------------------------------------------------------- */
/* Recompute persistants                                                       */
/* -------------------------------------------------------------------------- */

export async function recomputeCarcasseTrichine(zacharieCarcasseId: string, userId: string) {
  const carcasse = await prisma.carcasse.findUnique({
    where: { zacharie_carcasse_id: zacharieCarcasseId },
    select: {
      zacharie_carcasse_id: true,
      trichine_action_requise: true,
      trichine_retire_de_fei_at: true,
      TrichineEchantillons: {
        where: { deleted_at: null },
        select: { id: true, TrichinePool: true },
      },
    },
  });
  if (!carcasse) return;

  const poolsById = new Map<
    string,
    NonNullable<(typeof carcasse.TrichineEchantillons)[number]['TrichinePool']>
  >();
  for (const echantillon of carcasse.TrichineEchantillons) {
    const pool = echantillon.TrichinePool;
    if (pool && !pool.deleted_at) poolsById.set(pool.id, pool);
  }

  // Carcasse retirée de la FEI : plus aucune action trichine attendue
  const actionRequise = carcasse.trichine_retire_de_fei_at
    ? TrichineActionRequise.AUCUNE
    : computeCarcasseActionRequise([...poolsById.values()], carcasse.TrichineEchantillons.length > 0);

  if (actionRequise !== carcasse.trichine_action_requise) {
    await prisma.carcasse.update({
      where: { zacharie_carcasse_id: zacharieCarcasseId },
      data: { trichine_action_requise: actionRequise },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.CARCASSE,
      objetId: zacharieCarcasseId,
      ancienStatut: carcasse.trichine_action_requise,
      nouveauStatut: actionRequise ?? '',
      userId,
      commentaire: 'trichine_action_requise',
    });
  }
}

export async function recomputeEchantillonTrichine(echantillonId: string, userId: string) {
  const echantillon = await prisma.trichineEchantillon.findUnique({
    where: { id: echantillonId },
    include: { TrichinePool: true },
  });
  if (!echantillon || echantillon.deleted_at) return;

  const pool =
    echantillon.TrichinePool && !echantillon.TrichinePool.deleted_at ? echantillon.TrichinePool : null;
  const statut = pool ? pool.statut : TrichineStatutAnalyse.A_COMPLETER;
  const resultat = pool ? pool.resultat_analyse : null;

  if (statut !== echantillon.statut || resultat !== echantillon.resultat_analyse) {
    await prisma.trichineEchantillon.update({
      where: { id: echantillonId },
      data: { statut, resultat_analyse: resultat },
    });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: echantillonId,
      ancienStatut: echantillon.statut,
      nouveauStatut: statut,
      userId,
    });
  }
  await recomputeCarcasseTrichine(echantillon.zacharie_carcasse_id, userId);
}

export async function recomputePoolTrichine(poolId: string, userId: string) {
  const pool = await prisma.trichinePool.findUnique({
    where: { id: poolId },
    include: {
      PoolsFilles: {
        where: { deleted_at: null },
        include: { PoolsFilles: { where: { deleted_at: null } } },
      },
      TrichinePoolFTPs: { include: { TrichineFTP: true } },
      TrichineEchantillons: { where: { deleted_at: null } },
    },
  });
  if (!pool || pool.deleted_at) return;

  const descendants = [...pool.PoolsFilles, ...pool.PoolsFilles.flatMap((fille) => fille.PoolsFilles)];
  const hasChildEnCours = descendants.some(
    (descendant) => descendant.statut === TrichineStatutAnalyse.EN_COURS_ANALYSES
  );
  const isInSentFtp = pool.TrichinePoolFTPs.some(
    ({ TrichineFTP: ftp }) =>
      !ftp.deleted_at && ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON
  );

  const statut = computePoolStatut({ resultatAnalyse: pool.resultat_analyse, hasChildEnCours, isInSentFtp });
  if (statut !== pool.statut) {
    await prisma.trichinePool.update({ where: { id: poolId }, data: { statut } });
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: poolId,
      ancienStatut: pool.statut,
      nouveauStatut: statut,
      userId,
    });
  }

  // Cache du statut/résultat du pool sur ses échantillons
  for (const echantillon of pool.TrichineEchantillons) {
    if (echantillon.statut !== statut || echantillon.resultat_analyse !== pool.resultat_analyse) {
      await prisma.trichineEchantillon.update({
        where: { id: echantillon.id },
        data: { statut, resultat_analyse: pool.resultat_analyse },
      });
      await logTrichineStatutChange({
        objetType: TrichineObjetType.ECHANTILLON,
        objetId: echantillon.id,
        ancienStatut: echantillon.statut,
        nouveauStatut: statut,
        userId,
      });
    }
  }

  const carcasseIds = [...new Set(pool.TrichineEchantillons.map((e) => e.zacharie_carcasse_id))];
  for (const carcasseId of carcasseIds) {
    await recomputeCarcasseTrichine(carcasseId, userId);
  }

  // La hiérarchie remonte : un changement sur une fille peut débloquer/bloquer la mère
  if (pool.pool_parent_id) {
    await recomputePoolTrichine(pool.pool_parent_id, userId);
  }
}

export async function recomputeFTPTrichine(ftpId: string, userId: string) {
  const ftp = await prisma.trichineFTP.findUnique({
    where: { id: ftpId },
    include: { TrichinePoolFTPs: { include: { TrichinePool: true } } },
  });
  if (!ftp || ftp.deleted_at) return;

  const poolResults = ftp.TrichinePoolFTPs.filter(({ TrichinePool: pool }) => !pool.deleted_at).map(
    ({ TrichinePool: pool }) => pool.resultat_analyse
  );

  const statutLogistique = computeFtpStatutLogistique({ current: ftp.statut_logistique, poolResults });
  const statutAnalytique = computeFtpStatutAnalytique({ poolResults, statutLogistique });

  if (statutLogistique !== ftp.statut_logistique || statutAnalytique !== ftp.statut_analytique) {
    await prisma.trichineFTP.update({
      where: { id: ftpId },
      data: { statut_logistique: statutLogistique, statut_analytique: statutAnalytique },
    });
    if (statutLogistique !== ftp.statut_logistique) {
      await logTrichineStatutChange({
        objetType: TrichineObjetType.FTP,
        objetId: ftpId,
        ancienStatut: ftp.statut_logistique,
        nouveauStatut: statutLogistique,
        userId,
        commentaire: 'statut_logistique',
      });
    }
    if (statutAnalytique !== ftp.statut_analytique) {
      await logTrichineStatutChange({
        objetType: TrichineObjetType.FTP,
        objetId: ftpId,
        ancienStatut: ftp.statut_analytique,
        nouveauStatut: statutAnalytique,
        userId,
        commentaire: 'statut_analytique',
      });
    }
  }
}
