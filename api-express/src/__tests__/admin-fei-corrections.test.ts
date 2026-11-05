import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseType, FeiOwnerRole, UserRoles } from '@prisma/client';
import adminFeiRouter from '~/controllers/admin/fei';
import adminCarcasseRouter from '~/controllers/admin/carcasse';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { notifyNextOwnerEntity, notifyNextOwnerUser } from '~/utils/carcasse-side-effects';

// Corrections admin d'une fiche transmise : date, commune, premier détenteur, ajout et suppression de
// carcasse. Contrat épinglé ici : les champs recopiés sur les carcasses le sont, chaque écriture monte la
// version (synchro delta), et rien n'est possible sur une fiche clôturée.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));
vi.mock('~/utils/carcasse-side-effects', () => ({
  notifyNextOwnerUser: vi.fn(),
  notifyNextOwnerEntity: vi.fn(),
}));

const adminUser = { id: 'admin-1', email: 'admin@example.fr', roles: ['CHASSEUR'], isZacharieAdmin: true };
const numero = 'ZACH-20261026-LVWSG-064307';
const fei = {
  numero,
  date_mise_a_mort: new Date('2026-10-26'),
  commune_mise_a_mort: 'Moulins',
  examinateur_initial_user_id: 'examinateur-1',
  premier_detenteur_user_id: 'examinateur-1',
  premier_detenteur_entity_id: null as string | null,
  premier_detenteur_name_cache: 'Jean Dupont',
  deleted_at: null as Date | null,
};
const carcasseModele = {
  zacharie_carcasse_id: `${numero}_MM-001`,
  examinateur_signed_at: new Date('2026-10-26T10:00:00Z'),
  current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
  current_owner_user_id: 'examinateur-1',
  next_owner_role: FeiOwnerRole.ETG,
  next_owner_entity_id: 'etg-1',
};
const version = { version: { increment: 1 }, version_user_id: adminUser.id };

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
app.use(adminFeiRouter);
app.use(adminCarcasseRouter);
app.use(sendError);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findUnique).mockResolvedValue(fei as any);
  vi.mocked(prisma.fei.findUniqueOrThrow).mockResolvedValue(fei as any);
  vi.mocked(prisma.fei.update).mockResolvedValue(fei as any);
  vi.mocked(prisma.carcasse.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.carcasseCertificat.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.carcasseIntermediaire.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([]);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
});

describe('POST /fei/:fei_numero/corrections', () => {
  test('la date de mise à mort est corrigée sur la fiche et recopiée sur ses carcasses', async () => {
    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ date_mise_a_mort: '2026-10-23' });

    expect(res.status).toBe(200);
    const date_mise_a_mort = new Date('2026-10-23');
    expect(prisma.fei.update).toHaveBeenCalledWith({
      where: { numero },
      data: { date_mise_a_mort, ...version },
    });
    // toutes les carcasses, supprimées comprises, comme syncCarcasseDates
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: numero },
      data: { date_mise_a_mort, ...version },
    });
  });

  test('une date impossible est refusée', async () => {
    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ date_mise_a_mort: '2026-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date invalide');
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test("la commune n'est corrigée que sur la fiche", async () => {
    const res = await request(app).post(`/fei/${numero}/corrections`).send({ commune_mise_a_mort: 'Vichy' });

    expect(res.status).toBe(200);
    expect(prisma.fei.update).toHaveBeenCalledWith({
      where: { numero },
      data: { commune_mise_a_mort: 'Vichy', ...version },
    });
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
  });

  test("une association de l'examinateur devient premier détenteur, aussi comme détenteur actuel ou suivant", async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { EntityRelatedWithUser: { id: 'asso-1', nom_d_usage: 'ACCA de Moulins' } },
    ] as any);

    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { entity_id: 'asso-1' } });

    expect(res.status).toBe(200);
    expect(prisma.fei.update).toHaveBeenCalledWith({
      where: { numero },
      data: {
        premier_detenteur_user_id: 'examinateur-1',
        premier_detenteur_entity_id: 'asso-1',
        premier_detenteur_name_cache: 'ACCA de Moulins',
        ...version,
      },
    });
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fei_numero: numero, deleted_at: null, current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR },
        data: expect.objectContaining({ current_owner_entity_id: 'asso-1', ...version }),
      })
    );
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fei_numero: numero, deleted_at: null, next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR },
      })
    );
  });

  test('fiche déjà transmise par le premier détenteur : il est remplacé comme expéditeur', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { EntityRelatedWithUser: { id: 'asso-1', nom_d_usage: 'ACCA de Moulins' } },
    ] as any);

    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { entity_id: 'asso-1' } });

    expect(res.status).toBe(200);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: numero, deleted_at: null, prev_owner_role: FeiOwnerRole.PREMIER_DETENTEUR },
      data: { prev_owner_user_id: 'examinateur-1', prev_owner_entity_id: 'asso-1', ...version },
    });
    expect(notifyNextOwnerUser).not.toHaveBeenCalled();
  });

  test("fiche en attente du premier détenteur : le nouveau est prévenu, au nom de l'examinateur", async () => {
    const examinateur = { id: 'examinateur-1', prenom: 'Jean', nom_de_famille: 'Dupont' };
    const chasseur = {
      id: 'chasseur-2',
      roles: [UserRoles.CHASSEUR],
      prenom: 'Marie',
      nom_de_famille: 'Martin',
      deleted_at: null as Date | null,
    };
    const carcasseEnAttente = {
      zacharie_carcasse_id: `${numero}_MM-001`,
      next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      next_owner_user_id: 'examinateur-1',
    };
    vi.mocked(prisma.user.findUnique).mockImplementation((({ where }: any) =>
      Promise.resolve(where.email ? chasseur : examinateur)) as any);
    // 1er appel : la recherche de clôture (aucune), 2e : la carcasse qui attend le premier détenteur
    vi.mocked(prisma.carcasse.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(carcasseEnAttente as any);
    vi.mocked(prisma.fei.update).mockResolvedValue({
      ...fei,
      premier_detenteur_user_id: 'chasseur-2',
      premier_detenteur_name_cache: 'Marie Martin',
    } as any);

    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { email: 'marie@example.fr' } });

    expect(res.status).toBe(200);
    expect(notifyNextOwnerUser).toHaveBeenCalledWith(
      carcasseEnAttente,
      expect.objectContaining({
        next_owner_user_id: 'chasseur-2',
        next_owner_user_name_cache: 'Marie Martin',
      }),
      examinateur
    );
    expect(notifyNextOwnerEntity).toHaveBeenCalled();
  });

  test("une entité dont l'examinateur n'est pas membre est refusée", async () => {
    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { entity_id: 'asso-inconnue' } });

    expect(res.status).toBe(400);
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test("un autre chasseur peut être désigné par son email, pas un utilisateur qui n'est pas chasseur", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'etg-user',
      roles: [UserRoles.ETG],
      deleted_at: null,
    } as any);
    const refus = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { email: 'etg-1@example.fr' } });
    expect(refus.status).toBe(400);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'chasseur-2',
      roles: [UserRoles.CHASSEUR],
      prenom: 'Marie',
      nom_de_famille: 'Martin',
      deleted_at: null,
    } as any);
    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ premier_detenteur: { email: 'marie@example.fr' } });

    expect(res.status).toBe(200);
    expect(prisma.fei.update).toHaveBeenCalledWith({
      where: { numero },
      data: {
        premier_detenteur_user_id: 'chasseur-2',
        premier_detenteur_entity_id: null,
        premier_detenteur_name_cache: 'Marie Martin',
        ...version,
      },
    });
  });

  test('une fiche clôturée ne peut plus être corrigée', async () => {
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue({ zacharie_carcasse_id: 'c-1' } as any);

    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ date_mise_a_mort: '2026-10-23' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La fiche est clôturée');
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });

  test('une fiche avec un certificat SVI ne peut plus être corrigée', async () => {
    vi.mocked(prisma.carcasseCertificat.findFirst).mockResolvedValue({ certificat_id: 'cert-1' } as any);

    const res = await request(app)
      .post(`/fei/${numero}/corrections`)
      .send({ date_mise_a_mort: '2026-10-23' });

    expect(res.status).toBe(400);
    expect(prisma.fei.update).not.toHaveBeenCalled();
  });
});

