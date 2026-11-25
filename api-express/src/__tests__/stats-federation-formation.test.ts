import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import statsRouter from '~/controllers/stats';
import { getViewableFederationEntity } from '~/utils/federation-stats';

vi.mock('passport', () => {
  const authenticate = vi.fn(() => (req: any, _res: any, next: any) => {
    req.user = { id: 'user-frc', roles: ['CHASSEUR'] };
    next();
  });
  return { default: { authenticate }, authenticate };
});

vi.mock('~/utils/federation-stats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/utils/federation-stats')>();
  return { ...actual, getViewableFederationEntity: vi.fn() };
});

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));

const app = express();
app.use('/stats', statsRouter);

describe('GET /stats/federation/formation — examinateurs actifs', () => {
  beforeEach(() => {
    vi.mocked(getViewableFederationEntity).mockResolvedValue({
      id: 'federation-frc',
      scope_departements_codes: ['01', '03', '07'],
    } as any);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
  });

  test("un examinateur actif dans deux départements ne compte qu'une fois au total", async () => {
    vi.mocked(prisma.fei.findMany).mockResolvedValue([
      { examinateur_initial_user_id: 'marie', commune_mise_a_mort: '03000 Moulins' },
      { examinateur_initial_user_id: 'marie', commune_mise_a_mort: '07000 Privas' },
      { examinateur_initial_user_id: 'paul', commune_mise_a_mort: '07000 Privas' },
      { examinateur_initial_user_id: 'luc', commune_mise_a_mort: '07000 Privas' },
      { examinateur_initial_user_id: 'zoe', commune_mise_a_mort: '69000 Lyon' },
    ] as any);

    const res = await request(app).get('/stats/federation/formation');

    expect(res.status).toBe(200);
    expect(res.body.data.totals.examinateursActifs).toBe(3);
    const parDept = Object.fromEntries(
      res.body.data.departements.map((d: { code: string; examinateursActifs: number }) => [
        d.code,
        d.examinateursActifs,
      ])
    );
    expect(parDept).toEqual({ '03': 1, '07': 3 });
  });

  test('le comptage porte sur tout gibier : aucun filtre sur le type de carcasse', async () => {
    vi.mocked(prisma.fei.findMany).mockResolvedValue([]);

    await request(app).get('/stats/federation/formation');

    const where = vi.mocked(prisma.fei.findMany).mock.calls.at(-1)![0]!.where as any;
    expect(where.Carcasses.some).not.toHaveProperty('type');
  });
});
