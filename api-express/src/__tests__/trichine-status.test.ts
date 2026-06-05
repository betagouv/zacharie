import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse, TrichineStatutAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import prisma from '~/prisma';
import {
  nextReferenceFromLatest,
  validatePoolComposition,
  logTrichineStatutChange,
  TrichineActionRequise,
  TrichineObjetType,
} from '~/utils/trichine';
import {
  computeCarcasseActionRequise,
  computeFtpStatutAnalytique,
  computeFtpStatutLogistique,
  computePoolStatut,
  isTerminalResult,
  recomputePoolTrichine,
} from '~/utils/trichine-status';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

/* -------------------------------------------------------------------------- */
/* Références E-{YY}-{séquence}                                                */
/* -------------------------------------------------------------------------- */

describe('nextReferenceFromLatest', () => {
  test('première référence de l’année', () => {
    expect(nextReferenceFromLatest('E', '26', null)).toBe('E-26-000001');
  });
  test('incrémente la séquence', () => {
    expect(nextReferenceFromLatest('P', '26', 'P-26-000045')).toBe('P-26-000046');
  });
  test('repart à 1 si la référence est illisible', () => {
    expect(nextReferenceFromLatest('F', '26', 'F-26-corrompue')).toBe('F-26-000001');
  });
});

/* -------------------------------------------------------------------------- */
/* Validation de composition des pools (règles §9)                             */
/* -------------------------------------------------------------------------- */

const makeEchantillon = (carcasseId: string, masse = 5, overrides: any = {}) => ({
  id: `ech-${carcasseId}-${masse}-${Math.abs(overrides.seed ?? 0)}`,
  zacharie_carcasse_id: carcasseId,
  masse_grammes: masse,
  pool_id: null,
  deleted_at: null,
  ...overrides,
});

describe('validatePoolComposition — pool initial', () => {
  test('valide avec 19 carcasses / 95 g', () => {
    const echantillons = Array.from({ length: 19 }, (_, i) => makeEchantillon(`c-${i}`, 5));
    expect(validatePoolComposition({ echantillons, parent: null })).toBeNull();
  });
  test('bloqué au-delà de 19 carcasses', () => {
    const echantillons = Array.from({ length: 20 }, (_, i) => makeEchantillon(`c-${i}`, 5));
    expect(validatePoolComposition({ echantillons, parent: null })).toMatch(/19 carcasses/);
  });
  test('bloqué au-delà de 100 g', () => {
    const echantillons = Array.from({ length: 11 }, (_, i) => makeEchantillon(`c-${i}`, 10));
    expect(validatePoolComposition({ echantillons, parent: null })).toMatch(/100 g/);
  });
  test('bloqué si échantillon déjà dans un pool', () => {
    const echantillons = [makeEchantillon('c-1', 5, { pool_id: 'pool-x' })];
    expect(validatePoolComposition({ echantillons, parent: null })).toMatch(/déjà rattaché/);
  });
  test('bloqué si deux échantillons de la même carcasse', () => {
    const echantillons = [makeEchantillon('c-1', 5, { seed: 1 }), makeEchantillon('c-1', 5, { seed: 2 })];
    expect(validatePoolComposition({ echantillons, parent: null })).toMatch(/un échantillon par carcasse/);
  });
  test('bloqué sans échantillon', () => {
    expect(validatePoolComposition({ echantillons: [], parent: null })).toMatch(/au moins un échantillon/);
  });
});

describe('validatePoolComposition — pool fille', () => {
  const parentDouteux = {
    id: 'pool-mere',
    pool_parent_id: null as string | null,
    resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
    carcasseIds: ['c-1', 'c-2', 'c-3', 'c-4', 'c-5'],
    parentHasGrandParent: false,
  };

  test('valide avec 4 carcasses du pool mère', () => {
    const echantillons = ['c-1', 'c-2', 'c-3', 'c-4'].map((id) => makeEchantillon(id, 20));
    expect(validatePoolComposition({ echantillons, parent: parentDouteux })).toBeNull();
  });
  test('bloqué au-delà de 4 carcasses du pool mère', () => {
    const echantillons = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5'].map((id) => makeEchantillon(id, 20));
    expect(validatePoolComposition({ echantillons, parent: parentDouteux })).toMatch(/4 carcasses/);
  });
  test('bloqué avec une carcasse hors pool mère', () => {
    const echantillons = [makeEchantillon('c-1', 20), makeEchantillon('c-hors-pool', 20)];
    expect(validatePoolComposition({ echantillons, parent: parentDouteux })).toMatch(/pool parent/);
  });
  test('bloqué si le pool parent n’est pas douteux', () => {
    const parent = { ...parentDouteux, resultat_analyse: TrichineResultatAnalyse.NEGATIF };
    const echantillons = [makeEchantillon('c-1', 20)];
    expect(validatePoolComposition({ echantillons, parent })).toMatch(/douteux/);
  });
});

