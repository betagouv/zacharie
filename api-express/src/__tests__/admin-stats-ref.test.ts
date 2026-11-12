import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import prisma from '~/prisma';
import statsRefRouter from '~/controllers/admin/stats-ref';
import adminRouter from '~/controllers/admin';
import { adminAuditLog } from '~/middlewares/admin-audit-log';
import { sendError } from '~/middlewares/errors';

// Références nationales des KPI Metabase : CRUD admin, derrière le garde admin et journalisé.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'admin-1', email: 'admin@example.fr', roles: ['CHASSEUR'], isZacharieAdmin: true };
  next();
});
app.use(adminAuditLog);
app.use('/admin', statsRefRouter);
app.use(sendError);

// Application réelle : le routeur admin applique son authentification avant de monter ses sous-routeurs
const appAvecGarde = express();
appAvecGarde.use(express.json());
appAvecGarde.use('/admin', adminRouter);

const body = {
  saison: '2022-2023',
  circuit: 'LONG',
  type_gibier: 'GROS_GIBIER',
  indicateur: 'VOLUME_GLOBAL',
  valeur: 60000,
  source: 'estimation 2022',
};

const ligne = {
  id: 'ref-1',
  ...body,
  created_at: new Date('2026-11-10'),
  updated_at: new Date('2026-11-10'),
};

const auditCreate = prisma.adminAuditLog.create as ReturnType<typeof vi.fn>;

async function lastAuditLog() {
  await vi.waitFor(() => expect(auditCreate).toHaveBeenCalled());
  return auditCreate.mock.calls.at(-1)![0].data;
}

function doublon() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('garde admin', () => {
  test('la liste n’est pas accessible sans authentification admin', async () => {
    const res = await request(appAvecGarde).get('/admin/stats-ref');

    expect(res.status).toBe(401);
    expect(prisma.statsRefNational.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /admin/stats-ref', () => {
  test('renvoie les références triées par saison décroissante', async () => {
    vi.mocked(prisma.statsRefNational.findMany).mockResolvedValue([ligne] as never);

    const res = await request(app).get('/admin/stats-ref');

    expect(res.status).toBe(200);
    expect(res.body.data.statsRefs).toHaveLength(1);
    expect(prisma.statsRefNational.findMany).toHaveBeenCalledWith({
      orderBy: [{ saison: 'desc' }, { indicateur: 'asc' }, { circuit: 'asc' }, { type_gibier: 'asc' }],
    });
  });
});

describe('POST /admin/stats-ref', () => {
  test('crée une référence valide, source vide enregistrée à null', async () => {
    vi.mocked(prisma.statsRefNational.create).mockResolvedValue(ligne as never);

    const res = await request(app)
      .post('/admin/stats-ref')
      .send({ ...body, source: '' });

    expect(res.status).toBe(200);
    expect(prisma.statsRefNational.create).toHaveBeenCalledWith({ data: { ...body, source: null } });
  });

  test('refuse une saison qui ne couvre pas deux années consécutives', async () => {
    const res = await request(app)
      .post('/admin/stats-ref')
      .send({ ...body, saison: '2025-2027' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La saison doit couvrir deux années consécutives (ex. 2025-2026)');
    expect(prisma.statsRefNational.create).not.toHaveBeenCalled();
  });

  test('refuse un taux supérieur à 100 %', async () => {
    const res = await request(app)
      .post('/admin/stats-ref')
      .send({ ...body, indicateur: 'TAUX_SAISIE', valeur: 120 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Un taux ou un objectif est un pourcentage : 100 au maximum');
  });

  test('refuse un doublon (saison, circuit, gibier, indicateur) avec un 409', async () => {
    vi.mocked(prisma.statsRefNational.create).mockRejectedValue(doublon());

    const res = await request(app).post('/admin/stats-ref').send(body);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Cette référence existe déjà pour cette saison, ce circuit, ce gibier et cet indicateur'
    );
  });
});

describe('PUT /admin/stats-ref/:id', () => {
  test('404 sur une référence inconnue', async () => {
    vi.mocked(prisma.statsRefNational.findUnique).mockResolvedValue(null);

    const res = await request(app).put('/admin/stats-ref/inconnue').send(body);

    expect(res.status).toBe(404);
    expect(prisma.statsRefNational.update).not.toHaveBeenCalled();
  });

  test('journalise la valeur avant et après', async () => {
    vi.mocked(prisma.statsRefNational.findUnique).mockResolvedValue(ligne as never);
    vi.mocked(prisma.statsRefNational.update).mockResolvedValue({ ...ligne, valeur: 65000 } as never);

    const res = await request(app)
      .put('/admin/stats-ref/ref-1')
      .send({ ...body, valeur: 65000 });

    expect(res.status).toBe(200);
    const log = await lastAuditLog();
    expect(log.action).toBe('PUT /stats-ref/:id');
    expect(log.before).toEqual({ valeur: 60000 });
    expect(log.after).toEqual({ valeur: 65000 });
  });

  test('refuse un doublon avec un 409', async () => {
    vi.mocked(prisma.statsRefNational.findUnique).mockResolvedValue(ligne as never);
    vi.mocked(prisma.statsRefNational.update).mockRejectedValue(doublon());

    const res = await request(app).put('/admin/stats-ref/ref-1').send(body);

    expect(res.status).toBe(409);
  });
});

describe('DELETE /admin/stats-ref/:id', () => {
  test('404 sur une référence inconnue', async () => {
    vi.mocked(prisma.statsRefNational.findUnique).mockResolvedValue(null);

    const res = await request(app).delete('/admin/stats-ref/inconnue');

    expect(res.status).toBe(404);
    expect(prisma.statsRefNational.delete).not.toHaveBeenCalled();
  });

  test('supprime la ligne et garde ses valeurs dans le journal', async () => {
    vi.mocked(prisma.statsRefNational.findUnique).mockResolvedValue(ligne as never);

    const res = await request(app).delete('/admin/stats-ref/ref-1');

    expect(res.status).toBe(200);
    expect(prisma.statsRefNational.delete).toHaveBeenCalledWith({ where: { id: 'ref-1' } });
    const log = await lastAuditLog();
    expect(log.before).toMatchObject({ saison: '2022-2023', valeur: 60000 });
  });
});
