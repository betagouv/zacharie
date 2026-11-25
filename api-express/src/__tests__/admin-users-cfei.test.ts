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

describe('GET /user/:user_id — ligne officielle du compte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.entity.findMany as any).mockResolvedValue([]);
    (prisma as any).securityLog.findFirst = vi.fn().mockResolvedValue(null);
    (prisma as any).securityLog.findMany = vi.fn().mockResolvedValue([]);
    (prisma as any).securityLog.count = vi.fn().mockResolvedValue(0);
    (prisma as any).password.findUnique = vi.fn().mockResolvedValue(null);
    (prisma.officialCfei.findMany as any).mockImplementation(({ where }: any) =>
      Promise.resolve(where.numero_cfei.in.includes(officiel.numero_cfei) ? [officiel] : [])
    );
  });

  test('numéro saisi avec des zéros de tête → ligne officielle trouvée', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u-zeros',
      email: 'u@example.fr',
      roles: ['CHASSEUR'],
      numero_cfei: 'cfei-045-13-0577',
    });

    const res = await request(app).get('/user/u-zeros');

    expect(res.status).toBe(200);
    expect(res.body.data.officialCfei).toEqual(officiel);
  });

  test('numéro absent de la liste → null', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u-inconnu',
      email: 'v@example.fr',
      roles: ['CHASSEUR'],
      numero_cfei: 'CFEI-45-13-578',
    });

    const res = await request(app).get('/user/u-inconnu');

    expect(res.status).toBe(200);
    expect(res.body.data.officialCfei).toBeNull();
  });
});
