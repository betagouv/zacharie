import dayjs from 'dayjs';
import {
  TrichineResultatAnalyse,
  TrichineSitePrelevement,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
} from '@prisma/client';

export const TRICHINE_FEATURE_ENABLED = import.meta.env.VITE_FEATURE_TRICHINE === 'true';

export const TRICHINE_ESPECE_CONCERNEE = 'Sanglier';

export const TRICHINE_POOL_MAX_CARCASSES = 19;
export const TRICHINE_POOL_MAX_MASSE_GRAMMES = 100;

export const TRICHINE_POOL_FILLE_MAX_CARCASSES = 5;
export const TRICHINE_POOL_PETITE_FILLE_MIN_MASSE_GRAMMES = 50;

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
  [TrichineResultatAnalyse.DOUTEUX]: 'Non négatif — à confirmer par le LNR',
  [TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE]: 'Analyse impossible',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'Autre parasite identifié',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'Parasite non identifié',
  [TrichineResultatAnalyse.POSITIF]: 'Positif — trichine confirmée',
};

export const statutLogistiqueLabels: Record<TrichineStatutLogistiqueFTP, string> = {
  [TrichineStatutLogistiqueFTP.BROUILLON]: 'Brouillon',
  [TrichineStatutLogistiqueFTP.ENVOYEE]: 'Envoyée',
  [TrichineStatutLogistiqueFTP.RECUE]: 'Reçue par le laboratoire',
  [TrichineStatutLogistiqueFTP.TRAITEE]: 'Traitée',
  [TrichineStatutLogistiqueFTP.ANNULEE]: 'Annulée',
};

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

export const sitePrelevementOptions = Object.values(TrichineSitePrelevement).map((site) => ({
  value: site,
  label: sitePrelevementLabels[site],
}));

export const trichineTypeLabels: Record<TrichineType, string> = {
  [TrichineType.INITIAL]: 'Initial',
  [TrichineType.COMPLEMENTAIRE]: 'Complémentaire (2e intention)',
  [TrichineType.CONFIRMATION]: 'Confirmation LNR',
};

export const documentTypeLabels: Record<string, string> = {
  RAPPORT_COFRAC: "Rapport d'analyse",
  PHOTOGRAPHIE_LARVE: 'Photographie de larve',
  FTP_PDF: 'Fiche de transmission',
  AUTRE: 'Document',
};

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

export function isResultatDefavorable(resultat: TrichineResultatAnalyse | null): boolean {
  return (
    resultat === TrichineResultatAnalyse.POSITIF ||
    resultat === TrichineResultatAnalyse.NON_NEGATIF ||
    resultat === TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE
  );
}

export function poolEnAttenteIpm2(
  pool: { TrichineEchantillons: Array<{ zacharie_carcasse_id: string }> },
  carcassesAvecIpm2: Set<string>
): boolean {
  return pool.TrichineEchantillons.some(
    (echantillon) => !carcassesAvecIpm2.has(echantillon.zacharie_carcasse_id)
  );
}

export const resultatCourtLabels: Record<TrichineResultatAnalyse, string> = {
  [TrichineResultatAnalyse.NEGATIF]: 'Négatif',
  [TrichineResultatAnalyse.DOUTEUX]: 'Non négatif',
  [TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE]: 'Impossible',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'Autre parasite',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'Parasite ?',
  [TrichineResultatAnalyse.POSITIF]: 'Positif',
};

function resultatSeverityRank(resultat: TrichineResultatAnalyse): number {
  if (isResultatDefavorable(resultat)) return 0;
  if (resultat === TrichineResultatAnalyse.DOUTEUX) return 1;
  if (resultat === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE) return 2;
  return 3;
}

type FTPPoolResults = {
  TrichinePoolFTPs: Array<{ TrichinePool: { resultat_analyse: TrichineResultatAnalyse | null } }>;
};

export type TrichineNiveauFTP = 'positif' | 'douteux' | null;
export function ftpTrichineNiveau(ftp: FTPPoolResults): TrichineNiveauFTP {
  const resultats = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool.resultat_analyse);
  if (resultats.some((resultat) => isResultatDefavorable(resultat))) return 'positif';
  if (resultats.some((resultat) => resultat === TrichineResultatAnalyse.DOUTEUX)) return 'douteux';
  return null;
}

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

export type StatutUtilisateur = 'À faire' | 'En cours' | 'Clôturé';

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
        label: 'Résultat non négatif',
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

export function estRetireParLabo(echantillon: { retire_par_labo_at: Date | string | null }): boolean {
  return !!echantillon.retire_par_labo_at;
}

export function etapeEchantillon(echantillon: {
  resultat_analyse: TrichineResultatAnalyse | null;
  retire_par_labo_at: Date | string | null;
  TrichinePool: PoolFTPLinks | null;
}): EtapeTrichine {
  if (estRetireParLabo(echantillon)) {
    return {
      label: 'Retiré par le laboratoire',
      severity: 'warning',
      explication:
        "Le laboratoire a retiré cet échantillon de son pool : il n'a pas été analysé. Prélevez de nouveau la carcasse.",
    };
  }
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

export function filterByStatutUtilisateur<Row>(
  rows: Array<Row>,
  vue: string,
  statutDeLaLigne: (row: Row) => StatutUtilisateur
): Array<Row> {
  const attendu = statutUtilisateurParVue[vue];
  return attendu ? rows.filter((row) => statutDeLaLigne(row) === attendu) : rows;
}

export function poolSansFTP(pool: PoolStatutInput): boolean {
  return !pool.TrichinePoolFTPs.some((link) => !link.TrichineFTP.deleted_at);
}

export function optionsDepuisColonne(
  valeurs: Array<string | null | undefined>
): Array<{ value: string; label: string }> {
  return [...new Set(valeurs.filter((valeur): valeur is string => !!valeur))]
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
    .map((valeur) => ({ value: valeur, label: valeur }));
}

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

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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

export type LaboFiltreTab = 'a-traiter' | 'en-cours' | 'cloturees';

export function filtreLaboFTP(ftp: { statut_logistique: TrichineStatutLogistiqueFTP }): LaboFiltreTab {
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE) return 'cloturees';
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.RECUE) return 'en-cours';
  return 'a-traiter';
}
