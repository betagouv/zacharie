import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, afterEach } from 'vitest';
import userRouter from '~/controllers/user';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { type Fei, type User, UserRoles } from '@prisma/client';

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

function authed(req: request.Test, user: object) {
  return req.set('x-test-user', JSON.stringify(user));
}

const examinateur = {
  id: 'user-examinateur',
  email: 'examinateur@example.fr',
  roles: [UserRoles.CHASSEUR],
  activated: true,
};

const premierDetenteur = {
  id: 'user-premier-detenteur',
  email: 'premier-detenteur@example.fr',
  roles: [UserRoles.CHASSEUR],
  prenom: 'Pierre',
  nom_de_famille: 'Petit',
  telephone: '0606060602',
};

const body = { email: 'premier-detenteur@example.fr', numero: 'ZACH-20260930-QZ6E0-150250' };

describe('POST /user/fei/trouver-premier-detenteur', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("la fiche est cherchée parmi celles dont je suis l'examinateur initial, non supprimées", async () => {
    vi.mocked(prisma.fei.findFirst).mockResolvedValue(null);

    await authed(request(app).post('/user/fei/trouver-premier-detenteur').send(body), examinateur);

    expect(prisma.fei.findFirst).toHaveBeenCalledWith({
      where: {
        numero: body.numero,
        examinateur_initial_user_id: examinateur.id,
        deleted_at: null,
      },
    });
  });

  test("fiche d'un autre examinateur → même erreur qu'une fiche inexistante, aucune donnée utilisateur", async () => {
    vi.mocked(prisma.fei.findFirst).mockResolvedValue(null);

    const res = await authed(request(app).post('/user/fei/trouver-premier-detenteur').send(body), examinateur);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, data: { user: null }, error: "La fiche n'existe pas" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.userRelations.create).not.toHaveBeenCalled();
  });

  test("ma fiche → renvoie le premier détenteur et l'ajoute à mes partenaires", async () => {
    vi.mocked(prisma.fei.findFirst).mockResolvedValue({
      numero: body.numero,
      examinateur_initial_user_id: examinateur.id,
    } as unknown as Fei);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(premierDetenteur as unknown as User);
    vi.mocked(prisma.userRelations.findFirst).mockResolvedValue(null);

    const res = await authed(request(app).post('/user/fei/trouver-premier-detenteur').send(body), examinateur);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(premierDetenteur.id);
    expect(prisma.userRelations.create).toHaveBeenCalledOnce();
  });
});
