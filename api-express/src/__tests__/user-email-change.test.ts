import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { type User, UserRoles } from '@prisma/client';

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

vi.mock('~/utils/send-onboarding-email', () => ({
  sendOnboardingEmailOnce: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/utils/invite-user', () => ({
  inviteUser: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

const chasseur = {
  id: 'user-chasseur',
  email: 'chasseur@example.fr',
  roles: [UserRoles.CHASSEUR],
  prenom: 'Jean',
  nom_de_famille: 'CHASSEUR',
  activated: true,
  onboarded_at: new Date('2026-01-01T00:00:00.000Z'),
};

function post(body: object) {
  return request(app).post('/user/user-chasseur').set('x-test-user', JSON.stringify(chasseur)).send(body);
}

function securityLogActions() {
  return vi.mocked(prisma.securityLog.create).mock.calls.map((call) => call[0].data.action);
}

describe('POST /user/:id — changement d’email', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.update).mockImplementation(
      (args) => Promise.resolve({ ...chasseur, ...args.data } as unknown as User) as never
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('email inchangé (à la casse près) → accepté', async () => {
    const res = await post({ email: 'Chasseur@Example.fr', prenom: 'Jean' });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data.email).toBeUndefined();
    expect(securityLogActions()).toEqual([]);
  });

  test('nouvel email → 403, rien enregistré', async () => {
    const res = await post({ email: 'autre@example.fr', prenom: 'Jean' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("L'email ne peut pas être modifié");
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(securityLogActions()).toEqual(['EMAIL_CHANGE_REFUSED']);
  });

  test('nouvel email avec le mot de passe actuel → 403 quand même', async () => {
    const res = await post({ email: 'autre@example.fr', currentPassword: 'secret-secret' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
