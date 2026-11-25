import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { describe, test, expect, vi, afterEach, afterAll } from 'vitest';
import prismaClient from '~/prisma';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import {
  getLockoutExpiresAt,
  getLockoutState,
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_ATTEMPTS,
} from '~/utils/login-lockout';

const VITEST_DB_URL = process.env.VITEST_DB_URL;

vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return { default: new Client({ datasourceUrl: process.env.VITEST_DB_URL }) };
});

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

const EMAIL = 'login-lockout-db-test@example.fr';
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

describe.skipIf(!VITEST_DB_URL)('POST /user/login — blocage du compte sur une vraie base', () => {
  const prisma = prismaClient as unknown as PrismaClient;
  const app = express();
  app.use(express.json());
  app.use('/user', userRouter);
  app.use(sendError);

  afterEach(async () => {
    await prisma.securityLog.deleteMany({ where: { email: EMAIL } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function login() {
    return request(app).post('/user/login').send({ email: EMAIL, passwordUser: 'mauvais-mot-de-passe' });
  }

  async function log(action: string, at: Date, count = 1) {
    await prisma.securityLog.createMany({
      data: Array.from({ length: count }, () => ({ email: EMAIL, action, created_at: at })),
    });
  }

  test(`le ${MAX_FAILED_ATTEMPTS}e échec bloque le compte, les tentatives suivantes sont refusées`, async () => {
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      expect((await login()).status).toBe(400);
    }
    expect((await login()).status).toBe(429);
    expect((await login()).status).toBe(429);
    expect(await prisma.securityLog.count({ where: { email: EMAIL, action: 'LOGIN_LOCKED' } })).toBe(1);
  });

  test('le blocage dure 15 minutes à partir du blocage, même si les premiers échecs sortent de la fenêtre', async () => {
    const lockedAt = minutesAgo(LOCKOUT_DURATION_MINUTES - 1);
    await log(
      'LOGIN_FAILED_WRONG_PASSWORD',
      minutesAgo(LOCKOUT_DURATION_MINUTES + 5),
      MAX_FAILED_ATTEMPTS - 1
    );
    await log('LOGIN_FAILED_WRONG_PASSWORD', lockedAt);
    await log('LOGIN_LOCKED', lockedAt);

    expect((await login()).status).toBe(429);
    const state = await getLockoutState(EMAIL);
    expect(state.locked_at?.getTime()).toBe(lockedAt.getTime());
    expect(getLockoutExpiresAt(state.locked_at!).getTime()).toBe(
      lockedAt.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000
    );
  });

  test('après la fin du blocage, un seul échec ne rebloque pas le compte', async () => {
    const lockedAt = minutesAgo(LOCKOUT_DURATION_MINUTES + 1);
    await log('LOGIN_FAILED_WRONG_PASSWORD', lockedAt, MAX_FAILED_ATTEMPTS);
    await log('LOGIN_LOCKED', lockedAt);
    await log('LOGIN_FAILED_ALREADY_LOCKED', minutesAgo(5), 20);

    expect((await login()).status).toBe(400);
  });

  test('un déblocage admin lève le blocage et remet le compteur à zéro', async () => {
    await log('LOGIN_FAILED_WRONG_PASSWORD', minutesAgo(5), MAX_FAILED_ATTEMPTS);
    await log('LOGIN_LOCKED', minutesAgo(5));
    await log('LOGIN_UNLOCK_FROM_ADMIN', minutesAgo(4));

    expect((await login()).status).toBe(400);
  });
});
