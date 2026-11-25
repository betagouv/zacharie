import grosData from '@app/data/anomalies/gros.json';
import petitData from '@app/data/anomalies/petit.json';

export type AnomalieItem = {
  intitule: string;
  infobulle: string | null;
  message: string | null;
  alert_level: number | null;
  photos: string[];
};

export type AnomalieReferentielSection = {
  groupe: string;
  site: string | null;
  anomalies: AnomalieItem[];
  champ_libre: string | null;
};

export type AnomalieReferentiel = AnomalieReferentielSection[];

export type AnomalieSearchResult = {
  section: AnomalieReferentielSection;
  item: AnomalieItem;
  canonical: string;
};

export const grosReferentiel = grosData as AnomalieReferentiel;
export const petitReferentiel = petitData as AnomalieReferentiel;

export function getReferentiel(isPetitGibier: boolean): AnomalieReferentiel {
  return isPetitGibier ? petitReferentiel : grosReferentiel;
}

export function canonicalOf(intitule: string, site: string | null): string {
  return site ? `${intitule} - ${site}` : intitule;
}

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

export function lookupAnomalie(canonical: string): AnomalieSearchResult | null {
  return (
    getAnomalieByCanonical(grosReferentiel, canonical) ?? getAnomalieByCanonical(petitReferentiel, canonical)
  );
}

export function toggleAnomalie(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();
}

export function isAnomalieGrave(canonical: string): boolean {
  const alertLevel = lookupAnomalie(canonical)?.item.alert_level ?? null;
  return alertLevel === null || alertLevel >= 2;
}
