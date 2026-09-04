import dayjs from 'dayjs';
import {
  TrichineResultatAnalyse,
  TrichineSitePrelevement,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
} from '@prisma/client';

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

// Contraintes des pools de 2e intention (miroir de api-express/src/utils/trichine.ts)
export const TRICHINE_POOL_FILLE_MAX_CARCASSES = 4;
export const TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES = 50;

// Masses de prélèvement par défaut selon le rang du pool
export const TRICHINE_MASSE_DEFAUT_INITIAL = 5;
export const TRICHINE_MASSE_DEFAUT_FILLE = 20;
export const TRICHINE_MASSE_DEFAUT_PETITE_FILLE = TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES;

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

// Statut logistique vu par l'émetteur : ce qu'il a fait de sa fiche
export const statutLogistiqueLabels: Record<TrichineStatutLogistiqueFTP, string> = {
  [TrichineStatutLogistiqueFTP.BROUILLON]: 'Brouillon',
  [TrichineStatutLogistiqueFTP.ENVOYEE]: 'Envoyée',
  [TrichineStatutLogistiqueFTP.RECUE]: 'Reçue par le laboratoire',
  [TrichineStatutLogistiqueFTP.TRAITEE]: 'Traitée',
  [TrichineStatutLogistiqueFTP.ANNULEE]: 'Annulée',
};

/**
 * Même statut vu par le laboratoire : la fiche lui parvient dès qu'elle est ENVOYEE, si bien
 * que « Envoyée » y désigne en réalité un colis dont la réception reste à enregistrer.
 * Les libellés reprennent donc ceux de l'onglet et du compteur « À réceptionner ».
 */
export const statutLogistiqueLaboLabels: Record<TrichineStatutLogistiqueFTP, string> = {
  ...statutLogistiqueLabels,
  [TrichineStatutLogistiqueFTP.ENVOYEE]: 'À réceptionner',
  [TrichineStatutLogistiqueFTP.RECUE]: 'Reçue',
};

export const sitePrelevementLabels: Record<TrichineSitePrelevement, string> = {
  [TrichineSitePrelevement.PILIER_DIAPHRAGME]: 'Pilier du diaphragme',
  [TrichineSitePrelevement.LANGUE]: 'Langue',
  [TrichineSitePrelevement.MEMBRE_ANTERIEUR]: 'Membre antérieur',
};

/** Options prêtes à l'emploi pour un choix de site (boutons ou select). */
export const sitePrelevementOptions = Object.values(TrichineSitePrelevement).map((site) => ({
  value: site,
  label: sitePrelevementLabels[site],
}));

export const trichineTypeLabels: Record<TrichineType, string> = {
  [TrichineType.INITIAL]: 'Initial',
  [TrichineType.COMPLEMENTAIRE]: 'Complémentaire (2e intention)',
  [TrichineType.CONFIRMATION]: 'Confirmation LNR',
};

