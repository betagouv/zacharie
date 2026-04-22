import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import userEntityRouter from '~/controllers/user-entity';
import prisma from '~/prisma';
import { Entity, EntityAndUserRelations, EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

// Mock third-party side effects
vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  unlinkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock Passport to not require auth in tests
vi.mock('passport', () => {
  const authenticateMock = vi.fn(() => (req: any, res: any, next: any) => {
    const userHeader = req.get('x-test-user');
    if (userHeader) {
      req.user = JSON.parse(userHeader);
      next();
    } else {
      // Simulate Passport failing auth with failWithError: true
      const err = new Error('Unauthorized');
      (err as any).status = 401;
      next(err);
    }
  });

  return {
    default: {
      authenticate: authenticateMock,
    },
    authenticate: authenticateMock,
  };
});

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// Test users
const regularUser = {
  id: 'user-1',
  email: 'user1@example.com',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  roles: [UserRoles.CHASSEUR],
};

const platformAdmin = {
  id: 'admin-1',
  email: 'admin@example.com',
  prenom: 'Admin',
  nom_de_famille: 'User',
  isZacharieAdmin: true,
};

const otherUser = {
  id: 'user-2',
  email: 'user2@example.com',
  roles: [UserRoles.CHASSEUR],
};

const testEntity: Partial<Entity> = {
  id: 'entity-1',
  nom_d_usage: 'Test ETG',
  type: EntityTypes.ETG,
  deleted_at: null,
};

const app = express();
app.use(express.json());
app.use('/user-entity/', userEntityRouter);

function authed(req: request.Test, user = regularUser) {
  return req.set('x-test-user', JSON.stringify(user));
}

const BASE = '/user-entity/';

describe('POST /user-entity/', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    test('unauthenticated → 401', async () => {
      await request(app)
        .post(BASE)
        .send({
          owner_id: 'user-1',
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        })
        .expect(401);
    });
  });

  describe('authorization', () => {
    test('regular user managing their own entity → allowed', async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null) // isEntityAdmin check
        .mockResolvedValueOnce(null); // no duplicate
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        error: '',
        data: {
          relation: createdRelation,
          entity: testEntity,
        },
      });
    });

    test('regular user trying to manage another user → 403', async () => {
      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(403);
    });

    test('entity admin can manage another user in their entity', async () => {
      // First findFirst call: check entity admin status → return admin relation
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce({ id: 'rel-admin', status: EntityRelationStatus.ADMIN } as any) // isEntityAdmin check
        .mockResolvedValueOnce(null); // duplicate check

      const createdRelation: EntityAndUserRelations = {
        id: 'rel-new',
        owner_id: otherUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.MEMBER,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ok: true,
        error: '',
        data: {
          relation: createdRelation,
          entity: testEntity,
        },
      });
    });

    test('platform admin can manage any user', async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null) // isEntityAdmin check (admin doesn't need this, but route still checks)
        .mockResolvedValueOnce(null); // no duplicate
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({
        id: 'rel-1',
        owner_id: otherUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
        deleted_at: null,
      } as any);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        platformAdmin as any
      );

      expect(res.status).toBe(200);
    });
  });

  describe('create', () => {
    test('missing owner_id → 406 (schema validation)', async () => {
      const res = await authed(
        request(app).post(BASE).send({
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(406);
    });

    test('missing entity_id → 400', async () => {
      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(400);
    });

    test('missing relation → 400', async () => {
      const res = await authed(request(app).post(BASE).send({ owner_id: regularUser.id, entity_id: 'entity-1' }), regularUser);

      expect(res.status).toBe(400);
    });

    test('duplicate relation → 409', async () => {
      const existingRelation: EntityAndUserRelations = {
        id: 'rel-existing',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Check for duplicate: where has owner_id, entity_id, relation, deleted_at
        if (args.where?.relation && !args.where?.status) {
          return Promise.resolve(existingRelation);
        }
        // Check for admin: where has owner_id, entity_id, status
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(409);
    });

    test('CCG entity not found by numero_ddecpp → 400', async () => {
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(null);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          numero_ddecpp: 'ccg-DEP-1',
          type: EntityTypes.CCG,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(400);
    });

    test('CCG entity found by numero_ddecpp → 200', async () => {
      const ccgEntity = {
        ...testEntity,
        id: 'entity-ccg',
        type: EntityTypes.CCG,
        numero_ddecpp: 'ccg-dep-1',
      };
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(ccgEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation(null);
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-ccg',
        owner_id: regularUser.id,
        entity_id: 'entity-ccg',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          numero_ddecpp: 'CCG-DEP-1',
          type: EntityTypes.CCG,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(res.body.data.relation.entity_id).toBe('entity-ccg');
    });

    test('non-admin cannot set status', async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation(null);
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED, // default, not what user sent
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.ADMIN, // basic user trying to set status should not be allowed
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      // status should not have been forwarded to create
      const createCall = vi.mocked(prisma.entityAndUserRelations.create).mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('status');
      expect(res.body).toEqual({
        ok: true,
        error: '',
        data: {
          relation: createdRelation,
          entity: testEntity,
        },
      });
    });

    test('CAN_HANDLE relation triggers Brevo integration', async () => {
      // @ts-expect-error
      const { linkBrevoCompanyToContact } = await import('~/third-parties/brevo');
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);
      vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([]); // no admin notifications

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(linkBrevoCompanyToContact).toHaveBeenCalledWith(testEntity, regularUser);
    });

    test('non-CAN_HANDLE relations do not trigger Brevo', async () => {
      //
      // @ts-expect-error
      const { linkBrevoCompanyToContact } = await import('~/third-parties/brevo');
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-transmit',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(linkBrevoCompanyToContact).not.toHaveBeenCalled();
    });

    test('REQUESTED relation sends notification to entity admins', async () => {
      // @ts-expect-error
      const { default: sendNotification } = await import('~/service/notifications');
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);
      const adminUser = { ...regularUser, id: 'admin-user', prenom: 'Admin', nom_de_famille: 'Entity' };
      const adminRelation = {
        id: 'rel-admin',
        status: EntityRelationStatus.ADMIN,
        UserRelatedWithEntity: adminUser,
      };
      vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([adminRelation as any]);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user: adminUser,
          notificationLogAction: `NEW_USER_IN_ENTITY_entity-1`,
        })
      );
    });
  });

  describe('IDOR / cross-boundary', () => {
    test('user cannot modify relations outside their entity', async () => {
      // User-1 tries to create relation for otherUser at entity-2 (where user-1 is not admin)
      const createdRelation: EntityAndUserRelations = {
        id: 'rel-new',
        owner_id: otherUser.id,
        entity_id: 'entity-2',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };

      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null) // isEntityAdmin check for entity-2 → not admin
        .mockResolvedValueOnce(null); // no duplicate
      vi.mocked(prisma.entity.findUnique).mockResolvedValue({ ...testEntity, id: 'entity-2' } as any);
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-2',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(403); // blocked: not admin of entity-2
    });
  });
});

