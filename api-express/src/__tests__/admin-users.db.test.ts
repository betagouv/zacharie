import express from 'express';
import request from 'supertest';
import { Prisma, PrismaClient, UserEtgRoles, UserRoles } from '@prisma/client';
import { describe, test, expect, vi, afterAll, afterEach } from 'vitest';
import { MAX_FAILED_ATTEMPTS } from '~/utils/login-lockout';
import prismaClient from '~/prisma';
import adminUserRouter from '~/controllers/admin/user';
import { sendError } from '~/middlewares/errors';

// Le SQL brut de GET /admin/users tourne ici sur une vraie base Postgres (migrations appliquées).
// En CI, VITEST_DB_URL pointe sur la base du job `checks` ; en local, le test est sauté sauf si
// VITEST_DB_URL est posée sur une base jetable (le test y écrit puis supprime ses lignes).
const VITEST_DB_URL = process.env.VITEST_DB_URL;

vi.mock('~/prisma', async () => {
  const { PrismaClient: Client } = await vi.importActual<typeof import('@prisma/client')>('@prisma/client');
  return { default: new Client({ datasourceUrl: process.env.VITEST_DB_URL }) };
});

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContact: vi.fn(),
  updateBrevoContact: vi.fn(),
  updateBrevoChasseurDeal: vi.fn(),
  sendEmail: vi.fn(),
  sendTemplateEmail: vi.fn(),
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));
vi.mock('~/utils/send-onboarding-email', () => ({ sendOnboardingEmailOnce: vi.fn() }));

const PREFIX = 'users-db-test-';