// Valeurs String de TrichineDocument.type (cf doc/trichine.md §12.2)
export const documentTypeLabels: Record<string, string> = {
  RAPPORT_COFRAC: "Rapport d'analyse",
  PHOTOGRAPHIE_LARVE: 'Photographie de larve',
  FTP_PDF: 'Fiche de transmission',
  AUTRE: 'Document',
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
 * Une IPM2 signifie que le SVI a statué sur la carcasse : son résultat trichine est traité.
 * Un pool reste donc à traiter tant qu'une de ses carcasses n'a pas d'IPM2.
 */
export function poolEnAttenteIpm2(
  pool: { TrichineEchantillons: Array<{ zacharie_carcasse_id: string }> },
  carcassesAvecIpm2: Set<string>
): boolean {
  return pool.TrichineEchantillons.some(
    (echantillon) => !carcassesAvecIpm2.has(echantillon.zacharie_carcasse_id)
  );
}

// Libellés courts (pour badges de liste ; resultatAnalyseLabels est trop long)
export const resultatCourtLabels: Record<TrichineResultatAnalyse, string> = {
  [TrichineResultatAnalyse.NEGATIF]: 'Négatif',
  [TrichineResultatAnalyse.DOUTEUX]: 'Douteux',
  [TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE]: 'Impossible',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'Non négatif',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'Parasite ?',
  [TrichineResultatAnalyse.POSITIF]: 'Positif',
};

// Rang de sévérité (0 = pire) pour trier/agréger les résultats d'une FTP
function resultatSeverityRank(resultat: TrichineResultatAnalyse): number {
  if (isResultatDefavorable(resultat)) return 0; // POSITIF / NON_NEGATIF / parasite
  if (resultat === TrichineResultatAnalyse.DOUTEUX) return 1;
  if (resultat === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE) return 2;
  return 3; // NEGATIF
}

type FTPPoolResults = {
  TrichinePoolFTPs: Array<{ TrichinePool: { resultat_analyse: TrichineResultatAnalyse | null } }>;
};

// Niveau de trichine d'une FTP pour la mise en avant labo : confirmée (rouge) / suspectée (orange) / aucune
export type TrichineNiveauFTP = 'positif' | 'douteux' | null;
export function ftpTrichineNiveau(ftp: FTPPoolResults): TrichineNiveauFTP {
  const resultats = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool.resultat_analyse);
  if (resultats.some((resultat) => isResultatDefavorable(resultat))) return 'positif';
  if (resultats.some((resultat) => resultat === TrichineResultatAnalyse.DOUTEUX)) return 'douteux';
  return null;
}

