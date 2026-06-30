import { describe, test, expect } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import {
  filterTrichineRows,
  filtreLaboFTP,
  isResultatDefavorable,
  poolSansFTP,
  resultatBadgeSeverity,
  sortTrichineRows,
  statutUtilisateurFTP,
  statutUtilisateurPool,
} from '@app/utils/trichine';
import type { TrichineFTPPopulated, TrichinePoolPopulated } from '@app/services/trichine';

const makeFtpLink = (
  overrides: Partial<{ deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP }> = {}
) => ({
  TrichineFTP: {
    deleted_at: null,
    statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
    ...overrides,
  },
});

const makePool = (overrides: Record<string, unknown> = {}): TrichinePoolPopulated =>
  ({
    statut: TrichineStatutAnalyse.A_COMPLETER,
    resultat_analyse: null,
    TrichinePoolFTPs: [],
    TrichineEchantillons: [],
    PoolsFilles: [],
    ...overrides,
  }) as unknown as TrichinePoolPopulated;

const makeFtp = (overrides: Record<string, unknown> = {}): TrichineFTPPopulated =>
  ({
    statut_logistique: TrichineStatutLogistiqueFTP.BROUILLON,
    statut_analytique: TrichineStatutAnalyse.A_COMPLETER,
    TrichinePoolFTPs: [],
    ...overrides,
  }) as unknown as TrichineFTPPopulated;

describe('statutUtilisateurPool', () => {
  test('À faire tant que le pool n’est pas dans une FTP envoyée', () => {
    expect(statutUtilisateurPool(makePool())).toBe('À faire');
    expect(
      statutUtilisateurPool(
        makePool({
          TrichinePoolFTPs: [makeFtpLink({ statut_logistique: TrichineStatutLogistiqueFTP.BROUILLON })],
        })
      )
    ).toBe('À faire');
  });

  test('En cours dans une FTP envoyée', () => {
    expect(statutUtilisateurPool(makePool({ TrichinePoolFTPs: [makeFtpLink()] }))).toBe('En cours');
  });

  test('ignore les FTP supprimées', () => {
    expect(
      statutUtilisateurPool(
        makePool({ TrichinePoolFTPs: [makeFtpLink({ deleted_at: new Date('2026-06-01') })] })
      )
    ).toBe('À faire');
  });

  test('Clôturé quand les analyses sont terminées', () => {
    expect(statutUtilisateurPool(makePool({ statut: TrichineStatutAnalyse.ANALYSES_TERMINEES }))).toBe(
      'Clôturé'
    );
  });
});

describe('statutUtilisateurFTP', () => {
  test('À faire en brouillon', () => {
    expect(statutUtilisateurFTP(makeFtp())).toBe('À faire');
  });

  test('En cours une fois envoyée', () => {
    expect(statutUtilisateurFTP(makeFtp({ statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE }))).toBe(
      'En cours'
    );
  });

  test('En cours si TRAITEE mais analyses non terminées (confirmation LNR en attente)', () => {
    expect(
      statutUtilisateurFTP(
        makeFtp({
          statut_logistique: TrichineStatutLogistiqueFTP.TRAITEE,
          statut_analytique: TrichineStatutAnalyse.EN_COURS_ANALYSES,
        })
      )
    ).toBe('En cours');
  });

  test('Clôturé quand traitée et analyses terminées', () => {
    expect(
      statutUtilisateurFTP(
        makeFtp({
          statut_logistique: TrichineStatutLogistiqueFTP.TRAITEE,
          statut_analytique: TrichineStatutAnalyse.ANALYSES_TERMINEES,
        })
      )
    ).toBe('Clôturé');
  });
});

describe('poolSansFTP', () => {
  test('vrai sans aucune FTP', () => {
    expect(poolSansFTP(makePool())).toBe(true);
  });
  test('faux avec une FTP active (même brouillon)', () => {
    expect(
      poolSansFTP(
        makePool({
          TrichinePoolFTPs: [makeFtpLink({ statut_logistique: TrichineStatutLogistiqueFTP.BROUILLON })],
        })
      )
    ).toBe(false);
  });
  test('vrai si la seule FTP est supprimée', () => {
    expect(
      poolSansFTP(makePool({ TrichinePoolFTPs: [makeFtpLink({ deleted_at: new Date('2026-06-01') })] }))
    ).toBe(true);
  });
});

