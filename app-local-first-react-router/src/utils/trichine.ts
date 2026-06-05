import {
  TrichineResultatAnalyse,
  TrichineSitePrelevement,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
} from '@prisma/client';
import type { TrichineFTPPopulated, TrichinePoolPopulated } from '@app/services/trichine';

/**
 * Libellés et couleurs des statuts trichine (cf doc/trichine.md §4.10 et §4.11).
 */

/**
 * Feature flag trichine côté chasseur : la fonctionnalité reste invisible en
 * production tant que `VITE_FEATURE_TRICHINE=true` n'est pas posé au build.
 * Toujours actif en dev. L'espace laboratoire n'est PAS gaté (rôle LABORATOIRE
 * requis, aucun laboratoire actif en production).
 */
export const TRICHINE_FEATURE_ENABLED = import.meta.env.VITE_FEATURE_TRICHINE === 'true';

export const TRICHINE_ESPECE_CONCERNEE = 'Sanglier';

// Contraintes réglementaires pool initial (validées côté backend, rappelées côté UI)
export const TRICHINE_POOL_MAX_CARCASSES = 19;
export const TRICHINE_POOL_MAX_MASSE_GRAMMES = 100;

export const statutAnalyseLabels: Record<TrichineStatutAnalyse, string> = {
  [TrichineStatutAnalyse.A_COMPLETER]: 'À compléter',
  [TrichineStatutAnalyse.EN_COURS_ANALYSES]: "En cours d'analyses",
  [TrichineStatutAnalyse.ANALYSES_TERMINEES]: 'Analyses terminées',
};

export const resultatAnalyseLabels: Record<TrichineResultatAnalyse, string> = {
  [TrichineResultatAnalyse.NEGATIF]: 'Négatif',
  [TrichineResultatAnalyse.DOUTEUX]: 'Douteux — confirmation LNR en cours',
  [TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE]: 'Analyse impossible',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'Non négatif (autre parasite)',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'Parasite non identifié',
  [TrichineResultatAnalyse.POSITIF]: 'Positif — trichine confirmée',
};

export const statutLogistiqueLabels: Record<TrichineStatutLogistiqueFTP, string> = {
  [TrichineStatutLogistiqueFTP.BROUILLON]: 'Brouillon',
  [TrichineStatutLogistiqueFTP.ENVOYEE]: 'Envoyée',
  [TrichineStatutLogistiqueFTP.RECUE]: 'Reçue par le laboratoire',
  [TrichineStatutLogistiqueFTP.TRAITEE]: 'Traitée',
};

export const sitePrelevementLabels: Record<TrichineSitePrelevement, string> = {
  [TrichineSitePrelevement.PILIER_DIAPHRAGME]: 'Pilier du diaphragme',
  [TrichineSitePrelevement.LANGUE]: 'Langue',
  [TrichineSitePrelevement.MEMBRE_ANTERIEUR]: 'Membre antérieur',
};

// Valeurs String de Carcasse.trichine_action_requise (cf doc/trichine.md §4.10)
export const actionRequiseLabels: Record<string, string> = {
  AUCUNE: 'Aucune action requise',
  PRELEVEMENT_COMPLEMENTAIRE: 'Prélèvement complémentaire à réaliser',
  ANALYSE_EN_COURS_LVD: 'Analyse en cours au laboratoire',
  CONFIRMATION_EN_COURS_LNR: 'Confirmation en cours au LNR',
};

type BadgeSeverity = 'success' | 'warning' | 'error' | 'info' | 'new';

export function resultatBadgeSeverity(resultat: TrichineResultatAnalyse): BadgeSeverity {
  switch (resultat) {
    case TrichineResultatAnalyse.NEGATIF:
      return 'success';
    case TrichineResultatAnalyse.DOUTEUX:
    case TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE:
      return 'warning';
    default:
      // POSITIF / NON_NEGATIF / PRESENCE_PARASITE_NON_IDENTIFIE
      return 'error';
  }
}

export function statutAnalyseBadgeSeverity(statut: TrichineStatutAnalyse): BadgeSeverity {
  switch (statut) {
    case TrichineStatutAnalyse.A_COMPLETER:
      return 'new';
    case TrichineStatutAnalyse.EN_COURS_ANALYSES:
      return 'info';
    case TrichineStatutAnalyse.ANALYSES_TERMINEES:
      return 'success';
  }
}

// Résultats interdisant la consommation : retrait de la FEI possible (cf doc/trichine.md §6.1)
export function isResultatDefavorable(resultat: TrichineResultatAnalyse | null): boolean {
  return (
    resultat === TrichineResultatAnalyse.POSITIF ||
    resultat === TrichineResultatAnalyse.NON_NEGATIF ||
    resultat === TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE
  );
}

/**
 * Statut utilisateur (À faire / En cours / Clôturé) — règles §4.11 côté émetteur.
 */
export type StatutUtilisateur = 'À faire' | 'En cours' | 'Clôturé';

export function statutUtilisateurPool(pool: TrichinePoolPopulated): StatutUtilisateur {
  if (pool.statut === TrichineStatutAnalyse.ANALYSES_TERMINEES) return 'Clôturé';
  const dansFtpEnvoyee = pool.TrichinePoolFTPs.some(
    (link) => link.TrichineFTP.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON
  );
  return dansFtpEnvoyee ? 'En cours' : 'À faire';
}

export function statutUtilisateurFTP(ftp: TrichineFTPPopulated): StatutUtilisateur {
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON) return 'À faire';
  if (
    ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE &&
    ftp.statut_analytique === TrichineStatutAnalyse.ANALYSES_TERMINEES
  ) {
    return 'Clôturé';
  }
  return 'En cours';
}

export function statutUtilisateurBadgeSeverity(statut: StatutUtilisateur): BadgeSeverity {
  switch (statut) {
    case 'À faire':
      return 'new';
    case 'En cours':
      return 'info';
    case 'Clôturé':
      return 'success';
  }
}

/** Un pool est rattachable à une FTP s'il n'est lié à aucune FTP non supprimée. */
export function poolSansFTP(pool: TrichinePoolPopulated): boolean {
  return !pool.TrichinePoolFTPs.some((link) => !link.TrichineFTP.deleted_at);
}
