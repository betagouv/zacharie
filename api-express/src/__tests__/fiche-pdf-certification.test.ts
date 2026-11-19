import { describe, test, expect } from 'vitest';
import { hasAnomalieGrave, isAnomalieGrave } from '~/utils/anomalies-graves';
import { getCertificationExamenInitialText } from '~/templates/get-fiche-pdf';

const date = new Date('2026-11-12T10:00:00Z');
const carcasse = (anomalies_carcasse: string[] = [], anomalies_abats: string[] = []) => ({
  examinateur_anomalies_carcasse: anomalies_carcasse,
  examinateur_anomalies_abats: anomalies_abats,
});

describe('isAnomalieGrave', () => {
  test('niveau 1 : pas grave', () => {
    expect(isAnomalieGrave('Gale, teigne - Externe')).toBe(false);
  });

  test('niveau 2 et plus : grave', () => {
    expect(isAnomalieGrave('Abcès unique - Externe')).toBe(true);
    expect(isAnomalieGrave('Abcès - Système respiratoire (trachée, poumons)')).toBe(true);
  });

  test('sans niveau (petit gibier) ou hors référentiel : grave', () => {
    expect(isAnomalieGrave('Abcès')).toBe(true);
    expect(isAnomalieGrave('Anomalie inconnue du référentiel')).toBe(true);
  });
});

describe('hasAnomalieGrave', () => {
  test('regarde les anomalies carcasse et abats de toutes les carcasses', () => {
    expect(hasAnomalieGrave([carcasse(), carcasse(['Gale, teigne - Externe'])])).toBe(false);
    expect(
      hasAnomalieGrave([carcasse(), carcasse([], ['Abcès - Système respiratoire (trachée, poumons)'])])
    ).toBe(true);
  });
});

describe('getCertificationExamenInitialText', () => {
  test('sans anomalie grave : les carcasses peuvent être mises sur le marché', () => {
    expect(getCertificationExamenInitialText(date, [carcasse(), carcasse(['Gale, teigne - Externe'])])).toBe(
      'L’examinateur initial susnommé a certifié le 12 novembre 2026 que les carcasses en peau examinées peuvent être mises sur le marché (sous réserve de résultats trichine négatifs).'
    );
  });

  test('avec une anomalie grave : ne parle plus de mise sur le marché', () => {
    const text = getCertificationExamenInitialText(date, [carcasse(), carcasse(['Abcès unique - Externe'])]);
    expect(text).toBe(
      'L’examinateur initial susnommé a certifié le 12 novembre 2026 que les carcasses en peau examinées présentent au moins une anomalie, renseignée sur cette fiche.'
    );
    expect(text).not.toContain('mises sur le marché');
  });
});
