import { describe, expect, it, vi } from 'vitest';
import { toCsv } from './export-trichine';

vi.mock('@app/services/trichine-alias', () => ({ monAlias: vi.fn(), nomEntiteAlias: vi.fn() }));

describe('toCsv', () => {
  it('sépare les colonnes par « ; » et les listes par « | »', () => {
    const csv = toCsv([
      {
        reference_pool: 'P-26-LV01-1',
        numeros_ftp: ['F-1', 'F-2'],
        nombre_echantillons: 2,
        commentaire: null,
      },
    ]);
    expect(csv).toBe(
      'reference_pool;numeros_ftp;nombre_echantillons;commentaire\r\nP-26-LV01-1;F-1|F-2;2;\r\n'
    );
  });

  it('met entre guillemets une cellule contenant « ; », « " » ou un saut de ligne, pas une virgule', () => {
    const csv = toCsv([{ a: 'un; deux', b: 'dit "oui"', c: 'ligne 1\nligne 2', d: 'un, deux' }]);
    expect(csv).toBe('a;b;c;d\r\n"un; deux";"dit ""oui""";"ligne 1\nligne 2";un, deux\r\n');
  });
});
