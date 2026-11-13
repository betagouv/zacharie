import express from 'express';
import request from 'supertest';
import dayjs from 'dayjs';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminInboxRouter from '~/controllers/admin/inbox';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';

const app = express();
app.use(express.json());
app.use(adminInboxRouter);
app.use(sendError);

const compteBloque = {
  id: 'user-1',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  email: 'locked@example.fr',
};

function isSqlFragment(value: unknown): value is { sql: string; values: Array<unknown> } {
  return typeof value === 'object' && value !== null && typeof (value as { sql?: unknown }).sql === 'string';
}

describe('GET /inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).user.count = vi
      .fn()
      .mockImplementation(({ where }: { where: { activated?: boolean } }) =>
        Promise.resolve(where.activated === false ? 2 : 3)
      );
    (prisma as any).entity.count = vi.fn().mockResolvedValue(4);
    (prisma as any).$queryRaw = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('"OfficialCfei"')) return Promise.resolve([{ count: 1 }]);
      return Promise.resolve([compteBloque]);
    });
  });

  test('renvoie les compteurs de chaque catégorie et la liste des comptes bloqués', async () => {
    const res = await request(app).get('/inbox');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        en_attente_activation: 2,
        cfei_introuvable: 1,
        onboarding_incomplet: 3,
        comptes_bloques: [compteBloque],
        entites_non_pretes: 4,
      },
      error: '',
    });
  });

  test('les comptes et entités supprimés sont exclus, l’onboarding incomplet ne compte que les comptes de plus de 7 jours', async () => {
    await request(app).get('/inbox');

    const userCountCalls = (prisma.user.count as any).mock.calls.map(
      ([args]: [{ where: Record<string, unknown> }]) => args.where
    );
    expect(userCountCalls).toContainEqual({
      activated: false,
      onboarded_at: { not: null },
      deleted_at: null,
    });
    const onboardingWhere = userCountCalls.find(
      (where: Record<string, unknown>) => where.onboarded_at === null
    ) as { created_at: { lt: Date }; deleted_at: null };
    expect(onboardingWhere.deleted_at).toBeNull();
    const seuil = dayjs(onboardingWhere.created_at.lt);
    expect(Math.abs(seuil.diff(dayjs().subtract(7, 'day'), 'minute'))).toBeLessThan(1);

    expect(prisma.entity.count).toHaveBeenCalledWith({
      where: { zacharie_compatible: false, deleted_at: null },
    });
  });

  test('la requête des comptes bloqués applique le seuil d’échecs de connexion', async () => {
    await request(app).get('/inbox');

    // la sous-requête des emails bloqués est un fragment Prisma.Sql passé en valeur de la requête
    const lockoutCall = (
      (prisma as any).$queryRaw.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>
    ).find(([, ...values]) => values.some(isSqlFragment));
    expect(lockoutCall).toBeDefined();
    const [strings, ...values] = lockoutCall!;
    const lockedEmails = values.find(isSqlFragment)!;
    expect(lockedEmails.sql).toContain('"SecurityLog"');
    expect(lockedEmails.sql).toContain("LIKE 'LOGIN_FAILED%'");
    expect(strings.join('?')).toContain('u.deleted_at IS NULL');
    expect(lockedEmails.values).toContain(5);
  });
});
