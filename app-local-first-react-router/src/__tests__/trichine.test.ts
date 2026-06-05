import { describe, test, expect } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import {
  filtreLaboFTP,
  isResultatDefavorable,
  poolSansFTP,
  resultatBadgeSeverity,
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
