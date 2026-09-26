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

vi.mock('~/service/crypto', () => ({
  comparePassword: vi.fn(async (password: string) => password === 'bon-mot-de-passe'),
  hashPassword: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

const passwordFindFirst = vi.fn();
(prisma.password as unknown as { findFirst: typeof passwordFindFirst }).findFirst = passwordFindFirst;

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
    passwordFindFirst.mockResolvedValue({ user_id: chasseur.id, password: 'hash' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.update).mockImplementation(
      (args) => Promise.resolve({ ...chasseur, ...args.data } as unknown as User) as never
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('email inchangé (à la casse près) → pas de mot de passe demandé', async () => {
    const res = await post({ email: 'Chasseur@Example.fr', prenom: 'Jean' });

    expect(res.status).toBe(200);
    expect(passwordFindFirst).not.toHaveBeenCalled();
    expect(securityLogActions()).toEqual([]);
  });

  test('nouvel email sans mot de passe → 403, rien enregistré', async () => {
    const res = await post({ email: 'autre@example.fr' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Veuillez renseigner votre mot de passe actuel pour changer votre email');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(securityLogActions()).toEqual(['EMAIL_CHANGE_FAILED_WRONG_PASSWORD']);
  });

  test('nouvel email avec un mauvais mot de passe → 403, rien enregistré', async () => {
    const res = await post({ email: 'autre@example.fr', currentPassword: 'mauvais' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Mot de passe actuel incorrect');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(securityLogActions()).toEqual(['EMAIL_CHANGE_FAILED_WRONG_PASSWORD']);
  });

  test('trop de tentatives récentes → 429 sans vérifier le mot de passe', async () => {
    vi.mocked(prisma.securityLog.count).mockResolvedValueOnce(10);

    const res = await post({ email: 'autre@example.fr', currentPassword: 'bon-mot-de-passe' });

    expect(res.status).toBe(429);
    expect(passwordFindFirst).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('compte sans mot de passe → 403, renvoi vers « mot de passe oublié »', async () => {
    passwordFindFirst.mockResolvedValue(null);

    const res = await post({ email: 'autre@example.fr', currentPassword: 'bon-mot-de-passe' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Mot de passe oublié/);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(securityLogActions()).toEqual(['EMAIL_CHANGE_FAILED_NO_PASSWORD']);
  });

  test('email déjà pris → 409, rien enregistré', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'autre' } as unknown as User);

    const res = await post({ email: 'autre@example.fr', currentPassword: 'bon-mot-de-passe' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Un compte existe déjà avec cet email');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('bon mot de passe → email changé et tracé', async () => {
    const res = await post({ email: 'Autre@Example.fr', currentPassword: 'bon-mot-de-passe' });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data.email).toBe('autre@example.fr');
    expect(securityLogActions()).toEqual(['EMAIL_CHANGED']);
  });
});
