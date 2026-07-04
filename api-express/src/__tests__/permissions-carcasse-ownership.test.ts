import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import carcasseRouter from '~/controllers/carcasse';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, UserRoles } from '@prisma/client';

// Permissions for the unified GET /carcasse/ endpoint. After the carcasse-first
// refactor, the three role-segmented routes (/carcasse/svi, /carcasse/etg,
// /carcasse/collecteur_pro) collapsed into a single route that branches by
// req.user.roles internally. Permission to see a carcasse derives from
// carcasse-level ownership fields (svi_entity_id, current_owner_entity_id,
// next_owner_entity_id) and CarcasseIntermediaire entity relations — never
// from FEI ownership fields. These tests pin that contract.

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

const commerceUser = {
  id: 'user-cc',
  roles: [UserRoles.COMMERCE_DE_DETAIL],
  activated: true,
  isZacharieAdmin: false,
};

const unknownRoleUser = {
  id: 'user-unknown',
  roles: [] as UserRoles[],
  activated: true,
  isZacharieAdmin: false,
};

const inactiveSvi = { ...sviUser, activated: false };

const app = express();
app.use(express.json());
app.use('/carcasse', carcasseRouter);

// Default required query params (zod schema rejects requests missing any of them)
const DEFAULT_QS = 'page=0&after=0&limit=100&withDeleted=false';

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

// vitest.setup.ts doesn't include these — add them for this suite.
(prisma.carcasse as any).count = vi.fn().mockResolvedValue(0);
(prisma.carcasseIntermediaire as any).findMany = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  vi.mocked(prisma.fei.findMany).mockResolvedValue([]);
  (prisma.carcasseIntermediaire as any).findMany.mockResolvedValue([]);
  (prisma.carcasse as any).count.mockResolvedValue(0);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { entity_id: 'entity-1' } as any,
    { entity_id: 'entity-2' } as any,
  ]);
});

describe('Auth / activation / query validation', () => {
  test('unauthenticated → 401', async () => {
    const res = await request(app).get(`/carcasse?${DEFAULT_QS}`);
    expect(res.status).toBe(401);
  });

  test('non-activated user → 400, no DB query', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), inactiveSvi);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le compte n'est pas activé");
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });

  test('missing required query params → 400, no DB query', async () => {
    const res = await authed(request(app).get('/carcasse'), sviUser);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid query parameters');
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});

