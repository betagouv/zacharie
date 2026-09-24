import { TrichineResultatAnalyse } from '@prisma/client';

/**
 * Mapping d'un export LIMS de laboratoire vers les champs Zacharie (cf doc/trichine-import-lims.md).
 * Chaque LIMS a son propre format : on garde un registre par entité labo. Tant qu'un labo n'a
 * pas de mapping dédié, on retombe sur DEFAULT_MAPPING (le format de référence documenté).
 */

export type LimsCanonicalField =
  | 'reference_pool'
  | 'resultat_analyse'
  | 'parasite_identifie'
  | 'date_debut_analyse'
  | 'date_fin_analyse'
  | 'reference_labo'
  | 'commentaire';

export type LimsMapping = {
  // XML : chemin (séparé par des points) du nœud répété, ex. 'resultats.analyse'. Ignoré en CSV.
  rowSelector?: string;
  // Champ canonique Zacharie -> nom de colonne CSV / de balise ou d'attribut XML dans l'export.
  fields: Record<LimsCanonicalField, string>;
  // Libellé de résultat du LIMS (normalisé) -> valeur métier Zacharie.
  valueMap: Record<string, TrichineResultatAnalyse>;
};

// Normalisation appliquée avant le lookup dans valueMap : minuscule, sans accent, sans espaces autour.
export function normalizeLimsValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Mapping de référence : le fichier suit le format documenté (doc/trichine-import-lims.md §5),
 * colonnes CSV / attributs XML nommés comme les champs canoniques. Sert de fallback et de base de test.
 */
export const DEFAULT_MAPPING: LimsMapping = {
  rowSelector: 'resultats.analyse',
  fields: {
    reference_pool: 'reference_pool',
    resultat_analyse: 'resultat_analyse',
    parasite_identifie: 'parasite_identifie',
    date_debut_analyse: 'date_debut_analyse',
    date_fin_analyse: 'date_fin_analyse',
    reference_labo: 'reference_labo',
    commentaire: 'commentaire',
  },
  valueMap: {
    negatif: TrichineResultatAnalyse.NEGATIF,
    douteux: TrichineResultatAnalyse.DOUTEUX,
    analyse_impossible: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
    non_negatif: TrichineResultatAnalyse.NON_NEGATIF,
    presence_parasite_non_identifie: TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
    positif: TrichineResultatAnalyse.POSITIF,
  },
};

/**
 * Mappings dédiés par entité labo (clé = entity.id). À renseigner quand un LVD/LNR pilote
 * fournit un export réel (cf doc/trichine-import-lims.md §6). Vide pour l'instant → DEFAULT_MAPPING.
 */
export const LIMS_MAPPINGS: Record<string, LimsMapping> = {
  // 'entity-id-du-lvd-pilote': { rowSelector: '...', fields: { ... }, valueMap: { ... } },
};

export function getMappingForLab(entityIds: string[]): LimsMapping {
  for (const id of entityIds) {
    if (LIMS_MAPPINGS[id]) return LIMS_MAPPINGS[id];
  }
  return DEFAULT_MAPPING;
}
