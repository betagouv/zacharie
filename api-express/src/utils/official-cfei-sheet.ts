import { canonicalNumeroCfei } from '~/utils/numero-cfei';

// Lecture d'un onglet de la liste nationale des personnes formées à l'examen initial
// (Google Sheet « Liste des personnes formées », un onglet par département ou par région).
// Chaque onglet a son propre en-tête : quelques lignes de titre (« LISTE DES PERSONNES FORMEES… »,
// « Département : X »), puis la ligne des noms de colonnes, dont l'intitulé et la position changent.

export interface OfficialCfeiRecord {
  numero_cfei: string;
  nom: string | null;
  prenom: string | null;
  departement: string | null;
}

export interface OfficialCfeiSheetResult {
  sheetName: string;
  records: Array<OfficialCfeiRecord>;
  // lignes non vides sous l'en-tête
  rowsRead: number;
  skipped: Record<string, number>;
  // onglet entièrement ignoré (pas d'en-tête reconnu, colonne vide…)
  error: string | null;
}

const HEADER_SEARCH_DEPTH = 15;

function normalizeHeader(cell: string) {
  return cell
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNumeroHeader(header: string) {
  return (
    header.includes('attestation') ||
    header.includes('agrement') ||
    header === 'cfei' ||
    /^(n|no|numero|n°) ?(de )?(l )?(cfei|examinateur)/.test(header)
  );
}

function isNomHeader(header: string) {
  return header === 'nom' || header === 'nom de famille' || header === 'nom de naissance';
}

function isPrenomHeader(header: string) {
  return header === 'prenom' || header === 'prenoms';
}

function isNomPrenomHeader(header: string) {
  return /^nom( et|,| \/| -)? ?prenoms?$/.test(header) || /^prenoms?( et|,| \/| -)? ?nom$/.test(header);
}

function isDepartementHeader(header: string) {
  return header === 'departement' || header === 'dept' || header === 'dpt' || header === 'dep';
}

export interface OfficialCfeiColumns {
  headerRowIndex: number;
  numero: number;
  nom: number | null;
  prenom: number | null;
  nomPrenom: number | null;
  departement: number | null;
}

export function findOfficialCfeiColumns(rows: Array<Array<string>>): OfficialCfeiColumns | null {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, HEADER_SEARCH_DEPTH); rowIndex++) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const numero = headers.findIndex(isNumeroHeader);
    if (numero === -1) continue;
    const find = (predicate: (header: string) => boolean) => {
      const index = headers.findIndex(predicate);
      return index === -1 ? null : index;
    };
    return {
      headerRowIndex: rowIndex,
      numero,
      nom: find(isNomHeader),
      prenom: find(isPrenomHeader),
      nomPrenom: find(isNomPrenomHeader),
      departement: find(isDepartementHeader),
    };
  }
  return null;
}

// Code département lu dans le nom de l'onglet (« 19 », « 2A »…), absent pour les onglets régionaux.
function departementFromSheetName(sheetName: string) {
  const name = sheetName.trim().toUpperCase();
  return /^(\d{2,3}|2[AB])$/.test(name) ? name : null;
}

function departementFromNumero(numero: string) {
  return numero.match(/^CFEI-([0-9AB]+)-/)?.[1] ?? numero.match(/^([0-9AB]+)-FREI-/)?.[1] ?? null;
}

// Un numéro d'examinateur contient au moins deux groupes de chiffres séparés (CFEI-45-13-577,
// 83-07-132, 32-FREI-20-002). Le reste (« en cours », « ? », une date…) n'est pas importé.
function looksLikeNumero(canonical: string) {
  return /^CFEI-[0-9AB]+-\d{2}-\d+$/.test(canonical) || /^[0-9AB]+-FREI-\d{2}-\d+$/.test(canonical);
}

function cell(row: Array<string>, index: number | null) {
  if (index === null) return null;
  return row[index]?.trim() || null;
}

export function extractOfficialCfeisFromSheet(
  sheetName: string,
  rows: Array<Array<string>>
): OfficialCfeiSheetResult {
  const result: OfficialCfeiSheetResult = { sheetName, records: [], rowsRead: 0, skipped: {}, error: null };
  const skip = (reason: string) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
  };

  const columns = findOfficialCfeiColumns(rows);
  if (!columns) {
    result.error = 'colonne du numéro introuvable';
    return result;
  }

  const sheetDepartement = departementFromSheetName(sheetName);
  for (const row of rows.slice(columns.headerRowIndex + 1)) {
    if (!row.some((value) => value?.trim())) continue;
    result.rowsRead++;

    const rawNumero = cell(row, columns.numero);
    if (!rawNumero) {
      skip('numéro vide');
      continue;
    }
    const numero_cfei = canonicalNumeroCfei(rawNumero);
    if (!looksLikeNumero(numero_cfei)) {
      skip('numéro au format inconnu');
      continue;
    }
    result.records.push({
      numero_cfei,
      nom: cell(row, columns.nom) ?? cell(row, columns.nomPrenom),
      prenom: cell(row, columns.prenom),
      departement: cell(row, columns.departement) ?? sheetDepartement ?? departementFromNumero(numero_cfei),
    });
  }

  if (result.rowsRead > 0 && result.records.length === 0) {
    result.error = 'aucun numéro exploitable';
  }
  return result;
}
