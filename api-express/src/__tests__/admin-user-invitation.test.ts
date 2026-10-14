import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminUserRouter from '~/controllers/admin/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { sendEmail, sendTemplateEmail } from '~/third-parties/brevo';

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

vi.mock('~/utils/createUserId', () => ({
  default: vi.fn().mockResolvedValue('new-user-1'),
}));

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.fr',
  roles: ['CHASSEUR'],
  isZacharieAdmin: true,
};

const targetUser = {
  id: 'target-1',
  email: 'nouveau.chasseur@example.fr',
  roles: ['CHASSEUR'],
};

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
app.use(adminUserRouter);
app.use(sendError);

describe('Admin user creation and invitation link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /user/nouveau', () => {
    test('creates the user with one role and sends no email', async () => {
      (prisma.user.create as any).mockImplementation(({ data }: any) => Promise.resolve(data));

      const res = await request(app)
        .post('/user/nouveau')
        .send({ email: ' Nouveau.Chasseur@example.fr ', roles: ['CHASSEUR'], isZacharieAdmin: false });

      expect(res.status).toBe(200);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: 'new-user-1',
          email: 'nouveau.chasseur@example.fr',
          roles: ['CHASSEUR'],
          isZacharieAdmin: false,
        },
      });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendTemplateEmail).not.toHaveBeenCalled();
    });

    test('rejects more than one role', async () => {
      const res = await request(app)
        .post('/user/nouveau')
        .send({ email: 'x@example.fr', roles: ['CHASSEUR', 'ETG'], isZacharieAdmin: false });

      expect(res.status).toBe(400);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /user/:user_id/invitation-link', () => {
    test('creates a token and returns the invitation url without sending an email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.password.findUnique as any).mockResolvedValue(null);

      const res = await request(app).post('/user/target-1/invitation-link');

      expect(res.status).toBe(200);
      const token = (prisma.password.upsert as any).mock.calls[0][0].create.reset_password_token;
      expect(token).toBeTruthy();
      expect(res.body.data.url).toContain(`/app/connexion/invitation?invitation-token=${token}`);
      expect(res.body.data.url).toContain(`email=${encodeURIComponent(targetUser.email)}`);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendTemplateEmail).not.toHaveBeenCalled();
    });

    test('renews the token of a pending invitation', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.password.findUnique as any).mockResolvedValue({ user_id: 'target-1', password: '' });

      const res = await request(app).post('/user/target-1/invitation-link');

      expect(res.status).toBe(200);
      expect(prisma.password.upsert).toHaveBeenCalledOnce();
    });

    test('refuses when the user already has a password', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.password.findUnique as any).mockResolvedValue({ user_id: 'target-1', password: 'hashed' });

      const res = await request(app).post('/user/target-1/invitation-link');

      expect(res.status).toBe(400);
      expect(prisma.password.upsert).not.toHaveBeenCalled();
    });
  });
});
