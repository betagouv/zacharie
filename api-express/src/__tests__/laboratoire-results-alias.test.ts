import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  TrichineResultatAnalyse,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  UserRoles,
} from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { applyPoolResult } from '~/utils/trichine-result';

// POST /laboratoire/results/preview — l'export LIMS peut citer le pool par sa référence Zacharie
// ou par l'alias que le laboratoire lui a donné.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/utils/trichine-result', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/trichine-result')>()),
  applyPoolResult: vi.fn().mockResolvedValue({ kind: 'ok', pool: null, ftpConfirmation: null }),
}));

const app = express();
app.use(express.json());
app.use('/laboratoire', laboratoireRouter);

const laboUser = { id: 'user-labo', roles: [UserRoles.LABORATOIRE], activated: true, isZacharieAdmin: false };

const poolRecu = {
  id: 'pool-1',
  reference_pool: 'P-26-SVI01-0045',
  resultat_analyse: null as TrichineResultatAnalyse | null,
  statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
  deleted_at: null as Date | null,
  TrichineEchantillons: [] as Array<never>,
  Aliases: [{ reference: 'LIMS-0087' }],
  TrichinePoolFTPs: [
    {
      TrichineFTP: {
        deleted_at: null as Date | null,
        statut_logistique: TrichineStatutLogistiqueFTP.RECUE,
        destinataire_entity_id: 'labo-1',
        DestinataireEntity: { id: 'labo-1', is_lnr: false },
      },
    },
  ],
};

const preview = (csv: string) =>
  request(app)
    .post('/laboratoire/results/preview')
    .set('x-test-user', JSON.stringify(laboUser))
    .send({ filename: 'export.csv', content: Buffer.from(csv).toString('base64') });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { EntityRelatedWithUser: { id: 'labo-1', is_lnr: false } },
  ] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([poolRecu] as never);
});

describe('POST /laboratoire/results/preview', () => {
  test('rapproche une ligne citant l’alias du laboratoire', async () => {
    const response = await preview('reference_pool,resultat_analyse\nLIMS-0087,negatif\n');

    expect(response.status).toBe(200);
    expect(response.body.data.rows[0]).toMatchObject({ reference_pool: 'LIMS-0087', status: 'matched' });
    // L'alias n'est cherché que parmi ceux des laboratoires de l'utilisateur, casse ignorée
    const where = vi.mocked(prisma.trichinePool.findMany).mock.calls[0][0]!.where as any;
    expect(where.OR[1]).toEqual({
      Aliases: {
        some: {
          entity_id: { in: ['labo-1'] },
          OR: [{ reference: { equals: 'LIMS-0087', mode: 'insensitive' } }],
        },
      },
    });
  });

  test('rapproche un alias écrit dans une autre casse', async () => {
    const response = await preview('reference_pool,resultat_analyse\nlims-0087,negatif\n');

    expect(response.body.data.rows[0]).toMatchObject({ status: 'matched' });
  });

  test('un alias porté par deux pools ne rapproche rien', async () => {
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([
      poolRecu,
      { ...poolRecu, id: 'pool-2', reference_pool: 'P-26-SVI01-0046' },
    ] as never);

    const response = await preview('reference_pool,resultat_analyse\nLIMS-0087,negatif\n');

    expect(response.body.data.rows[0]).toMatchObject({ status: 'unmatched' });
  });

  test('rapproche toujours une ligne citant la référence Zacharie', async () => {
    const response = await preview('reference_pool,resultat_analyse\nP-26-SVI01-0045,negatif\n');

    expect(response.body.data.rows[0]).toMatchObject({ status: 'matched' });
  });

  test('une référence inconnue reste non rapprochée', async () => {
    const response = await preview('reference_pool,resultat_analyse\nINCONNUE,negatif\n');

    expect(response.body.data.rows[0]).toMatchObject({ status: 'unmatched' });
  });
});

describe('POST /laboratoire/results/import', () => {
  const importer = (rows: Array<object>) =>
    request(app)
      .post('/laboratoire/results/import')
      .set('x-test-user', JSON.stringify(laboUser))
      .send({ rows });

  test('la référence Zacharie prime sur un alias identique posé sur un autre pool', async () => {
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([
      // Alias saisi par erreur avec la référence Zacharie de pool-1
      {
        ...poolRecu,
        id: 'pool-2',
        reference_pool: 'P-26-SVI01-0046',
        Aliases: [{ reference: 'P-26-SVI01-0045' }],
      },
      poolRecu,
    ] as never);

    await importer([{ reference_pool: 'P-26-SVI01-0045', resultat_analyse: 'NEGATIF' }]);

    expect(applyPoolResult).toHaveBeenCalledWith(
      expect.objectContaining({ pool: expect.objectContaining({ id: 'pool-1' }), origine: 'automatique' })
    );
  });
});
