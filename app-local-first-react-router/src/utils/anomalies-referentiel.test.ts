import { describe, expect, it } from 'vitest';
import { isAnomalieGrave } from './anomalies-referentiel';

describe('isAnomalieGrave', () => {
  it('niveau 1 : pas grave', () => {
    expect(isAnomalieGrave('Tiques - Externe')).toBe(false);
  });

  it('niveau 2 et plus : grave', () => {
    expect(isAnomalieGrave('Abcès unique - Externe')).toBe(true);
  });

  it('sans niveau dans le référentiel : grave', () => {
    expect(isAnomalieGrave('Comportement inhabituel - Avant le tir')).toBe(true);
  });

  it('hors référentiel : grave', () => {
    expect(isAnomalieGrave('Anomalie inconnue')).toBe(true);
  });
});
