import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { type Entity, EntityRelationStatus, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('~/utils/invite-user', () => ({
  inviteUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/utils/federation-stats', () => ({
  ensureScopeForRoles: vi.fn((roles: UserRoles[]) => roles),
}));

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

const BASE = '/user/invite-user';

const chasseur = {
  id: 'user-chasseur',
  email: 'chasseur@example.com',
  roles: [UserRoles.CHASSEUR],
};

const etgUser = {
  id: 'user-etg',
  email: 'etg@example.com',
  roles: [UserRoles.ETG],
};

const testEntity: Partial<Entity> = {
  id: 'entity-1',
  nom_d_usage: 'Test ETG',
  type: EntityTypes.ETG,
  deleted_at: null,
};

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

describe('POST /user/invite-user — CHASSEUR guard', () => {
  beforeAll(() => {
    // global vitest setup mocks user.{findUnique, findFirst, update, delete} but not create
    (prisma.user as any).create = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('unauthenticated → 401', async () => {
    await request(app)
      .post(BASE)
      .send({ email: 'newbie@example.com', entity_id: 'entity-1' })
      .expect(401);
  });

  test('CHASSEUR is blocked with 400 and French error message', async () => {
    const res = await authed(
      request(app).post(BASE).send({ email: 'newbie@example.com', entity_id: 'entity-1' }),
      chasseur
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/chasseur ne peut pas inviter/i);
  });

  test('CHASSEUR blocked before schema validation (invalid body still returns guard error)', async () => {
    // empty body would normally fail Zod with 406; the guard must fire first with 400
    const res = await authed(request(app).post(BASE).send({}), chasseur);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/chasseur ne peut pas inviter/i);
  });

  test('CHASSEUR guard performs no DB writes and no invite side effects', async () => {
    // @ts-expect-error
    const { inviteUser } = await import('~/utils/invite-user');
    // @ts-expect-error
    const { createBrevoContact } = await import('~/third-parties/brevo');

    await authed(
      request(app).post(BASE).send({ email: 'victim@example.com', entity_id: 'entity-1' }),
      chasseur
    );

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.entity.findUnique).not.toHaveBeenCalled();
    expect(prisma.entityAndUserRelations.findFirst).not.toHaveBeenCalled();
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();
    expect(createBrevoContact).not.toHaveBeenCalled();
  });

  test('CHASSEUR with additional roles is still blocked (defense in depth)', async () => {
    // Project rule: a user shall not have multiple roles, but the guard must hold if it ever happens.
    const multiRoleUser = {
      id: 'user-multi',
      email: 'multi@example.com',
      roles: [UserRoles.CHASSEUR, UserRoles.ETG],
    };

    const res = await authed(
      request(app).post(BASE).send({ email: 'newbie@example.com', entity_id: 'entity-1' }),
      multiRoleUser
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/chasseur ne peut pas inviter/i);
  });

  test('non-CHASSEUR admin of entity → invite succeeds', async () => {
    // @ts-expect-error
    const { inviteUser } = await import('~/utils/invite-user');

    vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst)
      .mockResolvedValueOnce({ status: EntityRelationStatus.ADMIN } as any) // my ADMIN relation
      .mockResolvedValueOnce(null); // no existing relation for the invitee
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-new',
      email: 'newbie@example.com',
      roles: [UserRoles.ETG],
    } as any);
    vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({} as any);

    const res = await authed(
      request(app).post(BASE).send({ email: 'newbie@example.com', entity_id: 'entity-1' }),
      etgUser
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(inviteUser).toHaveBeenCalledOnce();
    expect(prisma.user.create).toHaveBeenCalledOnce();
    // invited user inherits inviter's roles (not CHASSEUR)
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect((createCall.data as any).roles).toEqual([UserRoles.ETG]);
  });

  test('non-CHASSEUR but not admin of entity → 400 (different message)', async () => {
    // @ts-expect-error
    const { inviteUser } = await import('~/utils/invite-user');

    vi.mocked(prisma.entity.findUnique).mockResolvedValue(testEntity as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue({
      status: EntityRelationStatus.MEMBER,
    } as any);

    const res = await authed(
      request(app).post(BASE).send({ email: 'newbie@example.com', entity_id: 'entity-1' }),
      etgUser
    );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/permissions/i);
    expect(inviteUser).not.toHaveBeenCalled();
  });
});
