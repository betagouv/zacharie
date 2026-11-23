import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, afterEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';

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

const app = express();
app.use(express.json());
app.use('/user', userRouter);
app.use(sendError);

describe('POST /user/login — blocage du compte', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('les tentatives faites pendant le blocage ne prolongent pas le blocage', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await request(app)
      .post('/user/login')
      .send({ email: 'svi@example.fr', passwordUser: 'mauvais-mot-de-passe' });

    expect(prisma.securityLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        email: 'svi@example.fr',
        action: { startsWith: 'LOGIN_FAILED', not: 'LOGIN_FAILED_ALREADY_LOCKED' },
      }),
    });
  });
});
