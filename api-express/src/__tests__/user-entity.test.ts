import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import userEntityRouter from '~/controllers/user-entity';
import prisma from '~/prisma';
import {
  Entity,
  EntityAndUserRelations,
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  UserRoles,
} from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  unlinkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('passport', () => {
  const authenticateMock = vi.fn(() => (req: any, res: any, next: any) => {
    const userHeader = req.get('x-test-user');
    if (userHeader) {
      req.user = JSON.parse(userHeader);
      next();
    } else {
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

const regularUser: {
  id: string;
  email: string;
  prenom: string;
  nom_de_famille: string;
  roles: UserRoles[];
} = {
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
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
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
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce({ id: 'rel-admin', status: EntityRelationStatus.ADMIN } as any)
        .mockResolvedValueOnce(null);

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

    test('platform admin without entity admin relation cannot manage another user → 403', async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);

      const res = await authed(
        request(app).post(BASE).send({
          owner_id: otherUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        platformAdmin as any
      );

      expect(res.status).toBe(403);
      expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
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
      const res = await authed(
        request(app).post(BASE).send({ owner_id: regularUser.id, entity_id: 'entity-1' }),
        regularUser
      );

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
        if (args.where?.relation && !args.where?.status) {
          return Promise.resolve(existingRelation);
        }
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
          status: EntityRelationStatus.ADMIN,
        }),
        regularUser
      );

      expect(res.status).toBe(200);
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
      vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([]);

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

    describe('association de chasse sans membre (ex. importée par l’équipe Zacharie)', () => {
      const associationDeChasse: Partial<Entity> = {
        id: 'entity-pd',
        nom_d_usage: '4111101 ANDREST',
        code_postal: '65800',
        ville: 'AUREILHAN',
        type: EntityTypes.PREMIER_DETENTEUR,
        deleted_at: null,
      };

      function mockAssociation({ hasMembers }: { hasMembers: boolean }) {
        vi.mocked(prisma.entity.findUnique).mockResolvedValue(associationDeChasse as any);
        // @ts-expect-error
        vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
          if (args.where?.status?.in) {
            return Promise.resolve(hasMembers ? ({ id: 'rel-existing' } as any) : null);
          }
          return Promise.resolve(null);
        });
        // @ts-expect-error
        vi.mocked(prisma.entityAndUserRelations.create).mockImplementation((args: any) =>
          Promise.resolve({ id: 'rel-pd', status: EntityRelationStatus.REQUESTED, ...args.data })
        );
        vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([]);
      }

      const joinRequest = () =>
        authed(
          request(app).post(BASE).send({
            owner_id: regularUser.id,
            entity_id: 'entity-pd',
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            status: EntityRelationStatus.REQUESTED,
          }),
          regularUser
        );

      test('le premier chasseur qui la rejoint en devient admin et l’équipe Zacharie est prévenue', async () => {
        // @ts-expect-error
        const { sendEmail } = await import('~/third-parties/brevo');
        mockAssociation({ hasMembers: false });

        const res = await joinRequest();

        expect(res.status).toBe(200);
        expect(res.body.data.relation.status).toBe(EntityRelationStatus.ADMIN);
        expect(sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            emails: ['contact@zacharie.beta.gouv.fr'],
            subject: "Premier membre d'une association de chasse : 4111101 ANDREST",
          })
        );
      });

      test('un chasseur qui rejoint une association avec des membres reste en attente, sans email à l’équipe', async () => {
        // @ts-expect-error
        const { sendEmail } = await import('~/third-parties/brevo');
        mockAssociation({ hasMembers: true });

        const res = await joinRequest();

        expect(res.status).toBe(200);
        expect(res.body.data.relation.status).toBe(EntityRelationStatus.REQUESTED);
        expect(sendEmail).not.toHaveBeenCalled();
      });

      test('un chasseur déjà rattaché à 5 associations (demandes en attente comprises) ne peut pas en rejoindre une 6e', async () => {
        mockAssociation({ hasMembers: true });
        vi.mocked(prisma.entityAndUserRelations.count).mockResolvedValueOnce(5);

        const res = await joinRequest();

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Vous ne pouvez pas être rattaché à plus de 5 associations de chasse.');
        expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
      });

      test('un chasseur rattaché à 4 associations peut en rejoindre une 5e', async () => {
        mockAssociation({ hasMembers: true });
        vi.mocked(prisma.entityAndUserRelations.count).mockResolvedValueOnce(4);

        const res = await joinRequest();

        expect(res.status).toBe(200);
        expect(prisma.entityAndUserRelations.create).toHaveBeenCalledOnce();
      });
    });

    test('REQUESTED relation by non-CHASSEUR is blocked from notifying admins', async () => {
      // @ts-expect-error
      const { default: sendNotification } = await import('~/service/notifications');
      const etgUser = { ...regularUser, id: 'etg-user', roles: [UserRoles.ETG] };
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
        owner_id: etgUser.id,
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
          owner_id: etgUser.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        }),
        etgUser
      );

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(sendNotification).not.toHaveBeenCalled();
      expect(prisma.entityAndUserRelations.findMany).not.toHaveBeenCalled();
      expect(prisma.entityAndUserRelations.create).toHaveBeenCalledOnce();
    });
  });

  describe('IDOR / cross-boundary', () => {
    test('user cannot modify relations outside their entity', async () => {
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
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
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

      expect(res.status).toBe(403);
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
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

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
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
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

    test('platform admin cannot update status of a relation → status ignored', async () => {
      const existingRelation: EntityAndUserRelations = {
        id: 'rel-1',
        owner_id: platformAdmin.id,
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
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingRelation);
      vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue(existingRelation);

      const res = await authed(
        request(app).put(BASE).send({
          owner_id: platformAdmin.id,
          entity_id: 'entity-1',
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: EntityRelationStatus.ADMIN,
        }),
        platformAdmin as any
      );

      expect(res.status).toBe(200);
      const updateCall = vi.mocked(prisma.entityAndUserRelations.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('status');
    });

    test('missing relation → 400', async () => {
      const res = await authed(
        request(app).put(BASE).send({ owner_id: regularUser.id, entity_id: 'entity-1' }),
        regularUser
      );

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
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
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
        if (args.where?.status === EntityRelationStatus.ADMIN && args.where?.owner_id === regularUser.id) {
          return Promise.resolve({ id: 'rel-admin', status: EntityRelationStatus.ADMIN } as any);
        }
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
      vi.mocked(prisma.entity.findUnique).mockResolvedValue({ ...testEntity, id: 'entity-2' } as any);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue({ ...testEntity, id: 'entity-2' } as any);
      // @ts-expect-error
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((args: any) => {
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
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

      expect(res.status).toBe(403);
    });
  });
});

describe('DELETE /user-entity/', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
    vi.mocked(prisma.entity.findFirst).mockResolvedValue(testEntity as any);
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
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingRelation as any);
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
      vi.mocked(prisma.entity.findUnique).mockReset();
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockReset();
      vi.mocked(prisma.entityAndUserRelations.delete).mockReset();

      vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);

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
        if (args.where?.status === EntityRelationStatus.ADMIN) {
          return Promise.resolve(null);
        }
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
