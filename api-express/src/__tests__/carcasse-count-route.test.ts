import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// GET /carcasse/count — nombre de carcasses non supprimées du périmètre de synchro de l'utilisateur.
// Le périmètre est celui du pull delta GET /carcasse (getCarcasseAccessWhere), sans filtre updated_at.

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

const ENTITY_IDS = ['entity-1', 'entity-2'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { entity_id: 'entity-1' } as any,
    { entity_id: 'entity-2' } as any,
  ]);
});

describe('GET /carcasse/count', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).get('/carcasse/count');
    expect(res.status).toBe(401);
  });

  test('non-activated user → 400, no count', async () => {
    const res = await request(app)
      .get('/carcasse/count')
      .set('x-test-user', JSON.stringify({ ...etgUser, activated: false }));
    expect(res.status).toBe(400);
    expect(prisma.carcasse.count).not.toHaveBeenCalled();
  });

  test('unknown role → 403, no count', async () => {
    const res = await request(app)
      .get('/carcasse/count')
      .set('x-test-user', JSON.stringify({ ...etgUser, roles: [] }));
    expect(res.status).toBe(403);
    expect(prisma.carcasse.count).not.toHaveBeenCalled();
  });

  test('compte les carcasses non supprimées du périmètre du pull delta, refusées comprises', async () => {
    vi.mocked(prisma.carcasse.count).mockResolvedValueOnce(42);

    const res = await request(app).get('/carcasse/count').set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(42);
    expect(prisma.carcasse.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { CarcasseIntermediaire: { some: { intermediaire_entity_id: { in: ENTITY_IDS } } } },
          { next_owner_entity_id: { in: ENTITY_IDS } },
          { current_owner_entity_id: { in: ENTITY_IDS } },
        ],
        deleted_at: null,
      },
    });
  });

  test('renvoie les carcasses refusées hors périmètre que GET /refusees/:fei_numero peut ajouter au store', async () => {
    vi.mocked(prisma.carcasse.count).mockResolvedValueOnce(2);
    // groupes de dispatch du périmètre : (FEI-1, dispatch-A) et (FEI-2, sans dispatch)
    vi.mocked(prisma.carcasse.findMany)
      .mockResolvedValueOnce([
        { fei_numero: 'FEI-1', premier_detenteur_prochain_detenteur_id_cache: 'dispatch-A' },
        { fei_numero: 'FEI-2', premier_detenteur_prochain_detenteur_id_cache: null },
      ] as any)
      // refusées / manquantes hors périmètre de ces fiches
      .mockResolvedValueOnce([
        {
          zacharie_carcasse_id: 'C-REFUSEE-A',
          fei_numero: 'FEI-1',
          premier_detenteur_prochain_detenteur_id_cache: 'dispatch-A',
        },
        {
          zacharie_carcasse_id: 'C-AUTRE-DESTINATAIRE',
          fei_numero: 'FEI-1',
          premier_detenteur_prochain_detenteur_id_cache: 'dispatch-B',
        },
        {
          zacharie_carcasse_id: 'C-MANQUANTE-SANS-DISPATCH',
          fei_numero: 'FEI-2',
          premier_detenteur_prochain_detenteur_id_cache: null,
        },
      ] as any);

    const res = await request(app).get('/carcasse/count').set('x-test-user', JSON.stringify(etgUser));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: { count: 2, refuseesHorsPerimetreIds: ['C-REFUSEE-A', 'C-MANQUANTE-SANS-DISPATCH'] },
      error: '',
    });
    expect(vi.mocked(prisma.carcasse.findMany).mock.calls[1][0]).toMatchObject({
      where: {
        fei_numero: { in: ['FEI-1', 'FEI-2'] },
        OR: [
          { intermediaire_carcasse_refus_intermediaire_id: { not: null } },
          { intermediaire_carcasse_manquante: true },
        ],
      },
    });
  });
});
