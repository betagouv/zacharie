import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminUserRouter from '~/controllers/admin/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';

vi.mock('~/third-parties/brevo', () => ({
  createBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoChasseurDeal: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(adminUserRouter);
app.use(sendError);

const officiel = { numero_cfei: 'CFEI-45-13-577', nom: 'DUPONT', prenom: 'Jean', departement: '45' };

describe('GET /users — statut CFEI de chaque compte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).$queryRaw = vi.fn().mockResolvedValue([]);
    (prisma.user.findMany as any).mockResolvedValue([
      { id: 'u-zeros', numero_cfei: 'cfei-045-13-0577' },
      { id: 'u-inconnu', numero_cfei: 'CFEI-45-13-578' },
      { id: 'u-sans', numero_cfei: null },
    ]);
    (prisma.officialCfei.findMany as any).mockImplementation(({ where }: any) =>
      Promise.resolve(where.numero_cfei.in.includes(officiel.numero_cfei) ? [officiel] : [])
    );
  });

  test('renvoie la ligne officielle par id de compte, numéro saisi avec des zéros de tête compris', async () => {
    (prisma.officialCfei.count as any).mockResolvedValue(57000);

    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.body.data.officialCfeis).toEqual({ 'u-zeros': officiel });
    expect(res.body.data.hasOfficialCfeis).toBe(true);
  });

  test('liste officielle vide → hasOfficialCfeis à false', async () => {
    (prisma.officialCfei.count as any).mockResolvedValue(0);

    const res = await request(app).get('/users');

    expect(res.status).toBe(200);
    expect(res.body.data.hasOfficialCfeis).toBe(false);
  });
});
