import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import entiteRouter from '~/controllers/entite';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateOrCreateBrevoCompany: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/utils/invite-user', () => ({
  inviteUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// vitest.setup.ts mocks prisma.entity.{findFirst,findUnique} but not findMany,
// which /working-for uses. Add it here.
(prisma.entity as any).findMany = vi.fn();

const app = express();
app.use(express.json());
app.use('/entite/', entiteRouter);

const regularUser = {
  id: 'user-1',
  email: 'user1@example.com',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  roles: [UserRoles.ETG],
  activated: true,
  isZacharieAdmin: false,
};

const adminUser = {
  ...regularUser,
  id: 'admin-1',
  email: 'admin@example.com',
  isZacharieAdmin: true,
};

function authed(req: request.Test, user: object = regularUser) {
  return req.set('x-test-user', JSON.stringify(user));
}

// Helper: entity rows with EntityRelationsWithUsers (admin include shape).
function publicEntity(id: string, type: EntityTypes, extras: Record<string, any> = {}) {
  return {
    id,
    type,
    nom_d_usage: `${id}-name`,
    deleted_at: null as Date | null,
    EntityRelationsWithUsers: [
      {
        id: `${id}-rel-admin`,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
        owner_id: 'someone-else',
        entity_id: id,
        UserRelatedWithEntity: {
          id: 'someone-else',
          email: 'leaked@example.com',
          nom_de_famille: 'Leaked',
          prenom: 'Owner',
          code_postal: '75000',
          ville: 'Paris',
          roles: [UserRoles.ETG],
        },
      },
    ],
    ...extras,
  };
}

describe('GET /entite/working-for', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unauthenticated → 401', async () => {
    await request(app).get('/entite/working-for').expect(401);
  });

  test('allEntitiesByTypeAndId strips EntityRelationsWithUsers (privacy fix); userEntitiesByTypeAndId keeps them', async () => {
    const otherEtg = publicEntity('etg-other', EntityTypes.ETG);
    const myEtg = publicEntity('etg-mine', EntityTypes.ETG, {
      EntityRelationsWithUsers: [
        {
          id: 'mine-rel',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.MEMBER,
          owner_id: regularUser.id,
          entity_id: 'etg-mine',
          UserRelatedWithEntity: {
            id: regularUser.id,
            email: regularUser.email,
            nom_de_famille: regularUser.nom_de_famille,
            prenom: regularUser.prenom,
            code_postal: '75000',
            ville: 'Paris',
            roles: regularUser.roles,
          },
        },
      ],
    });

    vi.mocked(prisma.entity.findMany)
      // First call: allEntities — caller MUST NOT see relations on these
      .mockResolvedValueOnce([otherEtg, myEtg] as any)
      // Second call: authorizedEntities (validated relation) — relations are expected here
      .mockResolvedValueOnce([myEtg] as any)
      // Third call: pendingEntities (REQUESTED) — none here
      .mockResolvedValueOnce([] as any);

    const res = await authed(request(app).get('/entite/working-for'));

    expect(res.status).toBe(200);

    const allByType = res.body.data.allEntitiesByTypeAndId;
    // Both entities present, but with NO user relations leaked
    expect(allByType[EntityTypes.ETG]['etg-other'].EntityRelationsWithUsers).toEqual([]);
    expect(allByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers).toEqual([]);

    const userByType = res.body.data.userEntitiesByTypeAndId;
    // The entity the user works for keeps relations — UI needs this for *-entreprise-utilisateurs pages
    expect(userByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers).toHaveLength(1);
    expect(userByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers[0].owner_id).toBe(regularUser.id);
    expect(userByType[EntityTypes.ETG]['etg-other']).toBeUndefined();
  });

  test('pending (REQUESTED) entities are listed but expose NO member PII, regardless of activated', async () => {
    // A not-yet-activated user who only self-requested a relation to an ETG.
    const requestingUser = { ...regularUser, activated: false };
    // What the DB returns for the pending query: only the caller's own relation, no UserRelatedWithEntity.
    const pendingEtg = publicEntity('etg-pending', EntityTypes.ETG, {
      EntityRelationsWithUsers: [
        {
          id: 'pending-rel',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.REQUESTED,
          owner_id: requestingUser.id,
          entity_id: 'etg-pending',
        },
      ],
    });

    vi.mocked(prisma.entity.findMany)
      .mockResolvedValueOnce([pendingEtg] as any) // allEntities
      .mockResolvedValueOnce([] as any) // authorizedEntities — none, the relation is only REQUESTED
      .mockResolvedValueOnce([pendingEtg] as any); // pendingEntities

    const res = await authed(request(app).get('/entite/working-for'), requestingUser);

    expect(res.status).toBe(200);

    // The pending query must NOT include member PII — only the caller's own relation.
    const pendingCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[2][0] as any;
    expect(pendingCallArgs.where.EntityRelationsWithUsers.some.status).toBe(EntityRelationStatus.REQUESTED);
    expect(pendingCallArgs.include.EntityRelationsWithUsers.where.owner_id).toBe(requestingUser.id);
    expect(pendingCallArgs.include.EntityRelationsWithUsers.select.UserRelatedWithEntity).toBeUndefined();

    // The entity is still listed (so the chasseur sees "demande en attente") but with no leaked PII.
    const userByType = res.body.data.userEntitiesByTypeAndId;
    const listed = userByType[EntityTypes.ETG]['etg-pending'];
    expect(listed).toBeDefined();
    expect(listed.EntityRelationsWithUsers[0].UserRelatedWithEntity).toBeUndefined();
  });

  test('authorized query gates on validated status and includes member PII (independent of activated)', async () => {
    const notActivated = { ...regularUser, activated: false };
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/working-for'), notActivated).expect(200);

    const authorizedCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[1][0] as any;
    expect(authorizedCallArgs.where.EntityRelationsWithUsers.some.status).toEqual({
      in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN],
    });
    // Validated side carries the full admin include (member PII) — gated by status, not by `activated`.
    expect(authorizedCallArgs.include.EntityRelationsWithUsers.select.UserRelatedWithEntity).toBeDefined();
  });

  test('allEntities query excludes CCG and for_testing entities for non-admins', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/working-for')).expect(200);

    const firstCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(firstCallArgs.where.type).toEqual({ not: EntityTypes.CCG });
    expect(firstCallArgs.where.for_testing).toBe(false);
    expect(firstCallArgs.where.deleted_at).toBeNull();
    // No include — that's the whole point of the fix
    expect(firstCallArgs.include).toBeUndefined();
  });

  test('platform admin sees for_testing entities (no for_testing filter)', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/working-for'), adminUser).expect(200);

    const firstCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(firstCallArgs.where.for_testing).toBeUndefined();
  });

  test('userEntities query filters to relations the caller owns', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/working-for')).expect(200);

    const secondCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[1][0] as any;
    expect(secondCallArgs.where.EntityRelationsWithUsers.some.owner_id).toBe(regularUser.id);
    expect(secondCallArgs.where.EntityRelationsWithUsers.some.relation).toBe(
      EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
    );
    // This query DOES include — it's the populated side
    expect(secondCallArgs.include).toBeDefined();
  });
});
