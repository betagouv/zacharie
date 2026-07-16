import grosData from '@app/data/anomalies/gros.json';
import petitData from '@app/data/anomalies/petit.json';

// ---------------------------------------------------------------------------
// Référentiel examinateur (issu de referentiel_examen_initial_regroupe.csv).
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

// Résultat de recherche plat, à travers toutes les sections.
export type AnomalieSearchResult = {
  section: AnomalieReferentielSection;
  item: AnomalieItem;
  canonical: string;
};

// Référentiels examinateur, typés depuis les JSON générés du CSV.
export const grosReferentiel = grosData as AnomalieReferentiel;
export const petitReferentiel = petitData as AnomalieReferentiel;

export function getReferentiel(isPetitGibier: boolean): AnomalieReferentiel {
  return isPetitGibier ? petitReferentiel : grosReferentiel;
}

// Clé stockée d'une anomalie, qualifiée par son site pour lever les ambiguïtés
// (« Abcès », « Tiques »… réapparaissent sur plusieurs sites) : "intitulé - site".
export function canonicalOf(intitule: string, site: string | null): string {
  return site ? `${intitule} - ${site}` : intitule;
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

// Retrouve une anomalie par sa clé canonique, tous référentiels confondus
// (pratique quand on ne connaît pas le type de gibier — ex. synthèse de fiche).
export function lookupAnomalie(canonical: string): AnomalieSearchResult | null {
  return (
    getAnomalieByCanonical(grosReferentiel, canonical) ?? getAnomalieByCanonical(petitReferentiel, canonical)
  );
}

// Ajoute la valeur si absente, la retire si présente.
export function toggleAnomalie(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

// Normalise pour une recherche insensible à la casse et aux accents.
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
}
