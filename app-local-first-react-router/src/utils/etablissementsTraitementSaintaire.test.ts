import { describe, expect, it } from 'vitest';
import etablissements from '@app/data/etablissements-traitement-sanitaire.json';
import { etablissementsTree, retrieveEtablissementAgremenet } from './etablissementsTraitementSaintaire';

// Le fichier est importé dans le bundle : il ne garde que les 5 champs affichés, sous des clés
// abrégées. Ces tests verrouillent ce format, qu'une régénération depuis le référentiel complet
// pourrait faire régresser.
describe('référentiel etablissements-traitement-sanitaire.json', () => {
  it('contient tous les établissements', () => {
    expect(etablissements.data).toHaveLength(2384);
  });
  it("n'a que les clés abrégées n, r, a, c, v", () => {
    const entriesWithOtherKeys = etablissements.data.filter(
      (item) => Object.keys(item).sort().join(',') !== 'a,c,n,r,v'
    );
    expect(entriesWithOtherKeys).toEqual([]);
  });
  it('a un numéro d’agrément et une raison sociale sur chaque établissement', () => {
    const invalides = etablissements.data.filter((item) => !item.n.trim() || !item.r.trim());
    expect(invalides).toEqual([]);
  });
  it('garde la source du référentiel', () => {
    expect(etablissements.source).toMatch(/^https:\/\//);
  });
});

describe('etablissementsTree', () => {
  it('compose « agrément - raison sociale - adresse - code postal commune »', () => {
    expect(etablissementsTree).toHaveLength(2384);
    expect(etablissementsTree[0]).toBe(
      "01.034.002 - SASU BRUNO CHANINET - L'AILE OU LA CUISSE -  73 RUE DE LA REPUBLIQUE - 01300 BELLEY"
    );
  });
  it('produit un libellé unique par établissement', () => {
    // retrieveEtablissementAgremenet retrouve l'établissement par son libellé : un doublon
    // renverrait le mauvais numéro d'agrément.
    expect(new Set(etablissementsTree).size).toBe(etablissementsTree.length);
  });
});

describe('retrieveEtablissementAgremenet', () => {
  it('retrouve le numéro d’agrément depuis le libellé affiché', () => {
    expect(retrieveEtablissementAgremenet(etablissementsTree[0])).toBe('01.034.002');
  });
  it('retrouve le numéro d’agrément pour chaque libellé de la liste', () => {
    const incoherents = etablissementsTree.filter(
      (display, index) => retrieveEtablissementAgremenet(display) !== etablissements.data[index].n
    );
    expect(incoherents).toEqual([]);
  });
});