describe('validatePoolComposition — pool petite-fille', () => {
  const parentFille = {
    id: 'pool-fille',
    pool_parent_id: 'pool-mere',
    resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
    carcasseIds: ['c-1', 'c-2'],
    parentHasGrandParent: false,
  };

  test('valide avec 1 carcasse / 50 g', () => {
    const echantillons = [makeEchantillon('c-1', 50)];
    expect(validatePoolComposition({ echantillons, parent: parentFille })).toBeNull();
  });
  test('bloqué avec 2 carcasses', () => {
    const echantillons = [makeEchantillon('c-1', 50), makeEchantillon('c-2', 50)];
    expect(validatePoolComposition({ echantillons, parent: parentFille })).toMatch(/une seule carcasse/);
  });
  test('bloqué sous 50 g', () => {
    const echantillons = [makeEchantillon('c-1', 20)];
    expect(validatePoolComposition({ echantillons, parent: parentFille })).toMatch(/50 g/);
  });
  test('bloqué au-delà de la profondeur petite-fille', () => {
    const parent = { ...parentFille, parentHasGrandParent: true };
    const echantillons = [makeEchantillon('c-1', 50)];
    expect(validatePoolComposition({ echantillons, parent })).toMatch(/hiérarchie/i);
  });
});

/* -------------------------------------------------------------------------- */
/* Statuts pool / FTP                                                          */
/* -------------------------------------------------------------------------- */

describe('isTerminalResult', () => {
  test('DOUTEUX n’est pas terminal (confirmation LNR obligatoire)', () => {
    expect(isTerminalResult(TrichineResultatAnalyse.DOUTEUX)).toBe(false);
  });
  test('NEGATIF, ANALYSE_IMPOSSIBLE et résultats LNR sont terminaux', () => {
    expect(isTerminalResult(TrichineResultatAnalyse.NEGATIF)).toBe(true);
    expect(isTerminalResult(TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE)).toBe(true);
    expect(isTerminalResult(TrichineResultatAnalyse.POSITIF)).toBe(true);
    expect(isTerminalResult(TrichineResultatAnalyse.NON_NEGATIF)).toBe(true);
    expect(isTerminalResult(TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE)).toBe(true);
    expect(isTerminalResult(null)).toBe(false);
  });
});

describe('computePoolStatut', () => {
  test('A_COMPLETER tant que le pool n’est pas expédié', () => {
    expect(computePoolStatut({ resultatAnalyse: null, hasChildEnCours: false, isInSentFtp: false })).toBe(
      TrichineStatutAnalyse.A_COMPLETER
    );
  });
  test('EN_COURS_ANALYSES une fois dans une FTP envoyée', () => {
    expect(computePoolStatut({ resultatAnalyse: null, hasChildEnCours: false, isInSentFtp: true })).toBe(
      TrichineStatutAnalyse.EN_COURS_ANALYSES
    );
  });
  test('EN_COURS_ANALYSES sur résultat douteux (attente LNR)', () => {
    expect(
      computePoolStatut({
        resultatAnalyse: TrichineResultatAnalyse.DOUTEUX,
        hasChildEnCours: false,
        isInSentFtp: true,
      })
    ).toBe(TrichineStatutAnalyse.EN_COURS_ANALYSES);
  });
  test('ANALYSES_TERMINEES sur résultat terminal', () => {
    expect(
      computePoolStatut({
        resultatAnalyse: TrichineResultatAnalyse.NEGATIF,
        hasChildEnCours: false,
        isInSentFtp: true,
      })
    ).toBe(TrichineStatutAnalyse.ANALYSES_TERMINEES);
  });
  test('règle pool mère : pas ANALYSES_TERMINEES tant qu’une fille est EN_COURS', () => {
    expect(
      computePoolStatut({
        resultatAnalyse: TrichineResultatAnalyse.POSITIF,
        hasChildEnCours: true,
        isInSentFtp: true,
      })
    ).toBe(TrichineStatutAnalyse.EN_COURS_ANALYSES);
  });
});

