import { utils, type WorkSheet } from '@e965/xlsx';
import type { CcgPreviewRow } from '@api/src/types/responses';

// Collapse all whitespace (spaces, \r, \n) into a single space, then trim
const normalize = (s: string) => s.replace(/[\s]+/g, ' ').trim();

const NUMERO_DDECPP_HEADERS = [
  'Unité Activité (UA) : Identifier métier (Type : Valorisation)',
  'numero_ddecpp',
  'Numéro DDECPP',
].map(normalize);

// L'export RESYTAL commence par des lignes de notes dont le nombre varie :
// on prend comme en-têtes la première ligne qui contient la colonne du numéro DDECPP
function findHeaderRowIndex(sheet: WorkSheet): number {
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true });
  return rows.findIndex((row) => row.some((cell) => NUMERO_DDECPP_HEADERS.includes(normalize(String(cell)))));
}

export function parseCcgSheet(sheet: WorkSheet): CcgPreviewRow[] {
  const headerRowIndex = findHeaderRowIndex(sheet);
  if (headerRowIndex === -1) return [];
  const jsonRows = utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    range: headerRowIndex,
  });

  // Find the first matching normalized target
  const col = (normalizedRow: Map<string, string>, ...targets: string[]) => {
    for (const t of targets) {
      const v = normalizedRow.get(normalize(t));
      if (v !== undefined) return v;
    }
    return '';
  };

  const mapped: CcgPreviewRow[] = jsonRows.map((row) => {
    const normalizedRow = new Map<string, string>();
    for (const [k, v] of Object.entries(row)) {
      normalizedRow.set(normalize(k), String(v).trim());
    }
    return {
      numero_ddecpp: (() => {
        const raw = col(
          normalizedRow,
          'Unité Activité (UA) : Identifier métier (Type : Valorisation)',
          'numero_ddecpp',
          'Numéro DDECPP'
        );
        const match = raw.match(/\d{2,3}-CCG-\d+/);
        return match ? match[0] : raw;
      })(),
      nom_d_usage: col(
        normalizedRow,
        'Établissement : Enseigne usuelle (RESYTAL)',
        'nom_d_usage',
        'raison_sociale',
        'Raison sociale'
      ),
      address_ligne_1: col(
        normalizedRow,
        'Unité Activité (UA) : Adresse de localisation : Concaténations des lignes adresses 1, 2 & 3',
        'Établissement : Adresse postale : Concaténations des lignes adresses 1, 2 & 3',
        'address_ligne_1',
        'Adresse'
      ),
      address_ligne_2: '',
      code_postal: col(
        normalizedRow,
        "Unité d'Activité (UA) : Code postal (Adresse de localisation)",
        'Établissement : Adresse postale: Code postal',
        'code_postal',
        'Code postal'
      ),
      ville: col(
        normalizedRow,
        'Unité Activité (UA) : Adresse de localisation : Commune Nom',
        'Établissement : Adresse postale: Bureau distributeur',
        'ville',
        'Ville'
      ),
      siret: col(normalizedRow, 'Établissement : SIRET/NUMAGRIT', 'siret', 'SIRET'),
    };
  });

  return mapped.filter((r) => /^\d{2,3}-CCG-\d+$/.test(r.numero_ddecpp));
}
