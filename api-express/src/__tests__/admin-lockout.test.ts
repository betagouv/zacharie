import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminUserRouter from '~/controllers/admin/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { sendTemplateEmail } from '~/third-parties/brevo';

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

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.fr',
  roles: ['CHASSEUR', 'ADMIN'],
  isZacharieAdmin: true,
};

const targetUser = {
  id: 'target-1',
  email: 'locked@example.fr',
  roles: ['CHASSEUR'],
  nom_de_famille: 'Dupont',
  prenom: 'Jean',
  telephone: '0612345678',
  addresse_ligne_1: '1 rue de la Paix',
  code_postal: '75001',
  ville: 'Paris',
  activated: true,
  deleted_at: null as Date | null,
  numero_cfei: null as string | null,
  est_forme_a_l_examen_initial: false,
  onboarded_at: null as Date | null,
  isZacharieAdmin: false,
};

// Mount the admin user router with a simple auth middleware
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
app.use(adminUserRouter);
app.use(sendError);

describe('Admin lockout management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /user/:user_id — lockout info in response', () => {
    test('returns lockout.is_locked=false when no recent failures', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.entity.findMany as any).mockResolvedValue([]);
      (prisma.securityLog.findFirst as any).mockResolvedValue(null);
      (prisma.securityLog.count as any).mockResolvedValue(0);

      const res = await request(app).get('/user/target-1');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.lockout).toEqual({
        is_locked: false,
        recent_failures: 0,
        lockout_expires_at: null,
        last_failure_action: null,
        last_failure_at: null,
      });
    });

    test('returns lockout.is_locked=true when 5+ recent failures', async () => {
      const failureDate = new Date('2026-09-18T16:50:00Z');
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.entity.findMany as any).mockResolvedValue([]);
      // First findFirst call: lastUnlock (none)
      // Second findFirst call: lastFailure
      (prisma.securityLog.findFirst as any)
        .mockResolvedValueOnce(null) // no unlock
        .mockResolvedValue({ action: 'LOGIN_FAILED_WRONG_PASSWORD', created_at: failureDate });
      (prisma.securityLog.count as any).mockResolvedValue(7);

      const res = await request(app).get('/user/target-1');

      expect(res.status).toBe(200);
      expect(res.body.data.lockout.is_locked).toBe(true);
      expect(res.body.data.lockout.recent_failures).toBe(7);
      expect(res.body.data.lockout.lockout_expires_at).toBeTruthy();
      expect(res.body.data.lockout.last_failure_action).toBe('LOGIN_FAILED_WRONG_PASSWORD');
    });

    test('returns lockout.is_locked=false when admin unlocked after failures', async () => {
      const unlockDate = new Date('2026-09-18T16:55:00Z');
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.entity.findMany as any).mockResolvedValue([]);
      // First findFirst: lastUnlock exists
      (prisma.securityLog.findFirst as any)
        .mockResolvedValueOnce({ action: 'LOGIN_UNLOCK_FROM_ADMIN', created_at: unlockDate })
        .mockResolvedValue(null); // no failures after unlock
      (prisma.securityLog.count as any).mockResolvedValue(0);

      const res = await request(app).get('/user/target-1');

      expect(res.status).toBe(200);
      expect(res.body.data.lockout.is_locked).toBe(false);
      expect(res.body.data.lockout.recent_failures).toBe(0);
    });
  });

  describe('POST /user/:user_id/unblock', () => {
    test('creates LOGIN_UNLOCK_FROM_ADMIN security log', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.securityLog.create as any).mockResolvedValue({});
      // After unlock: getLockoutInfo calls
      (prisma.securityLog.findFirst as any).mockResolvedValue(null);
      (prisma.securityLog.count as any).mockResolvedValue(0);

      const res = await request(app).post('/user/target-1/unblock');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prisma.securityLog.create).toHaveBeenCalledWith({
        data: {
          email: 'locked@example.fr',
          action: 'LOGIN_UNLOCK_FROM_ADMIN',
        },
      });
      expect(res.body.data.lockout.is_locked).toBe(false);
    });

    test('returns 400 for unknown user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app).post('/user/unknown/unblock');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /user/:user_id/send-reset-password', () => {
    test('sends reset email and logs PASSWORD_RESET_SENT_FROM_ADMIN', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(targetUser);
      (prisma.password.upsert as any).mockResolvedValue({});
      (prisma.securityLog.create as any).mockResolvedValue({});
      const res = await request(app).post('/user/target-1/send-reset-password');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
      expect(prisma.password.upsert).toHaveBeenCalled();
      expect(prisma.securityLog.create).toHaveBeenCalledWith({
        data: {
          email: 'locked@example.fr',
          action: 'PASSWORD_RESET_SENT_FROM_ADMIN',
        },
      });
    });

    test('returns 400 for unknown user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app).post('/user/unknown/send-reset-password');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });
});