describe('filtreLaboFTP', () => {
  const makeLaboFtp = (
    statutLogistique: TrichineStatutLogistiqueFTP,
    resultats: Array<TrichineResultatAnalyse | null>
  ) => ({
    statut_logistique: statutLogistique,
    TrichinePoolFTPs: resultats.map((resultat) => ({ TrichinePool: { resultat_analyse: resultat } })),
  });

  test('à traiter quand aucun résultat saisi', () => {
    expect(filtreLaboFTP(makeLaboFtp(TrichineStatutLogistiqueFTP.ENVOYEE, [null, null]))).toBe('a-traiter');
    expect(filtreLaboFTP(makeLaboFtp(TrichineStatutLogistiqueFTP.RECUE, [null]))).toBe('a-traiter');
  });

  test('en cours sur saisie partielle', () => {
    expect(
      filtreLaboFTP(makeLaboFtp(TrichineStatutLogistiqueFTP.RECUE, [TrichineResultatAnalyse.NEGATIF, null]))
    ).toBe('en-cours');
  });

  test('clôturée quand TRAITEE', () => {
    expect(
      filtreLaboFTP(makeLaboFtp(TrichineStatutLogistiqueFTP.TRAITEE, [TrichineResultatAnalyse.NEGATIF]))
    ).toBe('cloturees');
  });
});

describe('filterTrichineRows', () => {
  const rows = [
    { id: '1', texte: 'E-26-000001 Bracelet-12' },
    { id: '2', texte: 'E-26-000002 Préselection' },
    { id: '3', texte: 'P-26-000045 Labo Eurofins' },
  ];
  const getText = (row: (typeof rows)[number]) => row.texte;

  test('requête vide : tout passe', () => {
    expect(filterTrichineRows(rows, '', getText)).toHaveLength(3);
    expect(filterTrichineRows(rows, '   ', getText)).toHaveLength(3);
  });
  test('insensible à la casse', () => {
    expect(filterTrichineRows(rows, 'bracelet-12', getText).map((r) => r.id)).toEqual(['1']);
  });
  test('insensible aux accents (requête et ligne)', () => {
    expect(filterTrichineRows(rows, 'preselection', getText).map((r) => r.id)).toEqual(['2']);
    expect(filterTrichineRows(rows, 'préselection', getText).map((r) => r.id)).toEqual(['2']);
  });
  test('cherche sur le texte concaténé multi-champs', () => {
    expect(filterTrichineRows(rows, 'eurofins', getText).map((r) => r.id)).toEqual(['3']);
  });
});

describe('sortTrichineRows', () => {
  const rows = [
    { ref: 'P-26-000003', date: '2026-06-03' as string | null, nb: 2 },
    { ref: 'P-26-000001', date: null as string | null, nb: 10 },
    { ref: 'P-26-000002', date: '2026-06-01' as string | null, nb: 5 },
  ];

  test('tri string ASC/DESC', () => {
    expect(sortTrichineRows(rows, 'ref', 'ASC').map((r) => r.ref)).toEqual([
      'P-26-000001',
      'P-26-000002',
      'P-26-000003',
    ]);
    expect(sortTrichineRows(rows, 'ref', 'DESC')[0].ref).toBe('P-26-000003');
  });
  test('tri date ISO string, null en dernier quel que soit l’ordre', () => {
    expect(sortTrichineRows(rows, 'date', 'ASC').map((r) => r.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
      null,
    ]);
    expect(sortTrichineRows(rows, 'date', 'DESC').map((r) => r.date)).toEqual([
      '2026-06-03',
      '2026-06-01',
      null,
    ]);
  });
  test('tri numérique', () => {
    expect(sortTrichineRows(rows, 'nb', 'ASC').map((r) => r.nb)).toEqual([2, 5, 10]);
  });
  test('ne mute pas le tableau d’origine', () => {
    const copy = [...rows];
    sortTrichineRows(rows, 'ref', 'ASC');
    expect(rows).toEqual(copy);
  });
});

describe('isResultatDefavorable / resultatBadgeSeverity', () => {
  test('les résultats LNR défavorables autorisent le retrait', () => {
    expect(isResultatDefavorable(TrichineResultatAnalyse.POSITIF)).toBe(true);
    expect(isResultatDefavorable(TrichineResultatAnalyse.NON_NEGATIF)).toBe(true);
    expect(isResultatDefavorable(TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE)).toBe(true);
  });
  test('négatif, douteux et analyse impossible ne le sont pas', () => {
    expect(isResultatDefavorable(TrichineResultatAnalyse.NEGATIF)).toBe(false);
    expect(isResultatDefavorable(TrichineResultatAnalyse.DOUTEUX)).toBe(false);
    expect(isResultatDefavorable(TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE)).toBe(false);
    expect(isResultatDefavorable(null)).toBe(false);
  });
  test('sévérités de badge cohérentes', () => {
    expect(resultatBadgeSeverity(TrichineResultatAnalyse.NEGATIF)).toBe('success');
    expect(resultatBadgeSeverity(TrichineResultatAnalyse.DOUTEUX)).toBe('warning');
    expect(resultatBadgeSeverity(TrichineResultatAnalyse.POSITIF)).toBe('error');
  });
});
