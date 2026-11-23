import { describe, expect, it } from 'vitest';
import { searchDestinataires } from './search-destinataire';

const options = [
  {
    value: 'guellier',
    label: 'Guellier - 03 123 456 - 03000 MOULINS (Établissement de Traitement du Gibier)',
  },
  { value: 'gueret', label: 'Boucherie Guéret - 23000 GUERET (Commerce de détail)' },
  { value: 'lebon', label: 'Le Bon Gibier - 03200 VICHY (Collecteur Professionnel)' },
  { value: 'domestique', label: 'Usage domestique' },
  { value: 'etg1', label: 'ETG 1 - 75000 Paris (Établissement de Traitement du Gibier)' },
  { value: 'etg2', label: 'ETG 2 - 75010 Paris (Établissement de Traitement du Gibier)' },
];

function search(query: string) {
  return searchDestinataires(options, query);
}

function values(query: string) {
  return search(query).map((result) => result.option.value);
}

describe('searchDestinataires', () => {
  it('ne renvoie rien pour une recherche vide', () => {
    expect(search('  ')).toEqual([]);
  });

  it('trouve le nom exact, sans tenir compte des majuscules et des accents', () => {
    for (const query of ['guellier', 'Guellier', 'GUÉLLIER']) {
      expect(search(query)).toEqual([{ option: options[0], isFuzzy: false }]);
    }
  });

  it('trouve le début du nom', () => {
    expect(values('guel')).toEqual(['guellier']);
  });

  it('ignore les petits mots comme « le »', () => {
    expect(search('le guellier')).toEqual([{ option: options[0], isFuzzy: false }]);
  });

  it('cherche les petits mots quand la recherche ne contient que ça', () => {
    expect(values('le')).toContain('lebon');
  });

  it('trouve le nom malgré une faute de frappe', () => {
    for (const query of ['guelier', 'gueller', 'guelleir', 'le guelier']) {
      expect(search(query)).toEqual([{ option: options[0], isFuzzy: true }]);
    }
  });

  it('ne tolère pas de faute sur un mot de moins de 5 lettres', () => {
    expect(values('bom')).toEqual([]);
    expect(values('guel')).toEqual(['guellier']);
  });

  it('exige que chaque mot corresponde', () => {
    expect(values('guellier vichy')).toEqual([]);
    expect(values('gibier vichy')).toEqual(['lebon']);
  });

  it('classe les correspondances exactes avant les fautes de frappe', () => {
    const exact = searchDestinataires(
      [
        { value: 'faute', label: 'Dupond SARL' },
        { value: 'exact', label: 'Dupont SARL' },
      ],
      'dupont'
    );
    expect(exact).toEqual([
      { option: { value: 'exact', label: 'Dupont SARL' }, isFuzzy: false },
      { option: { value: 'faute', label: 'Dupond SARL' }, isFuzzy: true },
    ]);
  });

  it("garde les nombres courts et ne les cherche qu'en début de mot", () => {
    expect(values('etg 1')).toEqual(['etg1']);
    expect(values('etg 2')).toEqual(['etg2']);
  });

  it('trouve le code postal', () => {
    expect(values('03200')).toEqual(['lebon']);
  });

  it('ne trouve rien pour un nom inconnu', () => {
    expect(values('xyz')).toEqual([]);
    expect(values('dupont')).toEqual([]);
  });
});
