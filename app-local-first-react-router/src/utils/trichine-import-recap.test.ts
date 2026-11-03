import { describe, expect, it } from 'vitest';
import type { LimsResultRow } from '@api/src/types/responses';
import { computeImportRecap } from './trichine-import-recap';

function row(partial: Partial<LimsResultRow>): LimsResultRow {
  return {
    reference_pool: partial.reference_pool_zacharie ?? 'P-1',
    resultat_analyse: 'NEGATIF',
    raw_resultat: 'negatif',
    status: 'matched',
    effet: 'liberees',
    nb_carcasses: 2,
    ...partial,
  };
}

describe('computeImportRecap', () => {
  const ftp = { numero_fiche: 'F-1', recue: true, pools_sans_resultat: ['P-1', 'P-2'] };

  it('compte les carcasses par effet et les confirmations LNR', () => {
    const recap = computeImportRecap([
      row({ reference_pool_zacharie: 'P-1', ftp }),
      row({ reference_pool_zacharie: 'P-2', ftp, effet: 'en_attente_confirmation', nb_carcasses: 3 }),
    ]);
    expect(recap.pools).toBe(2);
    expect(recap.carcasses.liberees).toBe(2);
    expect(recap.carcasses.en_attente_confirmation).toBe(3);
    expect(recap.confirmationsLnr).toBe(1);
  });

  it('clôture une fiche reçue quand tous ses pools sans résultat sont importés', () => {
    const recap = computeImportRecap([
      row({ reference_pool_zacharie: 'P-1', ftp }),
      row({ reference_pool_zacharie: 'P-2', ftp }),
    ]);
    expect(recap.ftpsCloturees).toEqual(['F-1']);
  });

  it('ne clôture pas une fiche dont un pool reste sans résultat', () => {
    expect(computeImportRecap([row({ reference_pool_zacharie: 'P-1', ftp })]).ftpsCloturees).toEqual([]);
  });

  it('ne clôture pas une fiche non réceptionnée', () => {
    const nonRecue = { ...ftp, recue: false, pools_sans_resultat: ['P-1'] };
    expect(
      computeImportRecap([row({ reference_pool_zacharie: 'P-1', ftp: nonRecue })]).ftpsCloturees
    ).toEqual([]);
  });
});
