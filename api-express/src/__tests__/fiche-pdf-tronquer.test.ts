import { describe, test, expect } from 'vitest';
import { LONGUEUR_MAX_TEXTE_FICHE_PDF, tronquer } from '~/controllers/fiche-pdf';
import { getFicheExtraitPdfBuffer } from '~/templates/get-fiche-extrait-pdf';

// Les textes du PDF sont tronqués pour borner la durée du rendu, sans couper un caractère en deux.
describe('tronquer', () => {
  test('texte court ou vide inchangé', () => {
    expect(tronquer(null)).toBeNull();
    expect(tronquer('')).toBe('');
    expect(tronquer('é'.repeat(LONGUEUR_MAX_TEXTE_FICHE_PDF))).toBe('é'.repeat(LONGUEUR_MAX_TEXTE_FICHE_PDF));
  });

  test('texte long coupé à la longueur maximale, avec « … »', () => {
    const resultat = tronquer('x'.repeat(500));
    expect(Array.from(resultat)).toHaveLength(LONGUEUR_MAX_TEXTE_FICHE_PDF);
    expect(resultat.endsWith('…')).toBe(true);
  });

  test("emoji à la limite : gardé entier ou retiré, jamais coupé — le rendu du PDF n'échoue pas", async () => {
    const numero = tronquer(`${'a'.repeat(LONGUEUR_MAX_TEXTE_FICHE_PDF - 2)}😀b${'c'.repeat(10)}`);
    expect(numero).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    const pdf = await getFicheExtraitPdfBuffer({
      numero,
      dateMiseAMort: null,
      communeMiseAMort: null,
      examinateur: null,
      premierDetenteur: null,
      intermediaires: [],
      svi: null,
      carcasses: [],
      genereLe: new Date(),
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