describe.skipIf(!VITEST_DB_URL)('GET /users sur une vraie base', () => {
  const prisma = prismaClient as unknown as PrismaClient;
  const app = express();
  app.use(adminUserRouter);
  app.use(sendError);

  afterEach(async () => {
    await prisma.securityLog.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.carcasse.deleteMany({ where: { fei_numero: { startsWith: PREFIX } } });
    await prisma.fei.deleteMany({ where: { numero: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.officialCfei.deleteMany({ where: { numero_cfei: { startsWith: 'CFEI-USERS-' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(suffix: string, data: Omit<Prisma.UserUncheckedCreateInput, 'id'> = {}) {
    return prisma.user.create({
      data: { id: `${PREFIX}${suffix}`, email: `${PREFIX}${suffix}@example.fr`, ...data },
    });
  }

  // `q` restreint la liste aux lignes du test, quelle que soit la base
  async function list(params: Record<string, string> = {}) {
    const res = await request(app)
      .get('/users')
      .query({ q: PREFIX, ...params });
    expect(res.status).toBe(200);
    return res.body.data as {
      users: Array<{
        id: string;
        nb_carcasses: number;
        nb_fiches: number;
        cfei_validation: string;
        official_cfei: unknown;
        is_blocked: boolean;
      }>;
      total: number;
    };
  }

  async function ids(params: Record<string, string> = {}) {
    return (await list(params)).users.map((user) => user.id.replace(PREFIX, ''));
  }

  test('sans statut coché, les supprimés sont masqués ; les statuts se combinent en OU', async () => {
    await createUser('actif', { activated: true });
    await createUser('inactif', { activated: false });
    await createUser('supprime', { activated: true, deleted_at: new Date() });

    expect((await ids({ tri: 'name_asc' })).sort()).toEqual(['actif', 'inactif']);
    expect(await ids({ statut: 'deactivated' })).toEqual(['inactif']);
    expect(await ids({ statut: 'deleted' })).toEqual(['supprime']);
    expect((await ids({ statut: 'activated,deleted' })).sort()).toEqual(['actif', 'supprime']);
  });

  test('statut bloqué : échecs de connexion récents, comptes supprimés exclus', async () => {
    const bloque = await createUser('bloque');
    await createUser('libre');
    const supprime = await createUser('bloque-supprime', { deleted_at: new Date() });
    for (const email of [bloque.email!, supprime.email!]) {
      await prisma.securityLog.createMany({
        data: Array.from({ length: MAX_FAILED_ATTEMPTS }, () => ({
          email,
          action: 'LOGIN_FAILED_WRONG_PASSWORD',
          created_at: new Date(Date.now() - 60 * 1000),
        })),
      });
    }

    expect(await ids({ statut: 'blocked' })).toEqual(['bloque']);
    const { users } = await list();
    expect(users.find((user) => user.id === bloque.id)?.is_blocked).toBe(true);
    expect(users.find((user) => user.id === `${PREFIX}libre`)?.is_blocked).toBe(false);
  });

  test('rôles, rôles ETG transport / gestion, onboarding et formation', async () => {
    await createUser('chasseur', { roles: [UserRoles.CHASSEUR], est_forme_a_l_examen_initial: true });
    await createUser('etg-transport', { roles: [UserRoles.ETG], etg_role: UserEtgRoles.TRANSPORT });
    await createUser('etg-gestion', {
      roles: [UserRoles.ETG],
      etg_role: UserEtgRoles.RECEPTION,
      onboarded_at: new Date(),
    });

    expect(await ids({ roles: 'CHASSEUR' })).toEqual(['chasseur']);
    expect(await ids({ roles: 'ETG_TRANSPORT' })).toEqual(['etg-transport']);
    expect((await ids({ roles: 'ETG' })).sort()).toEqual(['etg-gestion', 'etg-transport']);
    expect(await ids({ onboarding: 'completed' })).toEqual(['etg-gestion']);
    expect(await ids({ cfei: 'trained' })).toEqual(['chasseur']);
    expect(await ids({ roles: 'INVENTE' })).toHaveLength(3);
  });

  test('validation CFEI comparée à la liste officielle, sans tenir compte de la casse', async () => {
    await prisma.officialCfei.create({
      data: { numero_cfei: 'CFEI-USERS-001', nom: 'Dupont', prenom: 'Jean', departement: '03' },
    });
    await createUser('valide', { numero_cfei: 'cfei-users-001' });
    await createUser('introuvable', { numero_cfei: 'CFEI-USERS-999' });
    await createUser('sans-cfei');

    expect(await ids({ cfei_validation: 'valid' })).toEqual(['valide']);
    expect(await ids({ cfei_validation: 'invalid' })).toEqual(['introuvable']);
    expect(await ids({ cfei_validation: 'missing' })).toEqual(['sans-cfei']);
    const { users } = await list({ cfei_validation: 'valid' });
    expect(users[0]).toMatchObject({
      cfei_validation: 'valid',
      official_cfei: { nom: 'Dupont', prenom: 'Jean', departement: '03' },
    });
  });

  test('recherche : % et _ sont cherchés tels quels', async () => {
    await createUser('cent', { nom_de_famille: 'Cent%Pour' });
    await createUser('autre', { nom_de_famille: 'CentXPour' });

    expect(await ids({ q: 'cent%pour' })).toEqual(['cent']);
  });

  test('tri par nombre de carcasses, pagination et total', async () => {
    const gros = await createUser('gros');
    await createUser('moyen');
    await createUser('vide');
    await prisma.fei.create({ data: { numero: `${PREFIX}fei`, created_by_user_id: gros.id } });
    for (const [index, userId] of [gros.id, gros.id, `${PREFIX}moyen`].entries()) {
      await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id: `${PREFIX}carcasse-${index}`,
          numero_bracelet: `${PREFIX}${index}`,
          fei_numero: `${PREFIX}fei`,
          created_by_user_id: userId,
        },
      });
    }

    const firstPage = await list({ tri: 'carcasses_desc', limit: '2', offset: '0' });
    expect(firstPage.total).toBe(3);
    expect(
      firstPage.users.map((user) => [user.id.replace(PREFIX, ''), user.nb_carcasses, user.nb_fiches])
    ).toEqual([
      ['gros', 2, 1],
      ['moyen', 1, 1],
    ]);
    expect(await ids({ tri: 'carcasses_desc', limit: '2', offset: '2' })).toEqual(['vide']);
  });
});
