import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

// GET /carcasse — un client dont le dernier pull est antérieur à FORCE_FULL_RELOAD_AFTER reçoit tout
// son périmètre (pas de filtre updated_at) avec fullReload: true, pour remplacer ses copies locales
// des carcasses sorties de son périmètre.

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

// vitest.setup.ts ne fournit pas carcasseIntermediaire.findMany — ajouté pour cette suite.
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(0);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-1' } as any]);
});

function getCarcasses(after: number, cursor: Record<string, string> = {}) {
  return request(app)
    .get('/carcasse')
    .query({ after: `${after}`, withDeleted: 'true', limit: '5000', ...cursor })
    .set('x-test-user', JSON.stringify(etgUser));
}

function findManyWhere() {
  return vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where!;
}

describe('GET /carcasse — rechargement complet forcé', () => {
  test('dernier pull antérieur à la date → pas de filtre updated_at, fullReload: true', async () => {
    const res = await getCarcasses(FORCE_FULL_RELOAD_AFTER.getTime() - 1);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(true);
    expect(findManyWhere().updated_at).toBeUndefined();
  });

  test('dernier pull postérieur à la date → pull delta, fullReload: false', async () => {
    const after = FORCE_FULL_RELOAD_AFTER.getTime() + 1;
    const res = await getCarcasses(after);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(findManyWhere().updated_at).toEqual({ gte: new Date(after) });
  });

  test('premier chargement (after = 0) → tout le périmètre, fullReload: false', async () => {
    const res = await getCarcasses(0);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(findManyWhere().updated_at).toBeUndefined();
  });
});

describe('GET /carcasse — pagination par curseur', () => {
  const after = FORCE_FULL_RELOAD_AFTER.getTime() + 1;

  test('première page → tri (updated_at, zacharie_carcasse_id) croissant, sans offset', async () => {
    const res = await getCarcasses(after);
    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!;
    expect(args.orderBy).toEqual([{ updated_at: 'asc' }, { zacharie_carcasse_id: 'asc' }]);
    expect(args.skip).toBeUndefined();
    expect(args.where!.AND).toBeUndefined();
  });

  test('page suivante → strictement après la dernière carcasse reçue, ex aequo départagés par id', async () => {
    const cursorDate = after + 1000;
    const res = await getCarcasses(after, { cursor_updated_at: `${cursorDate}`, cursor_id: 'FEI-1_B2' });
    expect(res.status).toBe(200);
    const where = findManyWhere();
    expect(where.updated_at).toEqual({ gte: new Date(cursorDate) });
    expect(where.AND).toEqual([
      { OR: [{ updated_at: { gt: new Date(cursorDate) } }, { zacharie_carcasse_id: { gt: 'FEI-1_B2' } }] },
    ]);
    // le total reste celui du delta complet, sans le curseur
    expect(vi.mocked(prisma.carcasse.count).mock.calls[0][0]!.where!.updated_at).toEqual({
      gte: new Date(after),
    });
  });

  test('curseur incomplet → 400', async () => {
    const res = await getCarcasses(after, { cursor_updated_at: `${after}` });
    expect(res.status).toBe(400);
  });

  test('hasMore quand la page est pleine', async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue(
      Array.from({ length: 2 }, (_, i) => ({ zacharie_carcasse_id: `c${i}`, fei_numero: 'FEI-1' }) as any)
    );
    const res = await request(app)
      .get('/carcasse')
      .query({ after: `${after}`, withDeleted: 'true', limit: '2' })
      .set('x-test-user', JSON.stringify(etgUser));
    expect(res.body.data.hasMore).toBe(true);
  });
});