describe('Role branching — where clause shape', () => {
  test('SVI user → svi_assigned_at + svi_entity_id scoped by user entities', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), sviUser);
    expect(res.status).toBe(200);

    // entityAndUserRelations is fetched first to derive the user's entity scope
    expect(prisma.entityAndUserRelations.findMany).toHaveBeenCalledWith({
      where: {
        owner_id: sviUser.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      },
      select: { entity_id: true },
    });

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.svi_assigned_at).toEqual({ not: null });
    expect(where.OR).toEqual([
      { svi_entity_id: { in: ['entity-1', 'entity-2'] } },
      { next_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
    ]);
    expect(where.deleted_at).toBeNull();

    // CRITICAL: must NOT scope by FEI ownership fields.
    expect(where).not.toHaveProperty('fei_current_owner_user_id');
    expect(where).not.toHaveProperty('fei_current_owner_entity_id');
    expect(where).not.toHaveProperty('Fei');
  });

  test('CHASSEUR user → OR over premier_detenteur / examinateur user+entity ids', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), chasseurUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.OR).toEqual([
      { premier_detenteur_user_id: chasseurUser.id },
      { examinateur_initial_user_id: chasseurUser.id },
      // Désignation du premier détenteur (entité) : exposée aux membres de l'entité seulement
      // une fois la fiche réellement transmise (sortie de l'examinateur initial).
      {
        premier_detenteur_entity_id: { in: ['entity-1', 'entity-2'] },
        current_owner_role: { not: 'EXAMINATEUR_INITIAL' },
      },
      {
        next_owner_entity_id: { in: ['entity-1', 'entity-2'] },
        current_owner_role: { not: 'EXAMINATEUR_INITIAL' },
      },
      { prev_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
      { current_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
      { next_owner_user_id: chasseurUser.id },
      { prev_owner_user_id: chasseurUser.id },
      { current_owner_user_id: chasseurUser.id },
    ]);
    expect(where.deleted_at).toBeNull();
  });

  test('ETG user → OR over CarcasseIntermediaire + next_owner + current_owner entity ids', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), etgUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.OR).toEqual([
      {
        CarcasseIntermediaire: {
          some: { intermediaire_entity_id: { in: ['entity-1', 'entity-2'] } },
        },
      },
      { next_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
      { current_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
    ]);
    expect(where.deleted_at).toBeNull();

    // No FEI-based shortcut allowed
    expect(where).not.toHaveProperty('fei_current_owner_user_id');
    expect(where).not.toHaveProperty('fei_current_owner_entity_id');
  });

  test('COLLECTEUR_PRO user → same intermediaire-style OR as ETG', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), collecteurUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.OR[0]).toEqual({
      CarcasseIntermediaire: {
        some: { intermediaire_entity_id: { in: ['entity-1', 'entity-2'] } },
      },
    });
    expect(where.OR[1]).toEqual({ next_owner_entity_id: { in: ['entity-1', 'entity-2'] } });
    expect(where.OR[2]).toEqual({ current_owner_entity_id: { in: ['entity-1', 'entity-2'] } });
  });

  test('COMMERCE_DE_DETAIL user → same intermediaire-style OR (circuit court)', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), commerceUser);
    expect(res.status).toBe(200);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0].CarcasseIntermediaire.some.intermediaire_entity_id).toEqual({
      in: ['entity-1', 'entity-2'],
    });
  });

  test('user with no matching role → 403, no carcasse query', async () => {
    const res = await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), unknownRoleUser);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Vous n'avez pas les permissions.");
    expect(prisma.carcasse.findMany).not.toHaveBeenCalled();
  });
});

describe('Pagination + delta-fetch contract', () => {
  test('page/limit map to skip/take', async () => {
    await authed(request(app).get('/carcasse?page=2&after=0&limit=50&withDeleted=false'), sviUser);

    const args = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!;
    expect(args.skip).toBe(100); // page=2 * limit=50
    expect(args.take).toBe(50);
  });

  test('after=<timestamp> with withDeleted=false → where.updated_at = { gte: Date(after) }', async () => {
    const cutoff = new Date('2026-03-01T00:00:00Z').getTime();
    await authed(request(app).get(`/carcasse?page=0&after=${cutoff}&limit=100&withDeleted=false`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.updated_at).toEqual({ gte: new Date(cutoff) });
    expect(where.deleted_at).toBeNull();
  });

  test('withDeleted=true → deleted_at is NOT forced to null; updated_at gates the delta', async () => {
    const cutoff = new Date('2026-03-01T00:00:00Z').getTime();
    await authed(request(app).get(`/carcasse?page=0&after=${cutoff}&limit=100&withDeleted=true`), sviUser);

    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.updated_at).toEqual({ gte: new Date(cutoff) });
    // when withDeleted=true the controller does NOT set deleted_at = null,
    // so soft-deleted rows updated after the cutoff are visible.
    expect(where.deleted_at).toBeUndefined();
    // role-based OR is preserved (here: SVI scope)
    expect(where.OR).toEqual([
      { svi_entity_id: { in: ['entity-1', 'entity-2'] } },
      { next_owner_entity_id: { in: ['entity-1', 'entity-2'] } },
    ]);
  });

  test('default (withDeleted=false) excludes soft-deleted carcasses', async () => {
    await authed(request(app).get(`/carcasse?${DEFAULT_QS}`), sviUser);
    const where: any = vi.mocked(prisma.carcasse.findMany).mock.calls[0][0]!.where;
    expect(where.deleted_at).toBeNull();
  });
});
