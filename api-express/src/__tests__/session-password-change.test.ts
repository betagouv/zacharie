import express from 'express';
import request from 'supertest';
import passport from 'passport';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '~/prisma';
import { isTokenRevokedByPasswordChange } from '~/utils/session-token';
import { hashPassword } from '~/service/crypto';
import '~/middlewares/passport';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';

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

const nowInSeconds = () => Math.floor(Date.now() / 1000);

type Verify = (payload: object, done: (error: Error | null, user: unknown, info?: unknown) => void) => void;
// lu avant tout vi.clearAllMocks() : passport.use est appelé une seule fois, au chargement de middlewares/passport
const verifyByStrategy = Object.fromEntries(
  // passport-jwt garde la fonction de vérification dans `_verify`
  vi.mocked(passport.use).mock.calls.map((c) => [c[0], (c[1] as unknown as { _verify: Verify })._verify])
) as Record<'user' | 'admin', Verify>;
function authenticate(name: 'user' | 'admin', payload: object) {
  return new Promise<unknown>((resolve, reject) =>
    verifyByStrategy[name](payload, (error, user) => (error ? reject(error) : resolve(user)))
  );
}

describe('isTokenRevokedByPasswordChange', () => {
  const changedAt = new Date('2026-11-23T12:00:00.500Z');
  const changedAtSeconds = Math.floor(changedAt.getTime() / 1000);

  test('jamais changé : jeton accepté', () => {
    expect(isTokenRevokedByPasswordChange({ iat: 1 }, null)).toBe(false);
  });
  test('jeton émis avant le changement : refusé', () => {
    expect(isTokenRevokedByPasswordChange({ iat: changedAtSeconds - 1 }, changedAt)).toBe(true);
  });
  test('jeton émis dans la même seconde ou après : accepté', () => {
    expect(isTokenRevokedByPasswordChange({ iat: changedAtSeconds }, changedAt)).toBe(false);
    expect(isTokenRevokedByPasswordChange({ iat: changedAtSeconds + 60 }, changedAt)).toBe(false);
  });
  test('jeton sans iat : refusé', () => {
    expect(isTokenRevokedByPasswordChange({}, changedAt)).toBe(true);
  });
});

describe('stratégies passport user et admin', () => {
  const user = {
    id: 'USER1',
    email: 'chasseur@example.fr',
    deleted_at: null as Date | null,
    isZacharieAdmin: true,
  };

  afterEach(() => vi.clearAllMocks());

  for (const name of ['user', 'admin'] as const) {
    test(`${name} : jeton émis avant le changement de mot de passe → refusé`, async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        ...user,
        Password: { password_changed_at: new Date() },
      } as never);
      const payload = { userId: 'USER1', iat: nowInSeconds() - 3600, proconnect_at: nowInSeconds() };
      expect(await authenticate(name, payload)).toBeNull();
    });

    test(`${name} : jeton émis après le changement → accepté, sans le mot de passe`, async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        ...user,
        Password: { password_changed_at: new Date(Date.now() - 3600 * 1000) },
      } as never);
      const payload = { userId: 'USER1', iat: nowInSeconds(), proconnect_at: nowInSeconds() };
      const authenticated = (await authenticate(name, payload)) as Record<string, unknown>;
      expect(authenticated.id).toBe('USER1');
      expect(authenticated).not.toHaveProperty('Password');
    });

    test(`${name} : mot de passe jamais changé → accepté`, async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        ...user,
        Password: { password_changed_at: null },
      } as never);
      const payload = { userId: 'USER1', iat: nowInSeconds() - 3600, proconnect_at: nowInSeconds() };
      expect(((await authenticate(name, payload)) as { id: string }).id).toBe('USER1');
    });
  }
});

describe('routes de mot de passe', () => {
  const app = express();
  app.use(express.json());
  app.use('/user', userRouter);
  app.use(sendError);

  const chasseur = { id: 'USER1', email: 'chasseur@example.fr' };

  beforeEach(() => {
    vi.mocked(prisma.user.update).mockResolvedValue(chasseur as never);
  });
  afterEach(() => vi.clearAllMocks());

  test('changement de mot de passe : pose password_changed_at', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValueOnce({
      user_id: 'USER1',
      password: await hashPassword('ancien-mot-de-passe'),
    } as never);
    const res = await request(app)
      .post('/user/change-password')
      .set('x-test-user', JSON.stringify(chasseur))
      .send({ currentPassword: 'ancien-mot-de-passe', newPassword: 'nouveau-mot-de-passe' });

    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.password.update).mock.calls[0][0].data;
    expect(data.password_changed_at).toBeInstanceOf(Date);
  });

  test('réinitialisation du mot de passe : pose password_changed_at', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValueOnce({
      id: 'PWD1',
      user_id: 'USER1',
      reset_password_last_email_sent_at: new Date(),
      User: chasseur,
    } as never);
    const res = await request(app)
      .post('/user/reset-password')
      .send({ passwordUser: 'nouveau-mot-de-passe', resetPasswordToken: 'token' });

    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.password.update).mock.calls[0][0].data;
    expect(data.password_changed_at).toBeInstanceOf(Date);
  });
});
