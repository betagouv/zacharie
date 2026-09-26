import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminUserEntityRouter from '~/controllers/admin/user-entity';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { linkBrevoCompanyToContact, unlinkBrevoCompanyToContact } from '~/third-parties/brevo';
import { EntityRelationStatus, EntityRelationType, EntityTypes } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  unlinkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

const adminUser = { id: 'admin-1', email: 'admin@example.fr', roles: ['CHASSEUR'], isZacharieAdmin: true };
const targetUser = {
  id: 'target-1',
  email: 'target@example.fr',
  roles: ['ETG'],
  deleted_at: null as Date | null,
};
const entity = {
  id: 'entity-1',
  nom_d_usage: 'ETG 1',
  type: EntityTypes.ETG,
  deleted_at: null as Date | null,
};

// le routeur admin est monté derrière la stratégie `admin` (ProConnect), simulée ici
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
app.use(adminUserEntityRouter);
app.use(sendError);

const body = {
  owner_id: targetUser.id,
  entity_id: entity.id,
  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
};

describe('/admin/user-entity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(entity as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any);
  });

  test('POST: first member of the entity becomes its admin, Brevo links the target user', async () => {
    vi.mocked(prisma.entityAndUserRelations.findFirst)
      .mockResolvedValueOnce(null) // no duplicate
      .mockResolvedValueOnce(null); // entity has no users yet
    vi.mocked(prisma.entityAndUserRelations.create).mockImplementation(
      (args: any) => Promise.resolve({ id: 'rel-1', ...args.data }) as any
    );

    const res = await request(app)
      .post('/user-entity')
      .send({ ...body, status: EntityRelationStatus.MEMBER });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.entityAndUserRelations.create).mock.calls[0][0].data).toMatchObject({
      owner_id: targetUser.id,
      status: EntityRelationStatus.ADMIN,
    });
    expect(linkBrevoCompanyToContact).toHaveBeenCalledWith(entity, targetUser);
  });

  test('POST: existing relation → 409', async () => {
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({ id: 'rel-1' } as any);

    const res = await request(app).post('/user-entity').send(body);

    expect(res.status).toBe(409);
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
  });

  test('POST: unknown user → 404', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const res = await request(app).post('/user-entity').send(body);

    expect(res.status).toBe(404);
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
  });

  test('PUT: updates the status', async () => {
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({
      id: 'rel-1',
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
    } as any);
    vi.mocked(prisma.entityAndUserRelations.update).mockResolvedValue({
      id: 'rel-1',
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: EntityRelationStatus.ADMIN,
    } as any);

    const res = await request(app)
      .put('/user-entity')
      .send({ ...body, status: EntityRelationStatus.ADMIN });

    expect(res.status).toBe(200);
    expect(prisma.entityAndUserRelations.update).toHaveBeenCalledWith({
      where: { id: 'rel-1' },
      data: { status: EntityRelationStatus.ADMIN },
    });
  });

  test('DELETE: removes the relation and unlinks the target user in Brevo', async () => {
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({
      id: 'rel-1',
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
    } as any);

    const res = await request(app).delete('/user-entity').send(body);

    expect(res.status).toBe(200);
    expect(prisma.entityAndUserRelations.delete).toHaveBeenCalledWith({ where: { id: 'rel-1' } });
    expect(unlinkBrevoCompanyToContact).toHaveBeenCalledWith(entity, targetUser);
  });
});