// Résumé des résultats des pools d'une FTP, regroupés par valeur, pire en premier
export function ftpResultatsResume(
  ftp: FTPPoolResults
): Array<{ resultat: TrichineResultatAnalyse; count: number }> {
  const counts = new Map<TrichineResultatAnalyse, number>();
  for (const link of ftp.TrichinePoolFTPs) {
    const resultat = link.TrichinePool.resultat_analyse;
    if (resultat) counts.set(resultat, (counts.get(resultat) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([resultat, count]) => ({ resultat, count }))
    .sort((a, b) => resultatSeverityRank(a.resultat) - resultatSeverityRank(b.resultat));
}

/**
 * Libellé d'un statut apparaissant dans l'historique : la table est polymorphique et mélange
 * les valeurs des différents enums (analyse, logistique, résultat, action requise).
 */
export function libelleStatutHistorique(valeur: string | null): string {
  if (!valeur) return '—';
  return (
    statutAnalyseLabels[valeur as TrichineStatutAnalyse] ??
    statutLogistiqueLabels[valeur as TrichineStatutLogistiqueFTP] ??
    resultatAnalyseLabels[valeur as TrichineResultatAnalyse] ??
    actionRequiseLabels[valeur] ??
    valeur
  );
}

/**
 * Miroir de `isFtpPartie` côté backend : une fiche dont le colis est parti fige tout ce
 * qu'elle contient. C'est le backend qui arbitre, l'UI ne fait que masquer ce qui échouerait.
 */
export function ftpEstPartie(ftp: {
  deleted_at: Date | null;
  statut_logistique: TrichineStatutLogistiqueFTP;
}): boolean {
  if (ftp.deleted_at) return false;
  return (
    ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON &&
    ftp.statut_logistique !== TrichineStatutLogistiqueFTP.ANNULEE
  );
}

export function poolEstFige(pool: {
  TrichinePoolFTPs: Array<{
    TrichineFTP: { deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP };
  }>;
}): boolean {
  return pool.TrichinePoolFTPs.some((link) => ftpEstPartie(link.TrichineFTP));
}

/**
 * Statut utilisateur (À faire / En cours / Clôturé) — règles §4.11 côté émetteur.
 */
export type StatutUtilisateur = 'À faire' | 'En cours' | 'Clôturé';

// Types structurels : les mêmes règles servent aux listes et aux pages de détail,
// qui n'ont pas exactement la même profondeur de données.
type PoolStatutInput = {
  statut: TrichineStatutAnalyse;
  TrichinePoolFTPs: Array<{
    TrichineFTP: { deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP };
  }>;
};

export function statutUtilisateurPool(pool: PoolStatutInput): StatutUtilisateur {
  if (pool.statut === TrichineStatutAnalyse.ANALYSES_TERMINEES) return 'Clôturé';
  const dansFtpEnvoyee = pool.TrichinePoolFTPs.some(
    (link) =>
      !link.TrichineFTP.deleted_at &&
      link.TrichineFTP.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON &&
      link.TrichineFTP.statut_logistique !== TrichineStatutLogistiqueFTP.ANNULEE
  );
  return dansFtpEnvoyee ? 'En cours' : 'À faire';
}

export function statutUtilisateurFTP(ftp: {
  statut_logistique: TrichineStatutLogistiqueFTP;
  statut_analytique: TrichineStatutAnalyse;
}): StatutUtilisateur {
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON) return 'À faire';
  // Une fiche annulée n'attend plus rien de l'utilisateur ; le badge « Annulée » dit le reste
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.ANNULEE) return 'Clôturé';
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

/**
 * Où en est un objet trichine, en une ligne : un libellé et ce qu'il attend de l'utilisateur.
 * Les enums (suivi, logistique, analyse, résultat, type) décrivent la même progression sous
 * plusieurs angles — affichés côte à côte en badges ils se répètent sans rien apprendre.
 */
export type EtapeTrichine = { label: string; severity: BadgeSeverity; explication: string };

export function etapeFTP(ftp: {
  statut_logistique: TrichineStatutLogistiqueFTP;
  statut_analytique: TrichineStatutAnalyse;
}): EtapeTrichine {
  const analysesTerminees = ftp.statut_analytique === TrichineStatutAnalyse.ANALYSES_TERMINEES;
  switch (ftp.statut_logistique) {
    case TrichineStatutLogistiqueFTP.BROUILLON:
      return {
        label: 'À envoyer',
        severity: 'new',
        explication: '',
      };
    case TrichineStatutLogistiqueFTP.ENVOYEE:
      return {
        label: 'Envoyée au laboratoire',
        severity: 'info',
        explication: 'En attente de la réception du colis par le laboratoire.',
      };
    case TrichineStatutLogistiqueFTP.RECUE:
      return analysesTerminees
        ? {
            label: 'Résultats disponibles',
            severity: 'success',
            explication: 'Le laboratoire a rendu ses résultats, pool par pool, ci-dessous.',
          }
        : {
            label: 'Analyses en cours',
            severity: 'info',
            explication: 'Le laboratoire a réceptionné le colis. Les résultats apparaîtront ici.',
          };
    case TrichineStatutLogistiqueFTP.TRAITEE:
      return analysesTerminees
        ? {
            label: 'Analyses terminées',
            severity: 'success',
            explication: 'Le laboratoire a rendu tous ses résultats, pool par pool, ci-dessous.',
          }
        : {
            label: 'Résultats partiels',
            severity: 'info',
            explication: 'Le laboratoire a clôturé la fiche, une partie des résultats reste à venir.',
          };
    case TrichineStatutLogistiqueFTP.ANNULEE:
      return {
        label: 'Annulée',
        severity: 'warning',
        explication:
          "Le colis n'est pas analysé. Les pools sont de nouveau disponibles pour une autre fiche.",
      };
  }
}

/** Étape d'un pool ou d'un échantillon dont le laboratoire a rendu son résultat. */
function etapeResultat(resultat: TrichineResultatAnalyse): EtapeTrichine {
  switch (resultat) {
    case TrichineResultatAnalyse.NEGATIF:
      return {
        label: 'Résultat négatif',
        severity: 'success',
        explication: 'Aucune trichine détectée : les carcasses de ce pool suivent leur cours.',
      };
    case TrichineResultatAnalyse.DOUTEUX:
      return {
        label: 'Résultat douteux',
        severity: 'warning',
        explication:
          'Une larve a été détectée. Identifiez la carcasse concernée par des analyses de 2e intention.',
      };
    case TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE:
      return {
        label: 'Analyse impossible',
        severity: 'warning',
        explication: "Le laboratoire n'a pas pu analyser ce pool : un nouveau prélèvement est nécessaire.",
      };
    case TrichineResultatAnalyse.POSITIF:
      return {
        label: 'Trichine confirmée',
        severity: 'error',
        explication: 'Les carcasses de ce pool sont impropres à la consommation.',
      };
    case TrichineResultatAnalyse.NON_NEGATIF:
      return {
        label: 'Autre parasite détecté',
        severity: 'error',
        explication: 'Les carcasses de ce pool sont impropres à la consommation.',
      };
    case TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE:
      return {
        label: 'Parasite non identifié',
        severity: 'error',
        explication: 'Les carcasses de ce pool sont impropres à la consommation.',
      };
  }
}

type PoolFTPLinks = {
  TrichinePoolFTPs: Array<{
    TrichineFTP: { deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP };
  }>;
};

/** Où en est le colis d'un pool : pas encore de fiche, fiche en brouillon, ou fiche partie. */
function etatFTPDuPool(pool: PoolFTPLinks): 'aucune' | 'brouillon' | 'partie' {
  const liens = pool.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at);
  if (liens.some((link) => ftpEstPartie(link.TrichineFTP))) return 'partie';
  return liens.length > 0 ? 'brouillon' : 'aucune';
}

