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
// which /partenaires uses. Add it here.
(prisma.entity as any).findMany = vi.fn();

const app = express();
app.use(express.json());
app.use('/entite/', entiteRouter);

const regularUser = {
  id: 'user-1',
  email: 'user1@example.com',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  roles: [UserRoles.CHASSEUR],
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
    deleted_at: null,
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
          roles: [UserRoles.COMMERCE_DE_DETAIL],
        },
      },
    ],
    ...extras,
  };
}

describe('GET /entite/partenaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unauthenticated → 401', async () => {
    await request(app).get('/entite/partenaires').expect(401);
  });

  test('allEntitiesById strips EntityRelationsWithUsers (privacy fix); userEntitiesById keeps them', async () => {
    const otherBoucherie = publicEntity('boucherie-other', EntityTypes.COMMERCE_DE_DETAIL);
    const myAsso = publicEntity('asso-mine', EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF, {
      EntityRelationsWithUsers: [
        {
          id: 'mine-rel',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          status: EntityRelationStatus.MEMBER,
          owner_id: regularUser.id,
          entity_id: 'asso-mine',
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
      .mockResolvedValueOnce([otherBoucherie, myAsso] as any)
      // Second call: entitiesUserCanHandleOnBehalf — relations are expected here
      .mockResolvedValueOnce([myAsso] as any);

    const res = await authed(request(app).get('/entite/partenaires'));

    expect(res.status).toBe(200);

    const allById = res.body.data.allEntitiesById;
    // Both entities present, no admin emails leaked — this is the whole point of the fix
    expect(allById['boucherie-other'].EntityRelationsWithUsers).toEqual([]);
    expect(allById['asso-mine'].EntityRelationsWithUsers).toEqual([]);

    const userById = res.body.data.userEntitiesById;
    // Entities the user can transmit to keep relations — UI uses them to know "I already attached"
    expect(userById['asso-mine'].EntityRelationsWithUsers).toHaveLength(1);
    expect(userById['asso-mine'].EntityRelationsWithUsers[0].owner_id).toBe(regularUser.id);
    expect(userById['boucherie-other']).toBeUndefined();
  });

  test('allEntities query restricts to partenaire types and skips for_testing for non-admins', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/partenaires')).expect(200);

    const firstCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(firstCallArgs.where.type.in).toEqual([
      EntityTypes.COMMERCE_DE_DETAIL,
      EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
      EntityTypes.ASSOCIATION_CARITATIVE,
      EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
      EntityTypes.CONSOMMATEUR_FINAL,
    ]);
    expect(firstCallArgs.where.for_testing).toBe(false);
    expect(firstCallArgs.where.deleted_at).toBeNull();
    // No include — that's the whole point of the fix
    expect(firstCallArgs.include).toBeUndefined();
  });

  test('platform admin sees for_testing entities (no for_testing filter)', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/partenaires'), adminUser).expect(200);

    const firstCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(firstCallArgs.where.for_testing).toBeUndefined();
  });

  test('userEntities query filters by CAN_TRANSMIT relation and the right related-entity types', async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([] as any);

    await authed(request(app).get('/entite/partenaires')).expect(200);

    const secondCallArgs = vi.mocked(prisma.entity.findMany).mock.calls[1][0] as any;
    expect(secondCallArgs.where.EntityRelationsWithUsers.some.owner_id).toBe(regularUser.id);
    expect(secondCallArgs.where.EntityRelationsWithUsers.some.relation).toBe(
      EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
    );
    expect(secondCallArgs.where.EntityRelationsWithUsers.some.EntityRelatedWithUser.type.in).toEqual([
      EntityTypes.COMMERCE_DE_DETAIL,
      EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
      EntityTypes.CONSOMMATEUR_FINAL,
    ]);
    // This query DOES include — it's the populated side
    expect(secondCallArgs.include).toBeDefined();
  });
});
