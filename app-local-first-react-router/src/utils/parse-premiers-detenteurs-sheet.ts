import { utils, type WorkSheet } from '@e965/xlsx';
import type { PremierDetenteurImportRow } from '@api/src/types/responses';

// Collapse all whitespace (spaces, \r, \n) into a single space, then trim, lowercase
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const RAISON_SOCIALE_HEADERS = ['raison sociale', 'raison_sociale', 'nom'];
const CODE_POSTAL_HEADERS = ['code postal', 'code_postal', 'cp'];
const VILLE_HEADERS = ['commune', 'ville'];

// on prend comme en-têtes la première ligne qui contient la colonne de la raison sociale
function findHeaderRowIndex(sheet: WorkSheet): number {
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true });
  return rows.findIndex((row) =>
    row.some((cell) => RAISON_SOCIALE_HEADERS.includes(normalize(String(cell))))
  );
}

// Excel stocke le code postal comme un nombre et perd le 0 initial : 1000 → 01000
const padCodePostal = (s: string) => (/^\d{4}$/.test(s) ? s.padStart(5, '0') : s);

export function parsePremiersDetenteursSheet(sheet: WorkSheet): PremierDetenteurImportRow[] {
  const headerRowIndex = findHeaderRowIndex(sheet);
  if (headerRowIndex === -1) return [];
  const jsonRows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', range: headerRowIndex });

  return jsonRows
    .map((row) => {
      const normalizedRow = new Map<string, string>();
      for (const [k, v] of Object.entries(row)) {
        normalizedRow.set(normalize(k), String(v).replace(/\s+/g, ' ').trim());
      }
      const col = (targets: string[]) => {
        for (const t of targets) {
          const v = normalizedRow.get(t);
          if (v !== undefined) return v;
        }
        return '';
      };
      return {
        raison_sociale: col(RAISON_SOCIALE_HEADERS),
        code_postal: padCodePostal(col(CODE_POSTAL_HEADERS)),
        ville: col(VILLE_HEADERS),
      };
    })
    .filter((row) => row.raison_sociale.length > 0);
}
