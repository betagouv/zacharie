import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import entiteRouter from '~/controllers/entite';
import prisma from '~/prisma';
import { sendEmail } from '~/third-parties/brevo';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockImplementation(async (user) => user),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateOrCreateBrevoCompany: vi.fn().mockImplementation(async (entity) => entity),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// vitest.setup.ts ne mocke pas entity.create, utilisé par POST /ccg
(prisma.entity as any).create = vi.fn();

const app = express();
app.use(express.json());
app.use('/entite/', entiteRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(res.statusCode >= 400 ? res.statusCode : 500).send({ ok: false, error: err.message });
});

const chasseur = {
  id: 'user-1',
  email: 'user1@example.com',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

function authed(req: request.Test) {
  return req.set('x-test-user', JSON.stringify(chasseur));
}

const body = {
  nom_d_usage: 'Chambre froide de la Vienne',
  address_ligne_1: '1 rue du Bois',
  address_ligne_2: '',
  code_postal: '86000',
  ville: 'Poitiers',
  siret: '',
  numero_ddecpp: '86-CCG-12',
};

const existingCCG = {
  id: 'ccg-existant',
  type: EntityTypes.CCG,
  nom_d_usage: 'CCG officiel',
  numero_ddecpp: '86-CCG-12',
  deleted_at: null as Date | null,
};

describe('POST /entite/ccg avec un numéro déjà enregistré', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rattache le chasseur au CCG existant au lieu de répondre 500', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(existingCCG as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({ id: 'rel-1' } as any);

    const res = await authed(request(app).post('/entite/ccg')).send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.createdEntity.id).toBe('ccg-existant');
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledWith({
      data: {
        owner_id: 'user-1',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        entity_id: 'ccg-existant',
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('ne crée pas de deuxième rattachement si le chasseur est déjà rattaché', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(existingCCG as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue({ id: 'rel-existante' } as any);

    const res = await authed(request(app).post('/entite/ccg')).send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.createdEntity.id).toBe('ccg-existant');
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
  });

  test('répond 409 avec un message clair si le numéro appartient à une entité supprimée', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue({ ...existingCCG, deleted_at: new Date() } as any);

    const res = await authed(request(app).post('/entite/ccg')).send(body);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('86-CCG-12');
    expect(prisma.entity.create).not.toHaveBeenCalled();
  });

  test('crée le CCG si le numéro est libre', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.entity.create).mockResolvedValue({ id: 'nouveau-ccg', nom_d_usage: 'x' } as any);
    vi.mocked(prisma.entityAndUserRelations.create).mockResolvedValue({ id: 'rel-1' } as any);

    const res = await authed(request(app).post('/entite/ccg')).send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.createdEntity.id).toBe('nouveau-ccg');
    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: EntityRelationStatus.ADMIN, entity_id: 'nouveau-ccg' }),
    });
    expect(sendEmail).toHaveBeenCalled();
  });
});

describe('PUT /entite/ccg/:entityId avec un numéro déjà enregistré', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue({
      id: 'rel-1',
      EntityRelatedWithUser: { id: 'ccg-pre-enregistre', numero_ddecpp: null },
    } as any);
  });

  test('répond 409 avec un message clair au lieu de 500', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(existingCCG as any);

    const res = await authed(request(app).put('/entite/ccg/ccg-pre-enregistre')).send(body);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('86-CCG-12');
    expect(prisma.entity.update).not.toHaveBeenCalled();
  });

  test('met à jour si le numéro est celui du CCG modifié', async () => {
    vi.mocked(prisma.entity.findUnique).mockResolvedValue({
      ...existingCCG,
      id: 'ccg-pre-enregistre',
    } as any);
    vi.mocked(prisma.entity.update).mockResolvedValue({ id: 'ccg-pre-enregistre' } as any);

    const res = await authed(request(app).put('/entite/ccg/ccg-pre-enregistre')).send(body);

    expect(res.status).toBe(200);
    expect(prisma.entity.update).toHaveBeenCalled();
  });
});

describe('PUT /entite/ccg/:entityId réservé au créateur du CCG', () => {
  // relations en base : le créateur (ADMIN) et un chasseur rattaché par le numéro (REQUESTED, statut par défaut)
  const relations = [
    {
      id: 'rel-admin',
      owner_id: 'user-1',
      entity_id: 'ccg-pre-enregistre',
      status: EntityRelationStatus.ADMIN,
    },
    {
      id: 'rel-rattache',
      owner_id: 'user-2',
      entity_id: 'ccg-pre-enregistre',
      status: EntityRelationStatus.REQUESTED,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.entity.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.entity.update).mockResolvedValue({ id: 'ccg-pre-enregistre' } as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockImplementation((async (args: any) => {
      const where = args.where;
      const relation = relations.find(
        (r) =>
          r.owner_id === where.owner_id &&
          r.entity_id === where.entity_id &&
          (!('status' in where) || r.status === where.status)
      );
      return relation ? { ...relation, EntityRelatedWithUser: { id: 'ccg-pre-enregistre' } } : null;
    }) as any);
  });

  test('un chasseur rattaché par le numéro (REQUESTED) ne peut pas renommer le CCG', async () => {
    const res = await request(app)
      .put('/entite/ccg/ccg-pre-enregistre')
      .set('x-test-user', JSON.stringify({ ...chasseur, id: 'user-2' }))
      .send({ ...body, nom_d_usage: 'Nom piraté' });

    expect(res.status).toBe(403);
    expect(prisma.entity.update).not.toHaveBeenCalled();
  });

  test('le créateur (ADMIN) peut toujours modifier le CCG', async () => {
    const res = await authed(request(app).put('/entite/ccg/ccg-pre-enregistre')).send(body);

    expect(res.status).toBe(200);
    expect(prisma.entity.update).toHaveBeenCalled();
  });
});

describe('GET /entite/ccg/:entityId indique si le chasseur peut modifier le CCG', () => {
  function mockRelation(status: EntityRelationStatus, ccg_status: string) {
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValue({
      id: 'rel-1',
      status,
      EntityRelatedWithUser: { id: 'ccg-1', type: EntityTypes.CCG, ccg_status },
    } as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('le créateur (ADMIN) d’un CCG pré-enregistré peut le modifier', async () => {
    mockRelation(EntityRelationStatus.ADMIN, 'Pré-enregistré dans Zacharie');

    const res = await authed(request(app).get('/entite/ccg/ccg-1'));

    expect(res.status).toBe(200);
    expect(res.body.data.canEdit).toBe(true);
  });

  test('un chasseur rattaché par le numéro ne peut pas le modifier', async () => {
    mockRelation(EntityRelationStatus.REQUESTED, 'Pré-enregistré dans Zacharie');

    const res = await authed(request(app).get('/entite/ccg/ccg-1'));

    expect(res.body.data.canEdit).toBe(false);
  });

  test('le créateur ne peut plus modifier un CCG déclaré', async () => {
    mockRelation(EntityRelationStatus.ADMIN, 'Déclaré');

    const res = await authed(request(app).get('/entite/ccg/ccg-1'));

    expect(res.body.data.canEdit).toBe(false);
  });
});