describe('PUT /user-entity/', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    test('unauthenticated → 401', async () => {
      await request(app)
        .put(BASE)
        .send({
          owner_id: 'user-1',
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        })
        .expect(401);
    });
  });

  describe('update', () => {
    test('relation not found → 404', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null) // isEntityAdmin check
        .mockResolvedValueOnce(null); // find existing relation

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(404);
    });

    test('regular user can not update status → 200', async () => {
      const existingRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        // Find existing relation for update
        return Promise.resolve(existingRelation);
      });
      vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue(existingRelation);

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.MEMBER,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      const updateCall = vi.mocked(prisma.entityAndUserRelations.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('status');
      expect(res.body).toEqual({
        ok: true,
        error: '',
        data: {
          relation: existingRelation,
          entity: testEntity,
        },
      });
    });

    test('admin user can update status → 200', async () => {
      const existingRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      const adminRelation: EntityAndUserRelations = {
        ...existingRelation,
        status: EntityRelationStatus.ADMIN,
      };
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(existingRelation); // find existing relation (admin check returns null since platformAdmin doesn't need DB check)
      vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue(adminRelation);

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.ADMIN,
        }),
        platformAdmin as any
      );

      expect(res.status).toBe(200);
      const updateCall = vi.mocked(prisma.entityAndUserRelations.update).mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('status');
      expect(res.body).toEqual({
        ok: true,
        error: '',
        data: {
          relation: adminRelation,
          entity: testEntity,
        },
      });
    });

    test('missing relation → 400', async () => {
      const res = await authed(request(app).put(BASE).send({ owner_id: regularUser.id, entity_id: 'entity-1' }), regularUser);

      expect(res.status).toBe(400);
    });

    test('missing entity_id → 400', async () => {
      const res = await authed(
        request(app).put(BASE).send({
          owner_id: regularUser.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(400);
    });

    test('regular user cannot update another user relation → 403', async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        // Existing relation lookup
        return Promise.resolve(null);
      });

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(403);
    });

    test('entity admin can update status in their entity', async () => {
      const existingRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: otherUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
        created_at: new Date().toISOString() as unknown as Date,
        updated_at: new Date().toISOString() as unknown as Date,
        is_synced: true,
        brevo_id: null,
      };
      const updatedRelation: EntityAndUserRelations = {
        ...existingRelation,
        status: EntityRelationStatus.ADMIN,
      };
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check returns the entity admin relation
        if (args.where?.status === EntityRelationStatus.ADMIN && args.where?.owner_id === regularUser.id) {
          return Promise.resolve({ id: 'rel-admin', status: EntityRelationStatus.ADMIN } as any);
        }
        // Find existing relation
        return Promise.resolve(existingRelation);
      });
      vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue(updatedRelation);

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.ADMIN,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      const updateCall = vi.mocked(prisma.entityAndUserRelations.update).mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('status', EntityRelationStatus.ADMIN);
    });
  });

  describe('IDOR / cross-boundary', () => {
    test('entity admin for entity-1 cannot modify entity-2 relations', async () => {
      // regularUser is admin of entity-1, but not entity-2
      vi.mocked(prisma.entity.findUnique).mockResolvedValue({ ...testEntity, id: 'entity-2' } as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue({ ...testEntity, id: 'entity-2' } as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check for entity-2 → not admin
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        // Duplicate check
        return Promise.resolve(null);
      });

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-2',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.MEMBER,
        }),
        regularUser
      );

      expect(res.status).toBe(403); // blocked: not admin of entity-2, can't manage others
    });
  });
});

