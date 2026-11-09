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

function getCarcasses(after: number, user: object = etgUser) {
  return request(app)
    .get('/carcasse')
    .query({ after: `${after}`, withDeleted: 'true', page: '0', limit: '5000' })
    .set('x-test-user', JSON.stringify(user));
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

describe('GET /carcasse — rechargement complet demandé pour un utilisateur', () => {
  const requestedAt = new Date(FORCE_FULL_RELOAD_AFTER.getTime() + 24 * 60 * 60 * 1000);
  const userWithReload = { ...etgUser, carcasses_reload_requested_at: requestedAt };

  test('dernier pull antérieur à la demande → tout le périmètre, fullReload: true', async () => {
    const res = await getCarcasses(requestedAt.getTime() - 1, userWithReload);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(true);
    expect(findManyWhere().updated_at).toBeUndefined();
  });

  test('dernier pull postérieur à la demande (appareil déjà rechargé) → pull delta', async () => {
    const after = requestedAt.getTime() + 1;
    const res = await getCarcasses(after, userWithReload);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(findManyWhere().updated_at).toEqual({ gte: new Date(after) });
  });

  test('demande antérieure à FORCE_FULL_RELOAD_AFTER → la date globale reste la référence', async () => {
    const oldRequest = { ...etgUser, carcasses_reload_requested_at: new Date('2020-01-01') };
    const res = await getCarcasses(FORCE_FULL_RELOAD_AFTER.getTime() - 1, oldRequest);
    expect(res.body.data.fullReload).toBe(true);
  });
});
