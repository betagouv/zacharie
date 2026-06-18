import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, afterEach } from 'vitest';
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

vi.mock('~/utils/federation-stats', () => ({
  ensureScopeForRoles: vi.fn((roles: UserRoles[]) => roles),
}));

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

// A non-CHASSEUR onboarding user (ETG / SVI / COLLECTEUR_PRO / circuit-court all share this code path:
// the only step left to finish onboarding is POST /user/:id { onboarding_finished: true }).
const baseUser = {
  id: 'user-etg',
  email: 'arnaud-etg-bouce@ambroselli.io',
  roles: [UserRoles.ETG],
  prenom: 'Bouce',
  nom_de_famille: 'AMBRO',
  telephone: '09234',
  addresse_ligne_1: '12 de la Bouce',
  code_postal: '56470',
  ville: 'ST PHILIBERT',
  onboarded_at: null as Date | null,
};

// Saved user returned by prisma.user.update — onboarded_at is now set, every required field present.
const savedUser = {
  ...baseUser,
  onboarded_at: new Date('2026-06-17T07:15:30.000Z'),
} as unknown as User;

describe('POST /user/:id — onboarding_finished', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('unauthenticated → 401', async () => {
    await request(app).post('/user/user-etg').send({ onboarding_finished: true }).expect(401);
  });

  test('cannot finish onboarding for another user → 403', async () => {
    const res = await authed(
      request(app).post('/user/someone-else').send({ onboarding_finished: true }),
      baseUser
    );
    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('finishing onboarding sets onboarded_at and sends both emails', async () => {
    // @ts-expect-error mocked module
    const { sendOnboardingEmailOnce } = await import('~/utils/send-onboarding-email');
    // @ts-expect-error mocked module
    const { sendEmail } = await import('~/third-parties/brevo');

    vi.mocked(prisma.user.update).mockResolvedValue(savedUser);

    const res = await authed(
      request(app).post('/user/user-etg').send({ onboarding_finished: true }),
      baseUser
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // onboarded_at is stamped at write time.
    expect(prisma.user.update).toHaveBeenCalledOnce();
    const updateData = vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.onboarded_at).toBeInstanceOf(Date);

    // Internal notice "Inscription finie" to the Zacharie team.
    expect(sendEmail).toHaveBeenCalledOnce();
    const internalEmail = vi.mocked(sendEmail).mock.calls[0][0];
    expect(internalEmail.emails).toEqual(['contact@zacharie.beta.gouv.fr']);
    expect(internalEmail.subject).toMatch(/Inscription finie/i);
    expect(internalEmail.text).toContain(baseUser.email);

    // "Inscription en examen" mail to the user, deduplicated once per account.
    expect(sendOnboardingEmailOnce).toHaveBeenCalledOnce();
    expect(vi.mocked(sendOnboardingEmailOnce).mock.calls[0][0]).toMatchObject({
      user: savedUser,
      action: 'INSCRIPTION_EN_EXAMEN',
    });
  });

  test('re-finishing onboarding (already onboarded) does not resend onboarding emails', async () => {
    // @ts-expect-error mocked module
    const { sendOnboardingEmailOnce } = await import('~/utils/send-onboarding-email');
    // @ts-expect-error mocked module
    const { sendEmail } = await import('~/third-parties/brevo');

    const alreadyOnboarded = { ...baseUser, onboarded_at: new Date('2026-01-01T00:00:00.000Z') };
    vi.mocked(prisma.user.update).mockResolvedValue({ ...savedUser, ...alreadyOnboarded } as User);

    const res = await authed(
      request(app).post('/user/user-etg').send({ onboarding_finished: true }),
      alreadyOnboarded
    );

    expect(res.status).toBe(200);
    // The write still happens, but no onboarding email is (re)triggered.
    expect(prisma.user.update).toHaveBeenCalledOnce();
    expect(sendOnboardingEmailOnce).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
