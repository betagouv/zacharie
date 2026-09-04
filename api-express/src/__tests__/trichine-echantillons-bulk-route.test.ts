import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineResultatAnalyse, TrichineSitePrelevement, TrichineType, UserRoles } from '@prisma/client';
import trichineRouter from '~/controllers/trichine';
import prisma from '~/prisma';

// POST /trichine/echantillons — prélèvement en lot (assistant SVI).
// Contrat épinglé ici :
//  - tout ou rien : une seule carcasse invalide fait échouer le lot entier, sans rien créer ;
//  - le SVI ne prélève que sur les carcasses de son périmètre (assignées à son service, ou
//    déjà arrivées chez un ETG rattaché et pas encore transmises) ;
//  - les références sont consécutives et calculées en une lecture, pas une par échantillon.

vi.mock('~/utils/trichine-status', () => ({
  recomputeCarcasseTrichine: vi.fn().mockResolvedValue(undefined),
  recomputeFTPTrichine: vi.fn().mockResolvedValue(undefined),
  recomputePoolTrichine: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(express.json());
app.use('/trichine', trichineRouter);

const sviUser = { id: 'user-svi', roles: [UserRoles.SVI], activated: true, isZacharieAdmin: false };

const makeCarcasse = (id: string, overrides: Record<string, unknown> = {}) => ({
  zacharie_carcasse_id: id,
  numero_bracelet: `BR-${id}`,
  espece: 'Sanglier',
  deleted_at: null as Date | null,
  trichine_retire_de_fei_at: null as Date | null,
  svi_entity_id: 'entity-svi',
  premier_detenteur_user_id: 'user-pd',
  ...overrides,
});

// prisma.carcasse.findMany est appelé deux fois par la route : la lecture des carcasses du lot,
// puis le calcul du périmètre SVI (carcasses accessibles parmi les ids demandés).
const mockCarcasses = (
  carcasses: Array<ReturnType<typeof makeCarcasse>>,
  accessibleIds: Array<string> = carcasses.map((carcasse) => carcasse.zacharie_carcasse_id)
) => {
  vi.mocked(prisma.carcasse.findMany)
    .mockResolvedValueOnce(carcasses as never)
    .mockResolvedValueOnce(accessibleIds.map((id) => ({ zacharie_carcasse_id: id })) as never);
};

// La route relit les analyses déjà ouvertes sur chaque carcasse : un complémentaire exige un
// pool douteux, un initial exige qu'aucune analyse ne soit en cours.
const mockAnalyses = (
  pools: Array<{ zacharie_carcasse_id: string; resultat_analyse: TrichineResultatAnalyse | null }>
) => {
  vi.mocked(prisma.trichineEchantillon.findMany).mockResolvedValueOnce(
    pools.map((pool) => ({
      zacharie_carcasse_id: pool.zacharie_carcasse_id,
      pool_id: `pool-${pool.zacharie_carcasse_id}`,
      TrichinePool: {
        resultat_analyse: pool.resultat_analyse,
        created_at: new Date('2026-01-01'),
        deleted_at: null,
      },
    })) as never
  );
};

const body = (ids: Array<string>) => ({
  echantillons: ids.map((id) => ({
    zacharie_carcasse_id: id,
    site_prelevement: TrichineSitePrelevement.PILIER_DIAPHRAGME,
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-svi' } as never]);
  vi.mocked(prisma.trichineEchantillon.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.trichineHistoriqueStatut.create).mockResolvedValue({} as never);
  (prisma as unknown as { $transaction: unknown }).$transaction = vi.fn(async (operations: unknown) =>
    Array.isArray(operations) ? Promise.all(operations) : operations
  );
  vi.mocked(prisma.trichineEchantillon.create).mockImplementation((async ({ data }: never) => ({
    id: `ech-${(data as { reference_echantillon: string }).reference_echantillon}`,
    statut: 'A_COMPLETER',
    ...(data as object),
  })) as never);
});

describe('POST /trichine/echantillons', () => {
  test('non authentifié → 401', async () => {
    const res = await request(app)
      .post('/trichine/echantillons')
      .send(body(['c1']));
    expect(res.status).toBe(401);
  });

  test('lot valide → références consécutives, une seule lecture de séquence', async () => {
    mockCarcasses([makeCarcasse('c1'), makeCarcasse('c2'), makeCarcasse('c3')]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1', 'c2', 'c3']));

    expect(res.status).toBe(200);
    // références consécutives (l'année courante préfixe la séquence)
    const references = res.body.data.echantillons.map(
      (echantillon: { reference_echantillon: string }) => echantillon.reference_echantillon
    );
    expect(references).toHaveLength(3);
    const sequences = references.map((reference: string) => Number(reference.split('-')[2]));
    expect(sequences).toEqual([sequences[0], sequences[0] + 1, sequences[0] + 2]);
    // une lecture pour toute la séquence, pas une par échantillon
    expect(prisma.trichineEchantillon.findFirst).toHaveBeenCalledTimes(1);
  });

  test('carcasse hors périmètre du service → 403, rien créé', async () => {
    mockCarcasses([makeCarcasse('c1'), makeCarcasse('c2', { svi_entity_id: 'autre-entity' })], ['c1']);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1', 'c2']));

    expect(res.status).toBe(403);
    expect(prisma.trichineEchantillon.create).not.toHaveBeenCalled();
  });

  // Le SVI prélève à l'arrivage : une carcasse déjà chez un ETG rattaché mais pas encore
  // transmise (svi_entity_id nul) fait partie de son périmètre.
  test('carcasse arrivée chez un ETG rattaché mais non transmise → prélèvement accepté', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([
      { id: 'entity-etg', nom_d_usage: 'ETG du coin', raison_sociale: null },
    ] as never);
    mockCarcasses([makeCarcasse('c1', { svi_entity_id: null })], ['c1']);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1']));

    expect(res.status).toBe(200);
    // le périmètre interrogé couvre les deux cas : assignée au service, ou à venir chez l'ETG
    const perimetre = vi.mocked(prisma.carcasse.findMany).mock.calls[1][0]!.where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(perimetre.OR[0]).toEqual({ svi_entity_id: { in: ['entity-svi'] } });
    expect(perimetre.OR[1]).toMatchObject({
      svi_assigned_at: null,
      current_owner_entity_id: { in: ['entity-etg'] },
    });
  });

  test('espèce non concernée → 400, rien créé', async () => {
    mockCarcasses([makeCarcasse('c1'), makeCarcasse('c2', { espece: 'Chevreuil' })]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1', 'c2']));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/n'est pas un sanglier/);
    expect(prisma.trichineEchantillon.create).not.toHaveBeenCalled();
  });

  test('carcasse retirée de sa fiche → 400', async () => {
    mockCarcasses([makeCarcasse('c1', { trichine_retire_de_fei_at: new Date() })]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1']));

    expect(res.status).toBe(400);
    expect(prisma.trichineEchantillon.create).not.toHaveBeenCalled();
  });

  // 2e intention : le lot porte un type et sa masse réglementaire par défaut
  test('type COMPLEMENTAIRE → masse par défaut de 20 g', async () => {
    mockCarcasses([makeCarcasse('c1')]);
    mockAnalyses([{ zacharie_carcasse_id: 'c1', resultat_analyse: TrichineResultatAnalyse.DOUTEUX }]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send({ ...body(['c1']), type: TrichineType.COMPLEMENTAIRE });

    expect(res.status).toBe(200);
    expect(res.body.data.echantillons[0]).toMatchObject({
      type: TrichineType.COMPLEMENTAIRE,
      masse_grammes: 20,
    });
  });

  // Un prélèvement n'ouvre une analyse que s'il y a une analyse à ouvrir
  test('complémentaire sans pool douteux → 400, rien créé', async () => {
    mockCarcasses([makeCarcasse('c1')]);
    mockAnalyses([{ zacharie_carcasse_id: 'c1', resultat_analyse: TrichineResultatAnalyse.NEGATIF }]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send({ ...body(['c1']), type: TrichineType.COMPLEMENTAIRE });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pool douteux/);
    expect(prisma.trichineEchantillon.create).not.toHaveBeenCalled();
  });

  test('prélèvement initial sur une carcasse déjà en cours d’analyse → 400', async () => {
    mockCarcasses([makeCarcasse('c1')]);
    mockAnalyses([{ zacharie_carcasse_id: 'c1', resultat_analyse: null }]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1']));

    expect(res.status).toBe(400);
    expect(prisma.trichineEchantillon.create).not.toHaveBeenCalled();
  });

  // Analyse impossible = analyse inexistante : le SVI doit pouvoir reprélever
  test('prélèvement initial après une analyse impossible → accepté', async () => {
    mockCarcasses([makeCarcasse('c1')]);
    mockAnalyses([
      { zacharie_carcasse_id: 'c1', resultat_analyse: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE },
    ]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1']));

    expect(res.status).toBe(200);
  });

  test('type CONFIRMATION → masse par défaut de 50 g', async () => {
    mockCarcasses([makeCarcasse('c1')]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send({ ...body(['c1']), type: TrichineType.CONFIRMATION });

    expect(res.status).toBe(200);
    expect(res.body.data.echantillons[0].masse_grammes).toBe(50);
  });

  test('sans type → INITIAL à 5 g', async () => {
    mockCarcasses([makeCarcasse('c1')]);

    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1']));

    expect(res.status).toBe(200);
    expect(res.body.data.echantillons[0]).toMatchObject({
      type: TrichineType.INITIAL,
      masse_grammes: 5,
    });
  });

  test('même carcasse deux fois dans le lot → 400', async () => {
    const res = await request(app)
      .post('/trichine/echantillons')
      .set('x-test-user', JSON.stringify(sviUser))
      .send(body(['c1', 'c1']));

    expect(res.status).toBe(400);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});
