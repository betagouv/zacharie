import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminUserRouter from '~/controllers/admin/user';
import { adminAuditLog, redactAdminAuditBody } from '~/middlewares/admin-audit-log';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';

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

const adminUser = { id: 'admin-1', email: 'admin@example.fr', roles: ['CHASSEUR'], isZacharieAdmin: true };

const targetUser = {
  id: 'target-1',
  email: 'cible@example.fr',
  roles: ['CHASSEUR'],
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  activated: true,
  deleted_at: null as Date | null,
  isZacharieAdmin: false,
};

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
app.use(adminAuditLog);
app.use(adminUserRouter);
app.use(sendError);

const create = prisma.adminAuditLog.create as ReturnType<typeof vi.fn>;

async function lastAuditLog() {
  await vi.waitFor(() => expect(create).toHaveBeenCalled());
  return create.mock.calls.at(-1)![0].data;
}

describe('Journal des actions admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('connect-as est journalisé avec l’utilisateur ciblé', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(targetUser);

    const res = await request(app).post('/user/connect-as').send({ email: targetUser.email });

    expect(res.status).toBe(200);
    const log = await lastAuditLog();
    expect(log).toMatchObject({
      admin_user_id: 'admin-1',
      action: 'POST /user/connect-as',
      target_type: 'user',
      target_id: 'target-1',
      status_code: 200,
      body: { email: targetUser.email },
    });
  });

  test('l’édition d’un utilisateur garde les seuls champs modifiés, avant et après', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(targetUser);
    (prisma.user.update as any).mockResolvedValue({ ...targetUser, prenom: 'Paul' });

    const res = await request(app).post('/user/target-1').send({ prenom: 'Paul', nom_de_famille: 'Dupont' });

    expect(res.status).toBe(200);
    const log = await lastAuditLog();
    expect(log).toMatchObject({
      action: 'POST /user/:user_id',
      target_type: 'user',
      target_id: 'target-1',
      params: { user_id: 'target-1' },
      before: { prenom: 'Jean' },
      after: { prenom: 'Paul' },
    });
  });

  test('l’édition refuse plus d’un rôle, et le refus est journalisé', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(targetUser);

    const res = await request(app)
      .post('/user/target-1')
      .send({ roles: ['CHASSEUR', 'ETG'] });

    expect(res.status).toBe(406);
    expect(prisma.user.update).not.toHaveBeenCalled();
    const log = await lastAuditLog();
    expect(log).toMatchObject({
      action: 'POST /user/:user_id',
      target_type: 'user',
      target_id: 'target-1',
      status_code: 406,
    });
  });

  test('les lectures ne sont pas journalisées', async () => {
    (prisma.user.findMany as any).mockResolvedValue([]);
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([]);

    await request(app).get('/users');

    await new Promise((resolve) => setImmediate(resolve));
    expect(create).not.toHaveBeenCalled();
  });

  test('les secrets sont masqués et les gros contenus raccourcis', () => {
    expect(
      redactAdminAuditBody({
        email: 'a@example.fr',
        password: 'secret-secret',
        nested: { token: 'abc' },
        images: ['data:image/png;base64,' + 'A'.repeat(2000)],
        ccgs: Array.from({ length: 102 }, (_, i) => i),
      })
    ).toEqual({
      email: 'a@example.fr',
      password: '[masqué]',
      nested: { token: '[masqué]' },
      images: ['[2022 caractères]'],
      ccgs: [...Array.from({ length: 100 }, (_, i) => i), '[2 éléments de plus]'],
    });
  });
});
