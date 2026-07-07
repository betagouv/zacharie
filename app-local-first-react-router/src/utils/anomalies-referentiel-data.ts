import grosData from '@app/data/anomalies/gros.json';
import petitData from '@app/data/anomalies/petit.json';
import {
  getAnomalieByCanonical,
  type AnomalieReferentiel,
  type AnomalieSearchResult,
} from '@app/utils/anomalies-referentiel';

// Référentiels examinateur, typés depuis les JSON générés du CSV.
export const grosReferentiel = grosData as AnomalieReferentiel;
export const petitReferentiel = petitData as AnomalieReferentiel;

export function getReferentiel(isPetitGibier: boolean): AnomalieReferentiel {
  return isPetitGibier ? petitReferentiel : grosReferentiel;
}

// Retrouve une anomalie par sa clé canonique, tous référentiels confondus
// (pratique quand on ne connaît pas le type de gibier — ex. synthèse de fiche).
export function lookupAnomalie(canonical: string): AnomalieSearchResult | null {
  return (
    getAnomalieByCanonical(grosReferentiel, canonical) ?? getAnomalieByCanonical(petitReferentiel, canonical)
  );
}
