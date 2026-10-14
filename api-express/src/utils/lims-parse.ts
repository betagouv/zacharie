import { parse as parseCsv } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import { TrichineResultatAnalyse } from '@prisma/client';
import { normalizeLimsValue, type LimsCanonicalField, type LimsMapping } from '~/utils/lims-mapping';

/**
 * Parse + mappe un export LIMS (CSV ou XML) vers des lignes de résultats Zacharie.
 * Fonctions pures (testables sans DB) : le rapprochement aux pools et l'application se font ailleurs.
 */

export type MappedLimsRow = {
  reference_pool: string;
  // null si le libellé de résultat n'a pas pu être mappé (→ ligne « invalide » à l'aperçu)
  resultat_analyse: TrichineResultatAnalyse | null;
  // valeur brute du fichier, conservée pour l'affichage / le diagnostic
  raw_resultat: string;
  parasite_identifie?: string;
  date_debut_analyse?: string;
  date_fin_analyse?: string;
  reference_labo?: string;
  commentaire?: string;
};

export function detectFormat(content: string, filename?: string): 'csv' | 'xml' {
  const name = filename?.toLowerCase() ?? '';
  if (name.endsWith('.xml')) return 'xml';
  if (name.endsWith('.csv')) return 'csv';
  return content.trimStart().startsWith('<') ? 'xml' : 'csv';
}

// Aplati un nœud XML en Record<string,string> : attributs et sous-balises texte accessibles par nom.
function flattenXmlNode(node: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (node == null || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === 'object') {
      const text = (value as Record<string, unknown>)['#text'];
      if (text != null) out[key] = String(text);
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function selectByPath(doc: unknown, path?: string): unknown {
  if (!path) return undefined;
  let current: unknown = doc;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Parse le contenu brut en lignes clé/valeur, sans mapping métier. */
export function parseLimsFile(
  content: string,
  filename: string | undefined,
  mapping: LimsMapping
): Array<Record<string, string>> {
  if (detectFormat(content, filename) === 'xml') {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', trimValues: true });
    const nodes = selectByPath(parser.parse(content), mapping.rowSelector);
    const list = Array.isArray(nodes) ? nodes : nodes != null ? [nodes] : [];
    return list.map(flattenXmlNode);
  }
  // CSV : séparateur détecté (`;` prioritaire), en-têtes en 1re ligne
  const delimiter = content.includes(';') ? ';' : ',';
  return parseCsv(content, {
    columns: true,
    delimiter,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;
}

/** Mappe une ligne brute vers les champs Zacharie via le mapping du labo. */
export function mapRow(raw: Record<string, string>, mapping: LimsMapping): MappedLimsRow {
  const get = (field: LimsCanonicalField): string => {
    const column = mapping.fields[field];
    const value = column ? raw[column] : undefined;
    return value != null ? String(value).trim() : '';
  };
  const rawResultat = get('resultat_analyse');
  return {
    reference_pool: get('reference_pool'),
    resultat_analyse: mapping.valueMap[normalizeLimsValue(rawResultat)] ?? null,
    raw_resultat: rawResultat,
    parasite_identifie: get('parasite_identifie') || undefined,
    date_debut_analyse: get('date_debut_analyse') || undefined,
    date_fin_analyse: get('date_fin_analyse') || undefined,
    reference_labo: get('reference_labo') || undefined,
    commentaire: get('commentaire') || undefined,
  };
}
