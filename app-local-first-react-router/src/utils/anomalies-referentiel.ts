import type { TreeNode } from '@app/components/ModalTreeDisplay';

export type FlatAnomalieItem = {
  // Feuille affichée sur le bouton (ex. "Unique")
  leaf: string;
  // Chaîne canonique stockée (leaf-first), ex. "Unique - Abcès ou nodules"
  canonical: string;
};

export type FlatAnomalieGroup = {
  groupLabel: string;
  items: FlatAnomalieItem[];
};

// Construit la chaîne canonique leaf-first à partir du chemin racine -> feuille.
// Ex. ["Abcès ou nodules", "Unique"] -> "Unique - Abcès ou nodules"
// Ex. ["Parasites", "Parasites externes", "Tiques"] -> "Tiques - Parasites externes - Parasites"
export function joinCanonical(pathRootToLeaf: string[]): string {
  return [...pathRootToLeaf].reverse().join(' - ');
}

// Les nœuds « champ libre » sont couverts par le champ texte libre dédié du picker.
export function isChampLibre(key: string): boolean {
  return /champ libre/i.test(key);
}

// Renvoie le nœud de l'arbre atteint en suivant le chemin de clés.
export function getNodeAtPath(tree: TreeNode | string[], keys: string[]): TreeNode | string[] {
  let node: TreeNode | string[] = tree;
  for (const key of keys) {
    if (Array.isArray(node)) return node;
    node = node[key];
  }
  return node;
}

// Un nœud est une feuille sélectionnable directe si c'est un tableau vide
// (ex. "Autres anomalies": []), sinon c'est un groupe dans lequel on descend.
export function isLeafGroup(value: TreeNode | string[]): boolean {
  return Array.isArray(value) && value.length === 0;
}

// Collecte toutes les chaînes canoniques des feuilles sous un nœud,
// en préfixant par le chemin d'ancêtres déjà parcouru.
export function collectCanonicals(node: TreeNode | string[], prefixKeys: string[] = []): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode | string[], keys: string[]) => {
    if (Array.isArray(n)) {
      const groupKey = keys[keys.length - 1] ?? '';
      if (isChampLibre(groupKey)) return;
      if (n.length === 0) {
        out.push(joinCanonical(keys));
        return;
      }
      for (const leaf of n) out.push(joinCanonical([...keys, leaf]));
      return;
    }
    for (const [key, value] of Object.entries(n)) {
      if (isChampLibre(key)) continue;
      walk(value, [...keys, key]);
    }
  };
  walk(node, prefixKeys);
  return out;
}

// Aplatit un référentiel d'anomalies (1 ou 2 niveaux) en groupes affichables.
// Chaque groupe = un en-tête + une liste de feuilles, avec leur chaîne canonique.
export function flattenReferentielTree(tree: TreeNode | string[]): FlatAnomalieGroup[] {
  const groups: FlatAnomalieGroup[] = [];

  const pushLeafIntoGroup = (groupLabel: string, item: FlatAnomalieItem) => {
    const existing = groups.find((g) => g.groupLabel === groupLabel);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ groupLabel, items: [item] });
    }
  };

  const walk = (node: TreeNode | string[], path: string[]) => {
    if (Array.isArray(node)) {
      const groupKey = path[path.length - 1] ?? '';
      if (isChampLibre(groupKey)) return;
      if (node.length === 0) {
        const parentLabel = path.slice(0, -1).join(' — ') || groupKey;
        pushLeafIntoGroup(parentLabel, { leaf: groupKey, canonical: joinCanonical(path) });
        return;
      }
      const groupLabel = path.join(' — ');
      for (const leaf of node) {
        pushLeafIntoGroup(groupLabel, { leaf, canonical: joinCanonical([...path, leaf]) });
      }
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (isChampLibre(key)) continue;
      walk(value, [...path, key]);
    }
  };

  walk(tree, []);
  return groups;
}

// Ajoute la valeur si absente, la retire si présente.
export function toggleAnomalie(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

// ---------------------------------------------------------------------------
// Nouveau référentiel examinateur (issu de referentiel_examen_initial_regroupe.csv).
// Structure plate à 2 niveaux : section (groupe + site) -> anomalies (objets).
// ---------------------------------------------------------------------------

export type AnomalieItem = {
  intitule: string;
  infobulle: string | null;
  message: string | null;
  // Noms de fichiers d'images (servies depuis /anomalies/), vide si aucune photo.
  photos: string[];
};

export type AnomalieReferentielSection = {
  groupe: string;
  site: string | null;
  anomalies: AnomalieItem[];
};

export type AnomalieReferentiel = AnomalieReferentielSection[];

// Clé stockée d'une anomalie, qualifiée par son site pour lever les ambiguïtés
// (« Abcès », « Tiques »… réapparaissent sur plusieurs sites).
// Réutilise joinCanonical : ["site", "intitulé"] -> "intitulé - site".
export function canonicalOf(intitule: string, site: string | null): string {
  return site ? joinCanonical([site, intitule]) : intitule;
}

// Résultat de recherche plat, à travers toutes les sections.
export type AnomalieSearchResult = {
  section: AnomalieReferentielSection;
  item: AnomalieItem;
  canonical: string;
};

// Recherche accent-insensible sur l'intitulé + l'infobulle.
export function searchAnomalies(ref: AnomalieReferentiel, query: string): AnomalieSearchResult[] {
  const q = normalizeText(query.trim());
  if (!q) return [];
  const results: AnomalieSearchResult[] = [];
  for (const section of ref) {
    for (const item of section.anomalies) {
      const haystack = normalizeText(`${item.intitule} ${item.infobulle ?? ''}`);
      if (haystack.includes(q)) {
        results.push({ section, item, canonical: canonicalOf(item.intitule, section.site) });
      }
    }
  }
  return results;
}

// Retrouve une anomalie (et sa section) à partir de sa clé canonique stockée,
// pour afficher l'infobulle / le message d'avertissement.
export function getAnomalieByCanonical(
  ref: AnomalieReferentiel,
  canonical: string
): AnomalieSearchResult | null {
  for (const section of ref) {
    for (const item of section.anomalies) {
      if (canonicalOf(item.intitule, section.site) === canonical) {
        return { section, item, canonical };
      }
    }
  }
  return null;
}

// Normalise pour une recherche insensible à la casse et aux accents.
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
}
