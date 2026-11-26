import { parse as parseCsv } from 'csv-parse/sync';
import { TrichineResultatAnalyse } from '@prisma/client';

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
  resultat_analyse: TrichineResultatAnalyse | null;
  raw_resultat: string;
  parasite_identifie?: string;
  nombre_larves?: number;
  date_debut_analyse?: string;
  date_fin_analyse?: string;
  reference_labo?: string;
  commentaire?: string;
  erreur_format?: string;
};

export class ImportFormatError extends Error {}

export function normalizeResultatValue(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseLimsFile(content: string): Array<Record<string, string>> {
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