describe('computeFtpStatuts', () => {
  test('analytique TERMINEES quand tous les pools ont un résultat terminal', () => {
    expect(
      computeFtpStatutAnalytique({
        poolResults: [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE],
        statutLogistique: TrichineStatutLogistiqueFTP.RECUE,
      })
    ).toBe(TrichineStatutAnalyse.ANALYSES_TERMINEES);
  });
  test('analytique EN_COURS si un pool est douteux', () => {
    expect(
      computeFtpStatutAnalytique({
        poolResults: [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.DOUTEUX],
        statutLogistique: TrichineStatutLogistiqueFTP.RECUE,
      })
    ).toBe(TrichineStatutAnalyse.EN_COURS_ANALYSES);
  });
  test('logistique auto-TRAITEE quand reçue et tous les résultats saisis', () => {
    expect(
      computeFtpStatutLogistique({
        current: TrichineStatutLogistiqueFTP.RECUE,
        poolResults: [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.DOUTEUX],
      })
    ).toBe(TrichineStatutLogistiqueFTP.TRAITEE);
  });
  test('logistique inchangée tant qu’un résultat manque', () => {
    expect(
      computeFtpStatutLogistique({
        current: TrichineStatutLogistiqueFTP.RECUE,
        poolResults: [TrichineResultatAnalyse.NEGATIF, null],
      })
    ).toBe(TrichineStatutLogistiqueFTP.RECUE);
  });
});

/* -------------------------------------------------------------------------- */
/* Action requise carcasse                                                     */
/* -------------------------------------------------------------------------- */

const makePoolView = (overrides: any = {}) => ({
  id: 'pool-1',
  pool_parent_id: null,
  statut: TrichineStatutAnalyse.A_COMPLETER,
  resultat_analyse: null,
  created_at: new Date('2026-06-01T10:00:00Z'),
  ...overrides,
});