export function etapePool(
  pool: PoolFTPLinks & { resultat_analyse: TrichineResultatAnalyse | null }
): EtapeTrichine {
  if (pool.resultat_analyse) return etapeResultat(pool.resultat_analyse);
  switch (etatFTPDuPool(pool)) {
    case 'partie':
      return {
        label: 'Analyses en cours',
        severity: 'info',
        explication: "Le pool est parti au laboratoire. Son résultat s'affichera ici.",
      };
    case 'brouillon':
      return {
        label: 'À envoyer',
        severity: 'new',
        explication: 'Sa fiche de transmission est encore en brouillon : envoyez-la au laboratoire.',
      };
    case 'aucune':
      return {
        label: 'À transmettre',
        severity: 'new',
        explication:
          "Pool constitué. Rattachez-le à une fiche de transmission pour l'envoyer au laboratoire.",
      };
  }
}

export function etapeEchantillon(echantillon: {
  resultat_analyse: TrichineResultatAnalyse | null;
  TrichinePool: PoolFTPLinks | null;
}): EtapeTrichine {
  if (echantillon.resultat_analyse) return etapeResultat(echantillon.resultat_analyse);
  if (!echantillon.TrichinePool) {
    return {
      label: 'À regrouper',
      severity: 'new',
      explication: "Échantillon prélevé. Regroupez-le dans un pool pour l'envoyer au laboratoire.",
    };
  }
  switch (etatFTPDuPool(echantillon.TrichinePool)) {
    case 'partie':
      return {
        label: 'Analyses en cours',
        severity: 'info',
        explication: "Parti au laboratoire avec son pool. Le résultat s'affichera ici.",
      };
    case 'brouillon':
      return {
        label: 'À envoyer',
        severity: 'new',
        explication:
          'La fiche de transmission de son pool est encore en brouillon : envoyez-la au laboratoire.',
      };
    case 'aucune':
      return {
        label: 'À transmettre',
        severity: 'new',
        explication: "Regroupé dans un pool, qui n'est pas encore rattaché à une fiche de transmission.",
      };
  }
}

/**
 * Options du filtre « Suivi » des listes : exactement les valeurs affichées dans la colonne
 * « Suivi », pour qu'un filtre et un badge ne puissent pas se contredire.
 */
export const statutUtilisateurVues: Array<{ value: string; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'a-faire', label: 'À faire' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'cloture', label: 'Clôturé' },
];

const statutUtilisateurParVue: Record<string, StatutUtilisateur> = {
  'a-faire': 'À faire',
  'en-cours': 'En cours',
  cloture: 'Clôturé',
};

