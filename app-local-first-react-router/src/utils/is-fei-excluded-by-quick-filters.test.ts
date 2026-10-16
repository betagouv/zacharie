import { describe, it, expect } from 'vitest';
import { isFeiExcludedByQuickFilters, type FeiQuickFilterMeta } from './is-fei-excluded-by-quick-filters';

const viaDeuxCollecteurs: FeiQuickFilterMeta = {
  collecteurIds: ['C1', 'C2'],
  simpleStatus: 'En cours',
  premierDetenteurName: 'Pierre Petit',
};
const sansCollecteur: FeiQuickFilterMeta = {
  collecteurIds: [],
  simpleStatus: 'Clôturée',
  premierDetenteurName: 'Marie Martin',
};
const noFilters = { collecteurIds: {}, transmissionStatuses: {}, premierDetenteurs: {} };

describe('isFeiExcludedByQuickFilters', () => {
  it('garde toutes les fiches sans filtre coché', () => {
    expect(isFeiExcludedByQuickFilters(viaDeuxCollecteurs, noFilters)).toBe(false);
    expect(isFeiExcludedByQuickFilters(sansCollecteur, noFilters)).toBe(false);
  });

  it('ignore les valeurs décochées', () => {
    const filters = { ...noFilters, premierDetenteurs: { 'Pierre Petit': undefined } };
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(false);
  });

  it('filtre collecteur : garde la fiche si un de ses collecteurs est coché, pas seulement le dernier', () => {
    const filters = { ...noFilters, collecteurIds: { C1: true } };
    expect(isFeiExcludedByQuickFilters(viaDeuxCollecteurs, filters)).toBe(false);
  });

  it('filtre collecteur : exclut les fiches sans collecteur', () => {
    const filters = { ...noFilters, collecteurIds: { C1: true } };
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(true);
  });

  it('filtre premier détenteur : exclut aussi les fiches passées par un collecteur', () => {
    const filters = { ...noFilters, premierDetenteurs: { 'Marie Martin': true } };
    expect(isFeiExcludedByQuickFilters(viaDeuxCollecteurs, filters)).toBe(true);
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(false);
  });

  it('plusieurs valeurs cochées dans un même filtre : une seule suffit', () => {
    const filters = { ...noFilters, transmissionStatuses: { 'En cours': true, Clôturée: true } };
    expect(isFeiExcludedByQuickFilters(viaDeuxCollecteurs, filters)).toBe(false);
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(false);
  });

  it('plusieurs filtres cochés : la fiche doit correspondre à tous', () => {
    const filters = {
      collecteurIds: {},
      transmissionStatuses: { 'En cours': true },
      premierDetenteurs: { 'Marie Martin': true },
    };
    expect(isFeiExcludedByQuickFilters(viaDeuxCollecteurs, filters)).toBe(true);
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(true);
  });

  it('liste collecteur : sans filtre collecteur, les fiches sans collecteur restent', () => {
    const filters = { transmissionStatuses: { Clôturée: true }, premierDetenteurs: {} };
    expect(isFeiExcludedByQuickFilters(sansCollecteur, filters)).toBe(false);
  });
});
