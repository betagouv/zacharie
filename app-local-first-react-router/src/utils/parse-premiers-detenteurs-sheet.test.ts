import { describe, expect, it } from 'vitest';
import { utils } from '@e965/xlsx';
import { parsePremiersDetenteursSheet } from './parse-premiers-detenteurs-sheet';

describe('parsePremiersDetenteursSheet', () => {
  it('lit le fichier de la FDC 65 et garde la raison sociale telle quelle', () => {
    const sheet = utils.aoa_to_sheet([
      ['Raison sociale', 'Code  postal', 'Commune'],
      ['4111101 ANDREST', '65800', 'AUREILHAN'],
      ['4111102 Aouquerats - La Tyre (CASTELNAU RIVIERE BASSE)', 65700, 'CASTELNAU-RIVIERE-BASSE'],
      ['', '', ''],
    ]);
    expect(parsePremiersDetenteursSheet(sheet)).toEqual([
      { raison_sociale: '4111101 ANDREST', code_postal: '65800', ville: 'AUREILHAN' },
      {
        raison_sociale: '4111102 Aouquerats - La Tyre (CASTELNAU RIVIERE BASSE)',
        code_postal: '65700',
        ville: 'CASTELNAU-RIVIERE-BASSE',
      },
    ]);
  });

  it('ignore les lignes de notes avant les en-têtes et remet le 0 initial du code postal', () => {
    const sheet = utils.aoa_to_sheet([
      ['Export du 01/11/2026'],
      [],
      ['raison_sociale', 'code_postal', 'ville'],
      ['ACCA de Bourg', 1000, 'BOURG-EN-BRESSE'],
    ]);
    expect(parsePremiersDetenteursSheet(sheet)).toEqual([
      { raison_sociale: 'ACCA de Bourg', code_postal: '01000', ville: 'BOURG-EN-BRESSE' },
    ]);
  });

  it('renvoie une liste vide sans colonne « Raison sociale »', () => {
    const sheet = utils.aoa_to_sheet([
      ['Nom de famille', 'CP'],
      ['Dupont', '65000'],
    ]);
    expect(parsePremiersDetenteursSheet(sheet)).toEqual([]);
  });
});
