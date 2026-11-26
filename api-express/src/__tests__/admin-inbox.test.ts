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

describe('GET /inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).user.count = vi
      .fn()
      .mockImplementation(({ where }: { where: { activated?: boolean } }) =>
        Promise.resolve(where.activated === false ? 2 : 3)
      );
    (prisma as any).entity.count = vi.fn().mockResolvedValue(4);
    // le premier numéro est saisi avec des zéros de tête : il correspond quand même à la liste officielle
    (prisma as any).user.findMany = vi
      .fn()
      .mockResolvedValue([
        { numero_cfei: 'cfei-045-13-0577' },
        { numero_cfei: 'CFEI-99-99-998' },
        { numero_cfei: 'CFEI-99-99-999' },
      ]);
    (prisma as any).officialCfei.findMany = vi
      .fn()
      .mockImplementation(({ where }) =>
        Promise.resolve(
          where.numero_cfei.in.includes('CFEI-45-13-577')
            ? [{ numero_cfei: 'CFEI-45-13-577', nom: null, prenom: null, departement: '45' }]
            : []
        )
      );
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([compteBloque]);
  });

  test('renvoie les compteurs de chaque catégorie et la liste des comptes bloqués', async () => {
    const res = await request(app).get('/inbox');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        en_attente_activation: 2,
        cfei_introuvable: 2,
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

  test('la requête des comptes bloqués lit les blocages de la fenêtre', async () => {
    await request(app).get('/inbox');

    const lockoutCall = (
      (prisma as any).$queryRaw.mock.calls as Array<[TemplateStringsArray, ...unknown[]]>
    ).find(([strings]) => strings.join('?').includes('"SecurityLog"'));
    expect(lockoutCall).toBeDefined();
    const [strings, ...values] = lockoutCall!;
    expect(strings.join('?')).toContain('u.deleted_at IS NULL');
    expect(values).toContain('LOGIN_LOCKED');
    expect(values).toContain(15);
  });
});
