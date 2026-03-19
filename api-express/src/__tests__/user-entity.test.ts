import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import userRouter from '~/controllers/user';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

// Mock third-party side effects
vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  unlinkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

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
  roles: [UserRoles.ADMIN],
};

const otherUser = {
  id: 'user-2',
  email: 'user2@example.com',
  roles: [UserRoles.CHASSEUR],
};

const testEntity = {
  id: 'entity-1',
  nom_d_usage: 'Test ETG',
  type: EntityTypes.ETG,
  deleted_at: null,
};

const app = express();
app.use(express.json());
app.use('/user', userRouter);

function authed(req: request.Test, user = regularUser) {
  return req.set('x-test-user', JSON.stringify(user));
}

const BASE = '/user/user-entity';

describe('POST /user/user-entity', () => {
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
        .post(BASE)
        .send({ owner_id: 'user-1', entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY })
        .expect(401);
    });
  });

  describe('authorization', () => {
    test('regular user managing their own entity → allowed', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null); // no duplicate
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED,
        deleted_at: null,
      } as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(200);
    });

    test('regular user trying to manage another user → 403', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: otherUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(403);
    });

    test('entity admin can manage another user in their entity', async () => {
      // First findFirst call: check entity admin status → return admin relation
      vi.mocked(prisma.entityAndUserRelations.findFirst)
        .mockResolvedValueOnce({ id: 'rel-admin', status: EntityRelationStatus.ADMIN } as any) // isEntityAdmin check
        .mockResolvedValueOnce(null); // duplicate check

      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({
        id: 'rel-new',
        owner_id: otherUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
        deleted_at: null,
      } as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: otherUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY, status: EntityRelationStatus.MEMBER }),
        regularUser,
      );

      expect(res.status).toBe(200);
    });

    test('platform admin can manage any user', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null); // no duplicate
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({
        id: 'rel-1',
        owner_id: otherUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.MEMBER,
        deleted_at: null,
      } as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: otherUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        platformAdmin as any,
      );

      expect(res.status).toBe(200);
    });
  });

  describe('create action', () => {
    test('missing owner_id → 406 (schema validation)', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(406);
    });

    test('missing entity_id → 400', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(400);
    });

    test('missing relation → 400', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'create' }),
        regularUser,
      );

      expect(res.status).toBe(400);
    });

    test('duplicate relation → 409', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue({
        id: 'rel-existing',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        deleted_at: null,
      } as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(409);
    });

    test('CCG entity not found by numero_ddecpp → 404', async () => {
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(null);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, numero_ddecpp: 'ccg-DEP-1', type: EntityTypes.CCG, _action: 'create', relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(404);
    });

    test('non-admin cannot set status', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);
      const createdRelation = {
        id: 'rel-1',
        owner_id: regularUser.id,
        entity_id: 'entity-1',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.REQUESTED, // default, not what user sent
        deleted_at: null,
      };
      vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue(createdRelation as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'create', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY, status: EntityRelationStatus.ADMIN }),
        regularUser,
      );

      expect(res.status).toBe(200);
      // status should not have been forwarded to create
      const createCall = vi.mocked(prisma.entityAndUserRelations.create).mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('status');
    });
  });

  describe('update action', () => {
    test('relation not found → 404', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'update', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(404);
    });

    test('success → 200', async () => {
      const existingRelation = { id: 'rel-1', owner_id: regularUser.id, entity_id: 'entity-1', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY, deleted_at: null };
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(existingRelation as any);
      vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue({ ...existingRelation, status: EntityRelationStatus.MEMBER } as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'update', relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(200);
    });

    test('missing relation → 400', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'update' }),
        regularUser,
      );

      expect(res.status).toBe(400);
    });
  });

  describe('delete action', () => {
    test('existing relation deleted → 200', async () => {
      const existingRelation = { id: 'rel-1', owner_id: regularUser.id, entity_id: 'entity-1', relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY, deleted_at: null };
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(existingRelation as any);
      vi.mocked(prisma.entityAndUserRelations.delete).mockResolvedValue(existingRelation as any);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'delete', relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(200);
      expect(vi.mocked(prisma.entityAndUserRelations.delete)).toHaveBeenCalledOnce();
    });

    test('relation not found → still 200', async () => {
      vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);

      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'delete', relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY }),
        regularUser,
      );

      expect(res.status).toBe(200);
      expect(vi.mocked(prisma.entityAndUserRelations.delete)).not.toHaveBeenCalled();
    });
  });

  describe('invalid action', () => {
    test('unknown action → 406 (schema validation)', async () => {
      const res = await authed(
        request(app)
          .post(BASE)
          .send({ owner_id: regularUser.id, entity_id: 'entity-1', _action: 'invalid' }),
        regularUser,
      );

      expect(res.status).toBe(406);
    });
  });
});