/** Filtre une liste sur le statut utilisateur affiché dans sa colonne « Suivi ». */
export function filterByStatutUtilisateur<Row>(
  rows: Array<Row>,
  vue: string,
  statutDeLaLigne: (row: Row) => StatutUtilisateur
): Array<Row> {
  const attendu = statutUtilisateurParVue[vue];
  return attendu ? rows.filter((row) => statutDeLaLigne(row) === attendu) : rows;
}

/** Un pool est rattachable à une FTP s'il n'est lié à aucune FTP non supprimée. */
export function poolSansFTP(pool: PoolStatutInput): boolean {
  return !pool.TrichinePoolFTPs.some((link) => !link.TrichineFTP.deleted_at);
}

/* -------------------------------------------------------------------------- */
/* Helpers des tables trichine (recherche + tri client-side)                   */
/* -------------------------------------------------------------------------- */

/**
 * Options d'un filtre de colonne construites à partir des valeurs réellement présentes :
 * inutile de proposer un laboratoire ou une FTP qui n'apparaît dans aucune ligne.
 * À préfixer par l'option « tous » du filtre.
 */
export function optionsDepuisColonne(
  valeurs: Array<string | null | undefined>
): Array<{ value: string; label: string }> {
  return [...new Set(valeurs.filter((valeur): valeur is string => !!valeur))]
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
    .map((valeur) => ({ value: valeur, label: valeur }));
}

/** Filtre une colonne date sur une période inclusive (bornes `YYYY-MM-DD`, chacune facultative). */
export function filterParPeriode<Row>(
  rows: Array<Row>,
  du: string,
  au: string,
  dateDeLaLigne: (row: Row) => Date | string | null
): Array<Row> {
  if (!du && !au) return rows;
  return rows.filter((row) => {
    const date = dateDeLaLigne(row);
    if (!date) return false;
    const jour = dayjs(date).format('YYYY-MM-DD');
    if (du && jour < du) return false;
    if (au && jour > au) return false;
    return true;
  });
}

/** Normalisation pour la recherche : minuscules, sans accents. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Recherche insensible à la casse et aux accents sur le texte concaténé d'une ligne. */
export function filterTrichineRows<T>(
  rows: Array<T>,
  query: string,
  getSearchableText: (row: T) => string
): Array<T> {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return rows;
  return rows.filter((row) => normalizeSearchText(getSearchableText(row)).includes(normalizedQuery));
}

export type TrichineSortOrder = 'ASC' | 'DESC';

/**
 * Tri générique null-safe (les valeurs nulles vont en dernier quel que soit l'ordre).
 * Les dates ISO en string se trient correctement par comparaison lexicale.
 */
export function sortTrichineRows<T>(rows: Array<T>, sortBy: keyof T, sortOrder: TrichineSortOrder): Array<T> {
  return [...rows].sort((a, b) => {
    const valueA = a[sortBy] as unknown;
    const valueB = b[sortBy] as unknown;
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;
    let result: number;
    if (valueA instanceof Date || valueB instanceof Date) {
      result = new Date(valueA as Date).getTime() - new Date(valueB as Date).getTime();
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      result = valueA - valueB;
    } else {
      result = String(valueA).localeCompare(String(valueB), 'fr');
    }
    return sortOrder === 'ASC' ? result : -result;
  });
}

/**
 * Filtres de la liste des FTP côté laboratoire (§6.3), par statut logistique (= la réception) :
 * à traiter (envoyée, pas encore reçue) / en cours (reçue) / clôturées (traitée).
 *
 * On NE se base PAS sur la présence d'un résultat : une FTP de confirmation vers le LNR porte
 * déjà le résultat DOUTEUX saisi par le LVD, ce qui la classerait à tort « en cours » avant même
 * que le LNR l'ait reçue.
 */
export type LaboFiltreTab = 'a-traiter' | 'en-cours' | 'cloturees';

export function filtreLaboFTP(ftp: { statut_logistique: TrichineStatutLogistiqueFTP }): LaboFiltreTab {
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE) return 'cloturees';
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.RECUE) return 'en-cours';
  return 'a-traiter'; // ENVOYEE (BROUILLON n'atteint jamais le labo, filtré côté backend)
}
