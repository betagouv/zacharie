import express from 'express';
import request from 'supertest';
import dayjs from 'dayjs';
import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { inviteUser } from '~/utils/invite-user';
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

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

const BASE = '/user/signup-with-invitation-token';
const email = 'invite@example.fr';
const token = 'jeton-123';
const user = { id: 'user-1', email };

function passwordRow(overrides: { password: string; sentAt: Date }) {
  return {
    id: 'password-1',
    user_id: user.id,
    password: overrides.password,
    reset_password_token: token,
    reset_password_last_email_sent_at: overrides.sentAt,
  };
}

function signup() {
  return request(app)
    .post(BASE)
    .send({ email, passwordUser: 'nouveau-mot-de-passe', invitationToken: token });
}

describe('POST /user/signup-with-invitation-token', () => {
  beforeAll(() => {
    (prisma.password as any).delete = vi.fn();
    (prisma.entityAndUserRelations as any).deleteMany = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(prisma.user.update).mockResolvedValue(user as any);
  });

  function expectNothingWritten() {
    expect(prisma.password.update).not.toHaveBeenCalled();
    expect((prisma.password as any).delete).not.toHaveBeenCalled();
    expect((prisma.entityAndUserRelations as any).deleteMany).not.toHaveBeenCalled();
  }

  test('un jeton de réinitialisation (compte avec mot de passe) est refusé avant 7 jours', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValue(
      passwordRow({ password: 'hash-existant', sentAt: new Date() }) as any
    );
    const res = await signup().expect(400);
    expect(res.body.data.token).toBeUndefined();
    expectNothingWritten();
  });

  test('un jeton de réinitialisation rejoué après 7 jours est refusé sans rien supprimer', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValue(
      passwordRow({ password: 'hash-existant', sentAt: dayjs().subtract(10, 'days').toDate() }) as any
    );
    await signup().expect(400);
    expectNothingWritten();
  });

  test('une invitation expirée renvoie 400 sans supprimer le mot de passe ni les relations', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValue(
      passwordRow({ password: '', sentAt: dayjs().subtract(10, 'days').toDate() }) as any
    );
    const res = await signup().expect(400);
    expect(res.body.error).toContain("n'est plus valide");
    expectNothingWritten();
  });

  test('une invitation valide crée le mot de passe et ouvre la session', async () => {
    vi.mocked(prisma.password.findFirst).mockResolvedValue(
      passwordRow({ password: '', sentAt: new Date() }) as any
    );
    const res = await signup().expect(200);
    expect(res.body.data.token).toBeTruthy();
    expect(prisma.password.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reset_password_token: null }),
      })
    );
  });
});

describe('inviteUser', () => {
  const me = { prenom: 'Jean', nom_de_famille: 'Dupont' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renvoie un nouveau lien d'invitation à un compte qui n'a jamais créé son mot de passe", async () => {
    vi.mocked(prisma.password.findUnique).mockResolvedValue(
      passwordRow({ password: '', sentAt: dayjs().subtract(10, 'days').toDate() }) as any
    );
    await inviteUser(user as any, me as any);
    expect(prisma.password.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: user.id },
        update: expect.objectContaining({ reset_password_token: expect.any(String) }),
      })
    );
    expect(vi.mocked(sendEmail).mock.calls[0][0].text).toContain('invitation-token=');
  });

  test('ne touche pas au jeton d’un compte qui a déjà un mot de passe', async () => {
    vi.mocked(prisma.password.findUnique).mockResolvedValue(
      passwordRow({ password: 'hash-existant', sentAt: new Date() }) as any
    );
    await inviteUser(user as any, me as any);
    expect(prisma.password.upsert).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0][0].text).not.toContain('invitation-token=');
  });
});

describe('POST /user/forget-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
  });

  function forgetPassword() {
    return request(app).post('/user/forget-password').send({ email });
  }

  test("n'envoie pas de lien et ne touche pas au jeton d'invitation d'un compte sans mot de passe", async () => {
    vi.mocked(prisma.password.findUnique).mockResolvedValue(
      passwordRow({ password: '', sentAt: new Date() }) as any
    );
    const res = await forgetPassword().expect(200);
    expect(res.body.message).toContain('Si cet email existe');
    expect(prisma.password.update).not.toHaveBeenCalled();
    expect(prisma.password.upsert).not.toHaveBeenCalled();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  test("n'envoie pas de lien à un compte sans ligne de mot de passe", async () => {
    vi.mocked(prisma.password.findUnique).mockResolvedValue(null);
    await forgetPassword().expect(200);
    expect(prisma.password.upsert).not.toHaveBeenCalled();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  test('envoie un lien de réinitialisation à un compte qui a un mot de passe', async () => {
    vi.mocked(prisma.password.findUnique).mockResolvedValue(
      passwordRow({ password: 'hash-existant', sentAt: new Date() }) as any
    );
    await forgetPassword().expect(200);
    expect(prisma.password.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: user.id },
        data: expect.objectContaining({ reset_password_token: expect.any(String) }),
      })
    );
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
  });
});