describe('DELETE /user-entity/', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: entity exists
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
    vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
    // Default: not an entity admin
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);
  });

  describe('authentication', () => {
    test('unauthenticated → 401', async () => {
      await request(app)
        .delete(BASE)
        .send({
          owner_id: 'user-1',
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        })
        .expect(401);
    });
  });

  describe('delete action', () => {
    test('existing relation deleted → 200', async () => {
      const existingRelation: Partial<EntityAndUserRelations> = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
      };
      // Reset mocks and setup fresh for this test
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null) // isEntityAdmin check
        .mockResolvedValueOnce(existingRelation as any); // find relation to delete
      vi.mocked(prisma.entityAndUserRelations.delete).mockResolvedValue(existingRelation as any);

      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(vi.mocked(prisma.entityAndUserRelations.delete)).toHaveBeenCalledOnce();
    });

    test('relation not found → still 200', async () => {
      // Reset mocks and setup fresh for this test
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null); // all findFirst calls return null

      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(vi.mocked(prisma.entityAndUserRelations.delete)).not.toHaveBeenCalled();
    });

    test('CAN_HANDLE deletion triggers Brevo unlink', async () => {
      //
      // @ts-expect-error
      const { unlinkBrevoCompanyToContact } = await import('~/third-parties/brevo');
      const existingRelation: Partial<EntityAndUserRelations> = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        deleted_at: null,
      };
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        // Find relation to delete
        return Promise.resolve(existingRelation);
      });
      vi.mocked(prisma.entityAndUserRelations.delete).mockResolvedValue(existingRelation as any);

      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(unlinkBrevoCompanyToContact).toHaveBeenCalledWith(testEntity, regularUser);
    });

    test('non-CAN_HANDLE deletion does not trigger Brevo', async () => {
      //
      // @ts-expect-error
      const { unlinkBrevoCompanyToContact } = await import('~/third-parties/brevo');
      const existingRelation: Partial<EntityAndUserRelations> = {
        id: 'rel-transmit',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        deleted_at: null,
      };
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.entityAndUserRelations.delete).mockResolvedValue(existingRelation as any);

      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
      expect(unlinkBrevoCompanyToContact).not.toHaveBeenCalled();
    });

    test('unauthenticated DELETE → 401', async () => {
      await request(app)
        .delete(BASE)
        .send({
          owner_id: 'user-1',
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        })
        .expect(401);
    });

    test('missing owner_id → 406 (schema validation)', async () => {
      const res = await authed(
        request(app).delete(BASE).send({
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(406);
    });

    test('missing relation → 400', async () => {
      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          entity_id: 'entity-1',
        }),
        regularUser
      );

      expect(res.status).toBe(400);
    });

    test('missing entity_id → 400', async () => {
      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: regularUser.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(400);
    });

    test('cannot delete another user relation without admin', async () => {
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        // Admin check - regularUser is not admin of entity-1 for otherUser
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const res = await authed(
        request(app).delete(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        regularUser
      );

      expect(res.status).toBe(403);
    });
  });
});
