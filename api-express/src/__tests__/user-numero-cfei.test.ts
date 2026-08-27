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

const chasseur = {
  id: 'user-chasseur',
  email: 'chasseur@example.fr',
  roles: [UserRoles.CHASSEUR],
  prenom: 'Jean',
  nom_de_famille: 'CHASSEUR',
  telephone: '09234',
  addresse_ligne_1: '12 de la Bouce',
  code_postal: '56470',
  ville: 'ST PHILIBERT',
  est_forme_a_l_examen_initial: true,
  numero_cfei: null as string | null,
  activated: true,
  activated_at: new Date('2026-01-01T00:00:00.000Z'),
  onboarded_at: new Date('2026-01-01T00:00:00.000Z') as Date | null,
};

function updateData() {
  return vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<string, unknown>;
}

async function mocks() {
  // @ts-expect-error mocked module
  const { sendEmail } = await import('~/third-parties/brevo');
  return { sendEmail: vi.mocked(sendEmail) };
}

describe('POST /user/:id — numero_cfei', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('chasseur déjà inscrit qui renseigne son numéro → notice interne + compte désactivé', async () => {
    const { sendEmail } = await mocks();
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...chasseur,
      numero_cfei: 'CFEI-056-24-123',
      activated: false,
    } as unknown as User);

    const res = await authed(
      request(app).post('/user/user-chasseur').send({ numero_cfei: 'CFEI-056-24-123' }),
      chasseur
    );

    expect(res.status).toBe(200);
    expect(updateData().numero_cfei).toBe('CFEI-056-24-123');
    expect(updateData().activated).toBe(false);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/Numéro CFEI changé/i);
  });

  test("pendant l'inscription (onboarded_at null) → pas de notice interne", async () => {
    const { sendEmail } = await mocks();
    const enCoursDInscription = { ...chasseur, onboarded_at: null };
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...enCoursDInscription,
      numero_cfei: 'CFEI-056-24-123',
      activated: false,
    } as unknown as User);

    const res = await authed(
      request(app).post('/user/user-chasseur').send({ numero_cfei: 'CFEI-056-24-123' }),
      enCoursDInscription
    );

    expect(res.status).toBe(200);
    expect(updateData().numero_cfei).toBe('CFEI-056-24-123');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('champ laissé vide → numéro null, ni notice interne ni désactivation', async () => {
    const { sendEmail } = await mocks();
    vi.mocked(prisma.user.update).mockResolvedValue(chasseur as unknown as User);

    const res = await authed(request(app).post('/user/user-chasseur').send({ numero_cfei: null }), chasseur);

    expect(res.status).toBe(200);
    expect(updateData().numero_cfei).toBeNull();
    expect(updateData().activated).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('même numéro renvoyé (blur sans modification) → aucun effet', async () => {
    const { sendEmail } = await mocks();
    const avecNumero = { ...chasseur, numero_cfei: 'CFEI-056-24-123' };
    vi.mocked(prisma.user.update).mockResolvedValue(avecNumero as unknown as User);

    const res = await authed(
      request(app).post('/user/user-chasseur').send({ numero_cfei: ' CFEI-056-24-123 ' }),
      avecNumero
    );

    expect(res.status).toBe(200);
    expect(updateData().numero_cfei).toBe('CFEI-056-24-123');
    expect(updateData().activated).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