describe('POST /fei/:fei_numero/carcasse', () => {
  const body = { numero_bracelet: 'MM-002', espece: 'Chevreuil', type: CarcasseType.GROS_GIBIER };

  test("la carcasse ajoutée reprend l'état de transmission d'une carcasse de la fiche", async () => {
    // 1er appel : la recherche de clôture (aucune), 2e : la carcasse modèle, 3e : un doublon (aucun)
    vi.mocked(prisma.carcasse.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(carcasseModele as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasse.create).mockResolvedValue({ zacharie_carcasse_id: `${numero}_MM-002` } as any);

    const res = await request(app).post(`/fei/${numero}/carcasse`).send(body);

    expect(res.status).toBe(200);
    expect(prisma.carcasse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        zacharie_carcasse_id: `${numero}_MM-002`,
        numero_bracelet: 'MM-002',
        nombre_d_animaux: 1,
        date_mise_a_mort: fei.date_mise_a_mort,
        examinateur_signed_at: carcasseModele.examinateur_signed_at,
        current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
        next_owner_role: FeiOwnerRole.ETG,
        next_owner_entity_id: 'etg-1',
        premier_detenteur_name_cache: 'Jean Dupont',
      }),
    });
  });

  test('un numéro de marquage déjà utilisé sur la fiche est refusé', async () => {
    vi.mocked(prisma.carcasse.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(carcasseModele as any)
      .mockResolvedValueOnce({ deleted_at: null } as any);

    const res = await request(app).post(`/fei/${numero}/carcasse`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Le numéro de marquage est déjà utilisé pour cette fiche');
    expect(prisma.carcasse.create).not.toHaveBeenCalled();
  });

  test('une fiche déjà prise en charge par un intermédiaire est refusée', async () => {
    vi.mocked(prisma.carcasseIntermediaire.findFirst).mockResolvedValue({ intermediaire_id: 'i-1' } as any);

    const res = await request(app).post(`/fei/${numero}/carcasse`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La fiche a déjà été prise en charge par un intermédiaire');
    expect(prisma.carcasse.create).not.toHaveBeenCalled();
  });
});

describe('POST /carcasse/:zacharie_carcasse_id/soft-delete', () => {
  const zacharie_carcasse_id = `${numero}_MM-001`;

  test("la carcasse d'une fiche clôturée ne peut plus être supprimée", async () => {
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValue({
      zacharie_carcasse_id,
      fei_numero: numero,
      deleted_at: null,
    } as any);
    vi.mocked(prisma.carcasse.findFirst).mockResolvedValue({ zacharie_carcasse_id } as any);

    const res = await request(app).post(`/carcasse/${zacharie_carcasse_id}/soft-delete`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La fiche est clôturée');
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });
});
