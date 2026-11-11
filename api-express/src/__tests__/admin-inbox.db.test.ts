import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { LOCKOUT_DURATION_MINUTES, MAX_FAILED_ATTEMPTS } from '~/utils/login-lockout';
import prismaClient from '~/prisma';
import adminInboxRouter from '~/controllers/admin/inbox';
import { sendError } from '~/middlewares/errors';

// Le SQL brut de GET /admin/inbox tourne ici sur une vraie base Postgres (migrations appliquées).
// En CI, VITEST_DB_URL pointe sur la base du job `checks` ; en local, le test est sauté sauf si
// VITEST_DB_URL est posée sur une base jetable (le test y écrit puis supprime ses lignes).
const VITEST_DB_URL = process.env.VITEST_DB_URL;

vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return { default: new Client({ datasourceUrl: process.env.VITEST_DB_URL }) };
});

const PREFIX = 'inbox-db-test-';
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

describe.skipIf(!VITEST_DB_URL)('GET /inbox sur une vraie base', () => {
  // le client de la route se connecte à sa première requête, après le changement de fuseau de beforeAll
  const prisma = prismaClient as unknown as PrismaClient;
  const app = express();
  app.use(adminInboxRouter);
  app.use(sendError);
  let databaseName: string;

  beforeAll(async () => {
    // Fuseau de session différent d'UTC : la borne de la fenêtre de blocage doit rester juste.
    // Posé sur la base avant la première connexion du client de la route.
    const admin = new PrismaClient({ datasourceUrl: VITEST_DB_URL });
    const [{ current_database }] = await admin.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;
    databaseName = current_database;
    await admin.$executeRawUnsafe(`ALTER DATABASE "${databaseName}" SET timezone TO 'Pacific/Auckland'`);
    await admin.$disconnect();
  });

  afterEach(async () => {
    await prisma.securityLog.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.officialCfei.deleteMany({ where: { numero_cfei: { startsWith: 'CFEI-INBOX-' } } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`ALTER DATABASE "${databaseName}" RESET timezone`);
    await prisma.$disconnect();
  });

  async function createUser(suffix: string, data: { numero_cfei?: string; deleted_at?: Date } = {}) {
    return prisma.user.create({
      data: { id: `${PREFIX}${suffix}`, email: `${PREFIX}${suffix}@example.fr`, ...data },
    });
  }

  async function logLoginFailures(email: string, count: number, at: Date) {
    await prisma.securityLog.createMany({
      data: Array.from({ length: count }, () => ({
        email,
        action: 'LOGIN_FAILED_WRONG_PASSWORD',
        created_at: at,
      })),
    });
  }

  async function logUnlock(email: string, at: Date) {
    await prisma.securityLog.create({ data: { email, action: 'LOGIN_UNLOCK_FROM_ADMIN', created_at: at } });
  }

  async function comptesBloquesIds() {
    const res = await request(app).get('/inbox');
    expect(res.status).toBe(200);
    return (res.body.data.comptes_bloques as Array<{ id: string }>)
      .map((compte) => compte.id)
      .filter((id) => id.startsWith(PREFIX));
  }

  test('le fuseau de la session de test n’est pas UTC', async () => {
    const [{ timezone }] = await prisma.$queryRaw<
      Array<{ timezone: string }>
    >`SELECT current_setting('TimeZone') AS timezone`;
    expect(timezone).toBe('Pacific/Auckland');
  });

  test(`${MAX_FAILED_ATTEMPTS} échecs récents bloquent le compte, un de moins ne le bloque pas`, async () => {
    const bloque = await createUser('bloque');
    const presque = await createUser('presque');
    await logLoginFailures(bloque.email!, MAX_FAILED_ATTEMPTS, minutesAgo(1));
    await logLoginFailures(presque.email!, MAX_FAILED_ATTEMPTS - 1, minutesAgo(1));

    expect(await comptesBloquesIds()).toEqual([bloque.id]);
  });

  test('des échecs plus anciens que la fenêtre de blocage ne comptent pas', async () => {
    const ancien = await createUser('ancien');
    const limite = await createUser('limite');
    await logLoginFailures(ancien.email!, MAX_FAILED_ATTEMPTS, minutesAgo(LOCKOUT_DURATION_MINUTES + 1));
    await logLoginFailures(limite.email!, MAX_FAILED_ATTEMPTS, minutesAgo(LOCKOUT_DURATION_MINUTES - 1));

    expect(await comptesBloquesIds()).toEqual([limite.id]);
  });

  test('un déblocage admin remet le compteur à zéro, les échecs suivants comptent de nouveau', async () => {
    const debloque = await createUser('debloque');
    const rebloque = await createUser('rebloque');
    await logLoginFailures(debloque.email!, MAX_FAILED_ATTEMPTS, minutesAgo(5));
    await logUnlock(debloque.email!, minutesAgo(4));
    await logUnlock(rebloque.email!, minutesAgo(6));
    await logLoginFailures(rebloque.email!, MAX_FAILED_ATTEMPTS, minutesAgo(5));

    expect(await comptesBloquesIds()).toEqual([rebloque.id]);
  });

  test('un compte supprimé n’apparaît pas parmi les comptes bloqués', async () => {
    const supprime = await createUser('supprime', { deleted_at: new Date() });
    await logLoginFailures(supprime.email!, MAX_FAILED_ATTEMPTS, minutesAgo(1));

    expect(await comptesBloquesIds()).toEqual([]);
  });

  test('CFEI introuvable : comparaison sans tenir compte de la casse, comptes supprimés exclus', async () => {
    const avant = (await request(app).get('/inbox')).body.data.cfei_introuvable as number;
    await prisma.officialCfei.create({ data: { numero_cfei: 'CFEI-INBOX-001' } });
    await createUser('cfei-officiel', { numero_cfei: 'cfei-inbox-001' });
    await createUser('cfei-inconnu', { numero_cfei: 'CFEI-INBOX-999' });
    await createUser('cfei-inconnu-supprime', { numero_cfei: 'CFEI-INBOX-998', deleted_at: new Date() });

    const apres = (await request(app).get('/inbox')).body.data.cfei_introuvable as number;
    expect(apres - avant).toBe(1);
  });
});
