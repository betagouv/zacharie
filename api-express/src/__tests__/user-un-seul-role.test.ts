import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, afterEach } from 'vitest';
import userRouter from '~/controllers/user';
import adminUserRouter from '~/controllers/admin/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendTemplateEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('~/utils/send-onboarding-email', () => ({
  sendOnboardingEmailOnce: vi.fn().mockResolvedValue(undefined),
}));

const chasseur = { id: 'user-chasseur', email: 'examinateur@example.fr', roles: [UserRoles.CHASSEUR] };

const userApp = express();
userApp.use(express.json());
userApp.use('/user', userRouter);
userApp.use(sendError);

const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res, next) => {
  req.user = { id: 'admin-1', email: 'admin@example.fr', roles: ['CHASSEUR'], isZacharieAdmin: true };
  next();
});
adminApp.use(adminUserRouter);
adminApp.use(sendError);

describe('un seul rôle par utilisateur', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('POST /user/:id refuse deux rôles avec un 400', async () => {
    const res = await request(userApp)
      .post('/user/user-chasseur')
      .set('x-test-user', JSON.stringify(chasseur))
      .send({ roles: [UserRoles.CHASSEUR, UserRoles.ETG] });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('POST /user/:id garde le 406 pour les autres erreurs de validation', async () => {
    const res = await request(userApp)
      .post('/user/user-chasseur')
      .set('x-test-user', JSON.stringify(chasseur))
      .send({ prochain_bracelet_a_utiliser: 'pas-un-nombre' });
    expect(res.status).toBe(406);
  });

  test('admin : création d’un utilisateur avec deux rôles refusée avec un 400', async () => {
    const res = await request(adminApp)
      .post('/user/nouveau')
      .send({
        email: 'nouveau@example.fr',
        roles: [UserRoles.CHASSEUR, UserRoles.SVI],
        isZacharieAdmin: false,
      });
    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('admin : édition d’un utilisateur avec deux rôles refusée avec un 400', async () => {
    const res = await request(adminApp)
      .post('/user/target-1')
      .send({ roles: [UserRoles.CHASSEUR, UserRoles.ETG] });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('admin : édition avec un seul rôle acceptée', async () => {
    const target = {
      id: 'target-1',
      email: 'cible@example.fr',
      roles: [UserRoles.CHASSEUR],
      deleted_at: null as Date | null,
    };
    (prisma.user.findUnique as any).mockResolvedValue(target);
    (prisma.user.update as any).mockResolvedValue({ ...target, roles: [UserRoles.ETG] });
    await request(adminApp)
      .post('/user/target-1')
      .send({ roles: [UserRoles.ETG] });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roles: [UserRoles.ETG] }) })
    );
  });
});
