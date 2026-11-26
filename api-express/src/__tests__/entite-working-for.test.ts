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
      .mockResolvedValueOnce([otherEtg, myEtg] as any)
      .mockResolvedValueOnce([myEtg] as any)
      .mockResolvedValueOnce([] as any);

    const res = await authed(request(app).get('/entite/working-for'));

    expect(res.status).toBe(200);

    const allByType = res.body.data.allEntitiesByTypeAndId;
    expect(allByType[EntityTypes.ETG]['etg-other'].EntityRelationsWithUsers).toEqual([]);
    expect(allByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers).toEqual([]);

    const userByType = res.body.data.userEntitiesByTypeAndId;
    expect(userByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers).toHaveLength(1);
    expect(userByType[EntityTypes.ETG]['etg-mine'].EntityRelationsWithUsers[0].owner_id).toBe(regularUser.id);
    expect(userByType[EntityTypes.ETG]['etg-other']).toBeUndefined();
  });

  test('pending (REQUESTED) entities are listed but expose NO member PII, regardless of activated', async () => {
    const requestingUser = { ...regularUser, activated: false };
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
      .mockResolvedValueOnce([pendingEtg] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([pendingEtg] as any);

    const res = await authed(request(app).get('/entite/working-for'), requestingUser);

    expect(res.status).toBe(200);

    const pendingCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[2][0] as any;
    expect(pendingCallArgs.where.EntityRelationsWithUsers.some.status).toBe(EntityRelationStatus.REQUESTED);
    expect(pendingCallArgs.include.EntityRelationsWithUsers.where.owner_id).toBe(requestingUser.id);
    expect(pendingCallArgs.include.EntityRelationsWithUsers.select.UserRelatedWithEntity).toBeUndefined();

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
    expect(authorizedCallArgs.include.EntityRelationsWithUsers.select.UserRelatedWithEntity).toBeDefined();
  });

  test('allEntities query excludes CCG and for_testing entities for non-admins', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/working-for')).expect(200);

    const firstCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(firstCallArgs.where.type).toEqual({ not: EntityTypes.CCG });
    expect(firstCallArgs.where.for_testing).toBe(false);
    expect(firstCallArgs.where.deleted_at).toBeNull();
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
    expect(secondCallArgs.include).toBeDefined();
  });
});
