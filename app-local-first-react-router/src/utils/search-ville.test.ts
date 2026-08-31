import { describe, expect, it } from 'vitest';
import { normalizeVille, searchVilles } from './search-ville';

describe('normalizeVille', () => {
  it('met en majuscules, retire accents et séparateurs', () => {
    expect(normalizeVille("L'Abergement-Clémenciat")).toBe('L ABERGEMENT CLEMENCIAT');
  });
  it('abrège Saint et Sainte', () => {
    expect(normalizeVille('Sainte-Marie')).toBe('STE MARIE');
    expect(normalizeVille('saint andré')).toBe('ST ANDRE');
  });
  it("n'abrège pas les mots commençant par Saint", () => {
    expect(normalizeVille('Saintes')).toBe('SAINTES');
    expect(normalizeVille('Saintes-Maries-de-la-Mer')).toBe('SAINTES MARIES DE LA MER');
  });
});

describe('searchVilles', () => {
  it('trouve Sainte-Marie écrit en entier, avec ou sans tiret', () => {
    for (const search of ['32200 Sainte-Marie', '32200 Sainte Marie', '32200 Ste-Marie', '32200 STE MARIE']) {
      expect(searchVilles(search)).toContain('32200 STE MARIE');
    }
  });
  it('trouve la commune sans code postal', () => {
    expect(searchVilles('Sainte-Marie')).toContain('32200 STE MARIE');
  });
  it('remonte en tête toutes les communes portant exactement le nom recherché', () => {
    const results = searchVilles('Sainte Marie');
    const exactes = results.filter((result) => result.endsWith(' STE MARIE'));
    expect(exactes).toHaveLength(9);
    expect(results.slice(0, 9)).toEqual(exactes);
  });
  it('plafonne à 30 résultats', () => {
    expect(searchVilles('ste')).toHaveLength(30);
  });
  it('privilégie « Sainte » sur « Stenay » quand on tape « ste »', () => {
    expect(searchVilles('ste').every((result) => / STE /.test(result))).toBe(true);
  });
  it('trouve aussi les communes que le référentiel écrit « Saint » en entier', () => {
    // Le référentiel abrège presque toujours, mais pas « LE SAINT » ni « SAINT EXUPERY AEROPORT ».
    expect(searchVilles('le st')).toContain('56110 LE SAINT');
    expect(searchVilles('st exupery')).toContain('69125 SAINT EXUPERY AEROPORT - COLOMBIER SAUGNIEU');
    expect(searchVilles('terre ste')).toContain('97410 TERRE SAINTE - ST PIERRE');
  });
  it('trouve une commune déléguée par son seul nom', () => {
    expect(searchVilles('Valdoule')).toContain('05150 STE MARIE - VALDOULE');
  });
  it('filtre sur le code postal, même partiel', () => {
    expect(searchVilles('17100 Saintes')).toContain('17100 SAINTES');
    expect(searchVilles('321').every((result) => result.startsWith('321'))).toBe(true);
  });
  it('gère les accents et les apostrophes', () => {
    expect(searchVilles("L'Abergement-Clémenciat")).toContain('01400 L ABERGEMENT CLEMENCIAT');
  });
  it('ne renvoie rien pour une recherche vide', () => {
    expect(searchVilles('   ')).toEqual([]);
  });
});
