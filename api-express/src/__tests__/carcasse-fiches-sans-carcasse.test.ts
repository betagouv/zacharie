import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

// GET /carcasse — le périmètre se lit sur les carcasses, donc une fiche sans carcasse n'y entre pas.
// Ses rattachés directs (créateur, examinateur initial) la reçoivent quand même : sans ça, elle
// disparaît de leur appareil après une déconnexion, alors qu'elle existe en base.

const examinateur = {
  id: 'user-examinateur',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-1',
  activated: true,
  isZacharieAdmin: false,
};

const ficheSansCarcasse = { numero: 'ZACH-20261110-EXAM1-000001', created_by_user_id: examinateur.id };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(0);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findMany).mockImplementation((async (args: any) =>
    args?.where?.Carcasses ? [ficheSansCarcasse] : []) as any);
});

function getCarcasses(query: { after?: string; cursorUpdatedAt?: string; cursorId?: string } = {}) {
  return request(app)
    .get('/carcasse')
    .query({ after: '0', withDeleted: 'true', limit: '5000', ...query })
    .set('x-test-user', JSON.stringify(examinateur));
}

function emptyFeisWhere() {
  const call = vi.mocked(prisma.fei.findMany).mock.calls.find(([args]) => !!args?.where?.Carcasses);
  return call?.[0]?.where;
}

describe('GET /carcasse — fiches sans carcasse', () => {
  test('les fiches sans carcasse créées ou examinées par l’utilisateur sont renvoyées', async () => {
    const res = await getCarcasses();
    expect(res.status).toBe(200);
    expect(res.body.data.feis.map((fei: { numero: string }) => fei.numero)).toEqual([
      ficheSansCarcasse.numero,
    ]);
    expect(emptyFeisWhere()).toEqual({
      Carcasses: { none: {} },
      OR: [{ created_by_user_id: examinateur.id }, { examinateur_initial_user_id: examinateur.id }],
    });
  });

  test('pull delta → filtre updated_at sur les fiches sans carcasse', async () => {
    const after = Date.now();
    await getCarcasses({ after: `${after}` });
    expect(emptyFeisWhere()?.updated_at).toEqual({ gte: new Date(after) });
  });

  test('pages suivantes → pas de nouvel envoi des fiches sans carcasse', async () => {
    const res = await getCarcasses({ cursorUpdatedAt: `${Date.now()}`, cursorId: 'ZACH-1_MM-001' });
    expect(res.status).toBe(200);
    expect(emptyFeisWhere()).toBeUndefined();
    expect(res.body.data.feis).toEqual([]);
  });
});
