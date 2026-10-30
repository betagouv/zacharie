import { parse as parseCsv } from 'csv-parse/sync';
import { TrichineResultatAnalyse } from '@prisma/client';

/**
 * Lecture du fichier d'import de résultats trichine. Le format est unique et imposé par Zacharie
 * (documenté aux laboratoires sur /app/laboratoire/results/format) : c'est au laboratoire d'adapter
 * son export LIMS. Fonctions pures (testables sans DB) : le rapprochement aux pools et
 * l'application se font ailleurs.
 */

export const IMPORT_COLUMNS = [
  'reference_pool',
  'resultat_analyse',
  'parasite_identifie',
  'nombre_larves',
  'date_debut_analyse',
  'date_fin_analyse',
  'reference_labo',
  'commentaire',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export const IMPORT_REQUIRED_COLUMNS: Array<ImportColumn> = ['reference_pool', 'resultat_analyse'];

// Valeur de la colonne resultat_analyse (normalisée) -> résultat Zacharie, selon le laboratoire.
// « non_negatif » a le sens réglementaire de chaque laboratoire : pour un LVD, larve détectée à
// confirmer par le LNR ; pour le LNR, parasite autre que la trichine.
const RESULTAT_VALUES_LVD: Record<string, TrichineResultatAnalyse> = {
  negatif: TrichineResultatAnalyse.NEGATIF,
  non_negatif: TrichineResultatAnalyse.DOUTEUX,
};
const RESULTAT_VALUES_LNR: Record<string, TrichineResultatAnalyse> = {
  non_negatif: TrichineResultatAnalyse.NON_NEGATIF,
  presence_parasite_non_identifie: TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  positif: TrichineResultatAnalyse.POSITIF,
};

export function valeursResultatAcceptees(isLnr: boolean): Array<string> {
  return Object.keys(isLnr ? RESULTAT_VALUES_LNR : RESULTAT_VALUES_LVD);
}

const DATE_COLUMNS: Array<ImportColumn> = ['date_debut_analyse', 'date_fin_analyse'];

export type MappedLimsRow = {
  reference_pool: string;
  // null si la valeur de résultat n'est pas reconnue (→ ligne « invalide » à l'aperçu)
  resultat_analyse: TrichineResultatAnalyse | null;
  // valeur brute du fichier, conservée pour l'affichage / le diagnostic
  raw_resultat: string;
  parasite_identifie?: string;
  nombre_larves?: number;
  date_debut_analyse?: string;
  date_fin_analyse?: string;
  reference_labo?: string;
  commentaire?: string;
  // Erreur de format propre à la ligne (date ou nombre de larves mal écrit)
  erreur_format?: string;
};

export class ImportFormatError extends Error {}

// Minuscule, sans accent, sans espaces autour : « Négatif », « NEGATIF » et « negatif » sont acceptés
export function normalizeResultatValue(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Parse le CSV en lignes clé/valeur. Lève ImportFormatError si une colonne obligatoire manque.
 * Les colonnes inconnues sont ignorées.
 */
export function parseLimsFile(content: string): Array<Record<string, string>> {
  // Séparateur détecté sur la ligne d'en-tête (`;` prioritaire)
  const header = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = header.includes(';') ? ';' : ',';
  const [headers = [], ...lines] = parseCsv(content, {
    delimiter,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Array<Array<string>>;
  const columns = headers.map((name) => name.toLowerCase());
  const manquantes = IMPORT_REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  if (manquantes.length) {
    throw new ImportFormatError(
      `Colonne(s) obligatoire(s) absente(s) : ${manquantes.join(', ')}. Colonnes attendues : ${IMPORT_COLUMNS.join(', ')}.`
    );
  }
  return lines.map((line) => Object.fromEntries(columns.map((column, index) => [column, line[index] ?? ''])));
}

/** Lit une ligne brute selon le format Zacharie, pour un LVD ou pour le LNR. */
export function mapRow(raw: Record<string, string>, isLnr: boolean): MappedLimsRow {
  const get = (column: ImportColumn): string => (raw[column] != null ? String(raw[column]).trim() : '');
  const rawResultat = get('resultat_analyse');
  const dateInvalide = DATE_COLUMNS.find((column) => get(column) && !isValidIsoDate(get(column)));
  const nombreLarves = get('nombre_larves');
  const nombreLarvesInvalide = !!nombreLarves && !/^[1-9]\d*$/.test(nombreLarves);
  return {
    reference_pool: get('reference_pool'),
    resultat_analyse:
      (isLnr ? RESULTAT_VALUES_LNR : RESULTAT_VALUES_LVD)[normalizeResultatValue(rawResultat)] ?? null,
    raw_resultat: rawResultat,
    parasite_identifie: get('parasite_identifie') || undefined,
    nombre_larves: nombreLarves && !nombreLarvesInvalide ? Number(nombreLarves) : undefined,
    date_debut_analyse: get('date_debut_analyse') || undefined,
    date_fin_analyse: get('date_fin_analyse') || undefined,
    reference_labo: get('reference_labo') || undefined,
    commentaire: get('commentaire') || undefined,
    erreur_format: dateInvalide
      ? `Date invalide dans ${dateInvalide} : « ${get(dateInvalide)} » (format attendu AAAA-MM-JJ)`
      : nombreLarvesInvalide
        ? `Nombre de larves invalide : « ${nombreLarves} » (nombre entier supérieur à 0 attendu)`
        : undefined,
  };
}
