import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { Prisma, UserRoles } from '@prisma/client';
import { FORCE_FULL_RELOAD_AFTER } from '~/utils/force-full-reload';

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
  carcasses_reload_version: 0,
};

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.carcasse.count).mockResolvedValue(0);
  vi.mocked(prisma.entity.findMany).mockResolvedValue([]);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-1' } as any]);
});

function getCarcasses(after: number, user: object = sviUser, reloadVersion?: number) {
  return request(app)
    .get('/carcasse')
    .query({
      after: `${after}`,
      withDeleted: 'true',
      limit: '5000',
      ...(reloadVersion === undefined ? {} : { reloadVersion: `${reloadVersion}` }),
    })
    .set('x-test-user', JSON.stringify(user));
}

function updatedAtFilter() {
  const [strings, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0] as [TemplateStringsArray, ...any[]];
  const query = Prisma.sql(strings, ...values);
  if (!query.sql.includes('c.updated_at >=')) return undefined;
  return query.values.find((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value));
}

describe('GET /carcasse — rechargement complet forcé', () => {
  test('dernier pull antérieur à la date → pas de filtre updated_at, fullReload: true', async () => {
    const res = await getCarcasses(FORCE_FULL_RELOAD_AFTER.getTime() - 1);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(true);
    expect(updatedAtFilter()).toBeUndefined();
  });

  test('dernier pull postérieur à la date → pull delta, fullReload: false', async () => {
    const after = FORCE_FULL_RELOAD_AFTER.getTime() + 1;
    const res = await getCarcasses(after);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(updatedAtFilter()).toBe(new Date(after).toISOString());
  });

  test('premier chargement (after = 0) → tout le périmètre, fullReload: false', async () => {
    const res = await getCarcasses(0);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(updatedAtFilter()).toBeUndefined();
  });
});

describe('GET /carcasse — rechargement complet demandé pour un utilisateur', () => {
  const userWithReload = { ...sviUser, carcasses_reload_version: 3 };
  const after = FORCE_FULL_RELOAD_AFTER.getTime() + 1;

  test('même version → pull delta, fullReload: false', async () => {
    const res = await getCarcasses(after, userWithReload, 3);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(updatedAtFilter()).toBe(new Date(after).toISOString());
  });

  test('version inférieure → tout le périmètre, fullReload: true', async () => {
    const res = await getCarcasses(after, userWithReload, 2);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(true);
    expect(updatedAtFilter()).toBeUndefined();
  });

  test('version absente → pull delta', async () => {
    const res = await getCarcasses(after, userWithReload);
    expect(res.status).toBe(200);
    expect(res.body.data.fullReload).toBe(false);
    expect(updatedAtFilter()).toBe(new Date(after).toISOString());
  });

  test('la réponse porte la version de l’utilisateur', async () => {
    const res = await getCarcasses(after, userWithReload, 2);
    expect(res.body.data.reloadVersion).toBe(3);
  });
});