describe('computeCarcasseActionRequise', () => {
  test('null sans échantillon', () => {
    expect(computeCarcasseActionRequise([], false)).toBeNull();
  });
  test('null avec échantillon pas encore poolé', () => {
    expect(computeCarcasseActionRequise([], true)).toBeNull();
  });
  test('ANALYSE_EN_COURS_LVD quand le pool est au labo', () => {
    const pools = [makePoolView({ statut: TrichineStatutAnalyse.EN_COURS_ANALYSES })];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.ANALYSE_EN_COURS_LVD);
  });
  test('AUCUNE sur résultat négatif', () => {
    const pools = [
      makePoolView({
        statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
        resultat_analyse: TrichineResultatAnalyse.NEGATIF,
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.AUCUNE);
  });
  test('PRELEVEMENT_COMPLEMENTAIRE sur analyse impossible', () => {
    const pools = [
      makePoolView({
        statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
        resultat_analyse: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE,
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.PRELEVEMENT_COMPLEMENTAIRE);
  });
  test('PRELEVEMENT_COMPLEMENTAIRE sur douteux sans 2e intention', () => {
    const pools = [
      makePoolView({
        statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
        resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.PRELEVEMENT_COMPLEMENTAIRE);
  });
  test('ANALYSE_EN_COURS_LVD quand la 2e intention est au labo', () => {
    const pools = [
      makePoolView({
        id: 'pool-mere',
        statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
        resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
      }),
      makePoolView({
        id: 'pool-fille',
        pool_parent_id: 'pool-mere',
        statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
        created_at: new Date('2026-06-02T10:00:00Z'),
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.ANALYSE_EN_COURS_LVD);
  });
  test('CONFIRMATION_EN_COURS_LNR quand la 2e intention est terminée mais le douteux pas confirmé', () => {
    const pools = [
      makePoolView({
        id: 'pool-mere',
        statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
        resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
      }),
      makePoolView({
        id: 'pool-fille',
        pool_parent_id: 'pool-mere',
        statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
        resultat_analyse: TrichineResultatAnalyse.NEGATIF,
        created_at: new Date('2026-06-02T10:00:00Z'),
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.CONFIRMATION_EN_COURS_LNR);
  });
  test('AUCUNE sur résultat LNR positif (le retrait est décidé depuis le résultat)', () => {
    const pools = [
      makePoolView({
        statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
        resultat_analyse: TrichineResultatAnalyse.POSITIF,
      }),
    ];
    expect(computeCarcasseActionRequise(pools, true)).toBe(TrichineActionRequise.AUCUNE);
  });
});

/* -------------------------------------------------------------------------- */
/* Historique                                                                  */
/* -------------------------------------------------------------------------- */

describe('logTrichineStatutChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('no-op quand le statut ne change pas', async () => {
    await logTrichineStatutChange({
      objetType: TrichineObjetType.POOL,
      objetId: 'pool-1',
      ancienStatut: 'A_COMPLETER',
      nouveauStatut: 'A_COMPLETER',
      userId: 'user-1',
    });
    expect(prisma.trichineHistoriqueStatut.create).not.toHaveBeenCalled();
  });

  test('trace le changement avec ancien statut vide à la création', async () => {
    await logTrichineStatutChange({
      objetType: TrichineObjetType.ECHANTILLON,
      objetId: 'ech-1',
      ancienStatut: null,
      nouveauStatut: 'A_COMPLETER',
      userId: 'user-1',
    });
    expect(prisma.trichineHistoriqueStatut.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        objet_type: 'ECHANTILLON',
        objet_id: 'ech-1',
        ancien_statut: '',
        nouveau_statut: 'A_COMPLETER',
        modifie_par_user_id: 'user-1',
      }),
    });
  });
});

/* -------------------------------------------------------------------------- */
/* recomputePoolTrichine (wrapper)                                             */
/* -------------------------------------------------------------------------- */

describe('recomputePoolTrichine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('pool mère douteux avec fille en cours reste EN_COURS_ANALYSES (pas d’update)', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValueOnce({
      id: 'pool-mere',
      deleted_at: null,
      pool_parent_id: null,
      statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
      resultat_analyse: TrichineResultatAnalyse.DOUTEUX,
      PoolsFilles: [{ id: 'pool-fille', statut: TrichineStatutAnalyse.EN_COURS_ANALYSES, PoolsFilles: [] }],
      TrichinePoolFTPs: [
        {
          TrichineFTP: { deleted_at: null, statut_logistique: TrichineStatutLogistiqueFTP.RECUE },
        },
      ],
      TrichineEchantillons: [],
    } as any);

    await recomputePoolTrichine('pool-mere', 'user-1');

    expect(prisma.trichinePool.update).not.toHaveBeenCalled();
    expect(prisma.trichineHistoriqueStatut.create).not.toHaveBeenCalled();
  });

  test('passe le pool en ANALYSES_TERMINEES sur résultat négatif et trace l’historique', async () => {
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValueOnce({
      id: 'pool-1',
      deleted_at: null,
      pool_parent_id: null,
      statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
      resultat_analyse: TrichineResultatAnalyse.NEGATIF,
      PoolsFilles: [],
      TrichinePoolFTPs: [
        {
          TrichineFTP: { deleted_at: null, statut_logistique: TrichineStatutLogistiqueFTP.RECUE },
        },
      ],
      TrichineEchantillons: [],
    } as any);

    await recomputePoolTrichine('pool-1', 'user-1');

    expect(prisma.trichinePool.update).toHaveBeenCalledWith({
      where: { id: 'pool-1' },
      data: { statut: TrichineStatutAnalyse.ANALYSES_TERMINEES },
    });
    expect(prisma.trichineHistoriqueStatut.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        objet_type: 'POOL',
        objet_id: 'pool-1',
        nouveau_statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
      }),
    });
  });
});
