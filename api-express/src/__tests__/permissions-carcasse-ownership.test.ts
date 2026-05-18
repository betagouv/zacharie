import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';

// Permissions for /carcasse/* endpoints — pinned BEFORE the carcasse-first
// fetch refactor. After the refactor, permission to see a carcasse must derive
// from its CarcasseIntermediaire / CarcasseSviEntity relations directly, NOT
// from FEI ownership. These tests assert that the current `where` clauses are
// already entity-relation-scoped, so the refactor only has to preserve them.

const sviUser = {
  id: 'user-svi',
  roles: [UserRoles.SVI],
  activated: true,
  isZacharieAdmin: false,
};

const etgUser = {
  id: 'user-etg',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const collecteurUser = {
  id: 'user-coll',
  roles: [UserRoles.COLLECTEUR_PRO],
  activated: true,
  isZacharieAdmin: false,
};

const chasseurUser = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

const inactiveSvi = { ...sviUser, activated: false };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

// vitest.setup.ts doesn't include carcasse.count — add it for this suite.
(prisma.carcasse as any).count = vi.fn().mockResolvedValue(0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  (prisma.carcasse as any).count.mockResolvedValue(0);
});

describe('GET /carcasse/svi — role gate', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).get('/carcasse/svi');
    expect(res.status).toBe(401);
  });

  test('non-activated SVI → 400', async () => {
    const res = await authed(request(app).get('/carcasse/svi'), inactiveSvi);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le compte n'est pas activé");
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('non-SVI user → 403, no DB query', async () => {
    const res = await authed(request(app).get('/carcasse/svi'), chasseurUser);
    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();

    const res2 = await authed(request(app).get('/carcasse/svi'), etgUser);
    expect(res2.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('SVI user → only sees carcasses where THEIR entity has CAN_HANDLE relation', async () => {
    const res = await authed(request(app).get('/carcasse/svi'), sviUser);
    expect(res.status).toBe(200);

    const findManyArgs = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!;
    const where: any = findManyArgs.where;

    // Permission boundary: must filter by SVI entity relation, not by FEI fields
    expect(where.svi_assigned_at).toEqual({ not: null });
    expect(where.deleted_at).toBeNull();
    expect(where.CarcasseSviEntity).toEqual({
      EntityRelationsWithUsers: {
        some: {
          owner_id: sviUser.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
        },
      },
    });

    // CRITICAL: must NOT scope by FEI ownership fields. The refactor flips
    // away from FEI-centric fetches; if any of these slip in, the refactor
    // hasn't actually decoupled permission from FEI.
    expect(where).not.toHaveProperty('fei_current_owner_user_id');
    expect(where).not.toHaveProperty('fei_current_owner_entity_id');
    expect(where).not.toHaveProperty('Fei');
  });
});

describe('GET /carcasse/etg — role gate', () => {
  test('non-ETG user → 403, no DB query', async () => {
    const res = await authed(request(app).get('/carcasse/etg'), sviUser);
    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();

    const res2 = await authed(request(app).get('/carcasse/etg'), chasseurUser);
    expect(res2.status).toBe(403);
  });

  test('ETG user → only sees carcasses with a CarcasseIntermediaire row pointing to their entity', async () => {
    const res = await authed(request(app).get('/carcasse/etg'), etgUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;

    expect(where.CarcasseIntermediaire).toBeDefined();
    expect(where.CarcasseIntermediaire.some.CarcasseIntermediaireEntity).toEqual({
      EntityRelationsWithUsers: {
        some: {
          owner_id: etgUser.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
        },
      },
    });

    // No FEI-based shortcut allowed
    expect(where).not.toHaveProperty('fei_current_owner_user_id');
    expect(where).not.toHaveProperty('fei_current_owner_entity_id');
  });
});

describe('GET /carcasse/collecteur_pro — role gate', () => {
  test('non-collecteur user → 403, no DB query', async () => {
    const res = await authed(request(app).get('/carcasse/collecteur_pro'), etgUser);
    expect(res.status).toBe(403);
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('collecteur user → filtered by intermediaire_role=COLLECTEUR_PRO + entity relation', async () => {
    const res = await authed(request(app).get('/carcasse/collecteur_pro'), collecteurUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    const some = where.CarcasseIntermediaire.some;

    // Must additionally constrain to COLLECTEUR_PRO rows so a user that is also
    // a member of an ETG entity can't see ETG-only carcasses via this endpoint.
    expect(some.intermediaire_role).toBe(FeiOwnerRole.COLLECTEUR_PRO);
    expect(some.CarcasseIntermediaireEntity.EntityRelationsWithUsers.some.owner_id).toBe(collecteurUser.id);
  });
});

describe('Cross-role isolation', () => {
  // The "user accidentally sees a carcasse they shouldn't" failure mode.
  // After the refactor, these are the only protections left at the carcasse level.
  test('SVI user hitting /carcasse/etg → 403 (no relaxed access via wrong endpoint)', async () => {
    const res = await authed(request(app).get('/carcasse/etg'), sviUser);
    expect(res.status).toBe(403);
  });

  test('ETG user hitting /carcasse/svi → 403', async () => {
    const res = await authed(request(app).get('/carcasse/svi'), etgUser);
    expect(res.status).toBe(403);
  });

  test('Collecteur hitting /carcasse/etg → 403 (single-role constraint)', async () => {
    const res = await authed(request(app).get('/carcasse/etg'), collecteurUser);
    expect(res.status).toBe(403);
  });
});

describe('Pagination + delta-fetch contract', () => {
  // The frontend's carcasse-first refactor will rely on these query params.
  // Pin the contract so the refactor can't silently drop "after" support
  // (which would force a full refetch every sync).
  test('after=<timestamp> narrows to carcasses updated_at >= that date', async () => {
    const cutoff = new Date('2026-03-01T00:00:00Z').getTime();
    await authed(request(app).get(`/carcasse/svi?after=${cutoff}`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.updated_at).toEqual({ gte: new Date(cutoff) });
  });

  test('withDeleted=true adds an OR over updated_at and deleted_at', async () => {
    const cutoff = new Date('2026-03-01T00:00:00Z').getTime();
    await authed(request(app).get(`/carcasse/svi?after=${cutoff}&withDeleted=true`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.OR).toEqual([
      { updated_at: { gte: new Date(cutoff) } },
      { deleted_at: { gte: new Date(cutoff) } },
    ]);
    // NB: controller still leaves `deleted_at: null` from initialization, which
    // effectively neutralizes the OR's second branch. Pinned as-is — the refactor
    // should not silently change this without an intentional fix.
    expect(where.deleted_at).toBeNull();
  });

  test('default (withDeleted absent) excludes soft-deleted carcasses', async () => {
    await authed(request(app).get('/carcasse/svi'), sviUser);
    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.deleted_at).toBeNull();
  });
});
