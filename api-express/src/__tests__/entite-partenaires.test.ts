import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import entiteRouter from '~/controllers/entite';
import prisma from '~/prisma';
import { sendEmail } from '~/third-parties/brevo';
import { inviteUser } from '~/utils/invite-user';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  createBrevoContact: vi.fn().mockImplementation(async (user) => user),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  updateOrCreateBrevoCompany: vi.fn().mockImplementation(async (entity) => entity),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/utils/invite-user', () => ({
  inviteUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// vitest.setup.ts ne mocke pas entity.create ni user.create, utilisés par POST /partenaire
(prisma.entity as any).create = vi.fn();
(prisma.user as any).create = vi.fn();

const app = express();
app.use(express.json());
app.use('/entite/', entiteRouter);

const regularUser = {
  id: 'user-1',
  email: 'user1@example.com',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

function authed(req: request.Test, user: object = regularUser) {
  return req.set('x-test-user', JSON.stringify(user));
}

const PARTENAIRE_TYPES = [
  EntityTypes.COMMERCE_DE_DETAIL,
  EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
  EntityTypes.ASSOCIATION_CARITATIVE,
  EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
  EntityTypes.CONSOMMATEUR_FINAL,
];

describe('GET /entite/partenaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unauthenticated → 401', async () => {
    await request(app).get('/entite/partenaires').expect(401);
  });

  test('ne renvoie que mes partenaires, avec ma seule relation et sans aucune donnée de contact', async () => {
    const myBoucherie = {
      id: 'boucherie-mine',
      type: EntityTypes.COMMERCE_DE_DETAIL,
      nom_d_usage: 'Ma Boucherie',
      raison_sociale: 'Ma Boucherie',
      siret: '12345678900012',
      brevo_id: 'brevo-secret',
      deleted_at: null as Date | null,
      EntityRelationsWithUsers: [
        {
          id: 'mine-rel',
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          status: EntityRelationStatus.REQUESTED,
          owner_id: regularUser.id,
          entity_id: 'boucherie-mine',
        },
      ],
    };
    vi.mocked(prisma.entity.findMany).mockResolvedValueOnce([myBoucherie] as any);

    const res = await authed(request(app).get('/entite/partenaires'));

    expect(res.status).toBe(200);
    // une seule requête : il n'existe plus de liste de tous les partenaires de Zacharie
    expect(prisma.entity.findMany).toHaveBeenCalledTimes(1);
    expect(res.body.data.allEntitiesById).toBeUndefined();

    const args = vi.mocked(prisma.entity.findMany).mock.calls[0][0] as any;
    expect(args.where.type.in).toEqual(PARTENAIRE_TYPES);
    expect(args.where.deleted_at).toBeNull();
    // toute relation active compte, quel que soit son statut
    expect(args.where.EntityRelationsWithUsers.some).toEqual({
      owner_id: regularUser.id,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    });
    // seule ma relation est incluse, jamais le contact du partenaire ni les autres chasseurs
    expect(args.include.EntityRelationsWithUsers.where).toEqual({
      owner_id: regularUser.id,
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    });
    expect(args.include.EntityRelationsWithUsers.select.UserRelatedWithEntity).toBeUndefined();

    const userById = res.body.data.userEntitiesById;
    expect(userById['boucherie-mine'].nom_d_usage).toBe('Ma Boucherie');
    expect(userById['boucherie-mine'].brevo_id).toBeUndefined();
    expect(userById['boucherie-mine'].EntityRelationsWithUsers).toHaveLength(1);
    expect(userById['boucherie-mine'].EntityRelationsWithUsers[0].owner_id).toBe(regularUser.id);
    expect(userById['boucherie-mine'].EntityRelationsWithUsers[0].UserRelatedWithEntity).toBeUndefined();
  });
});

describe('POST /entite/partenaire', () => {
  const validBody = {
    raison_sociale: 'Boucherie Martin',
    type: EntityTypes.COMMERCE_DE_DETAIL,
    address_ligne_1: '12 rue du Commerce',
    address_ligne_2: '',
    code_postal: '75015',
    ville: 'Paris',
    siret: '123 456 789 00012',
    email: 'boucher@example.com',
    nom_de_famille: 'Martin',
    prenom: 'Paul',
  };

  const existingEntity = {
    id: 'boucherie-existante',
    type: EntityTypes.COMMERCE_DE_DETAIL,
    nom_d_usage: 'Boucherie Martin',
    siret: '12345678900012',
    deleted_at: null as Date | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.entityAndUserRelations.create).mockImplementation((async ({ data }: any) => ({
      id: 'rel-created',
      ...data,
    })) as any);
  });

  test('partenaire existant (même SIRET) → rattachement silencieux, aucun doublon, aucun compte créé', async () => {
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(existingEntity as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([
      { UserRelatedWithEntity: { email: 'admin-existant@example.com' } },
    ] as any);

    const res = await authed(request(app).post('/entite/partenaire').send(validBody));

    expect(res.status).toBe(200);
    // recherche par SIRET normalisé (sans espaces)
    const findArgs = vi.mocked(prisma.entity.findFirst).mock.calls[0][0] as any;
    expect(findArgs.where).toEqual({
      deleted_at: null,
      type: {
        in: [
          EntityTypes.ETG,
          EntityTypes.COLLECTEUR_PRO,
          EntityTypes.COMMERCE_DE_DETAIL,
          EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
          EntityTypes.ASSOCIATION_CARITATIVE,
          EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
          EntityTypes.CONSOMMATEUR_FINAL,
        ],
      },
      siret: '12345678900012',
    });

    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();

    // ma relation est créée sans statut particulier
    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.entityAndUserRelations.create).mock.calls[0][0].data).toEqual({
      owner_id: regularUser.id,
      entity_id: 'boucherie-existante',
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    });

    // l'équipe est prévenue, jamais le chasseur
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = vi.mocked(sendEmail).mock.calls[0][0] as any;
    expect(email.emails).toEqual(['contact@zacharie.beta.gouv.fr']);
    expect(email.subject).toBe('Partenaire existant rattaché par un chasseur');
    expect(email.text).toContain('boucher@example.com');
    expect(email.text).toContain('admin-existant@example.com');

    // la réponse a la même forme qu'une création : rien ne révèle que le partenaire existait
    expect(res.body.data.entity.id).toBe('boucherie-existante');
    expect(res.body.data.relation.id).toBe('rel-created');
    expect(JSON.stringify(res.body)).not.toContain('admin-existant@example.com');
  });

  test('partenaire existant déjà rattaché → 200 idempotent, pas de nouvelle relation ni de notice', async () => {
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(existingEntity as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({ id: 'rel-existing' } as any);

    const res = await authed(request(app).post('/entite/partenaire').send(validBody));

    expect(res.status).toBe(200);
    expect(res.body.data.relation.id).toBe('rel-existing');
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('sans SIRET, le partenaire existant est retrouvé par raison sociale + code postal', async () => {
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(existingEntity as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce({ id: 'rel-existing' } as any);

    await authed(
      request(app)
        .post('/entite/partenaire')
        .send({ ...validBody, siret: '', raison_sociale: '  boucherie MARTIN ' })
    ).expect(200);

    const findArgs = vi.mocked(prisma.entity.findFirst).mock.calls[0][0] as any;
    expect(findArgs.where).toEqual({
      deleted_at: null,
      type: {
        in: [
          EntityTypes.ETG,
          EntityTypes.COLLECTEUR_PRO,
          EntityTypes.COMMERCE_DE_DETAIL,
          EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE,
          EntityTypes.ASSOCIATION_CARITATIVE,
          EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF,
          EntityTypes.CONSOMMATEUR_FINAL,
        ],
      },
      raison_sociale: { equals: 'boucherie MARTIN', mode: 'insensitive' },
      code_postal: '75015',
    });
    expect(prisma.entity.create).not.toHaveBeenCalled();
  });

  test('nouveau partenaire → création de l’entité, du contact administrateur et invitation', async () => {
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.entity.create).mockImplementation((async ({ data }: any) => ({
      id: 'entity-created',
      ...data,
    })) as any);
    vi.mocked(prisma.user.create).mockImplementation((async ({ data }: any) => ({ ...data })) as any);

    const res = await authed(request(app).post('/entite/partenaire').send(validBody));

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.entity.create).mock.calls[0][0].data.siret).toBe('12345678900012');
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(inviteUser).toHaveBeenCalledTimes(1);

    const relations = vi.mocked(prisma.entityAndUserRelations.create).mock.calls.map((call) => call[0].data);
    expect(relations).toEqual([
      expect.objectContaining({
        entity_id: 'entity-created',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      }),
      {
        owner_id: regularUser.id,
        entity_id: 'entity-created',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      },
    ]);
    expect(res.body.data.entity.id).toBe('entity-created');
    expect(res.body.data.relation.id).toBe('rel-created');
  });

  test('un ETG saisi comme commerce de détail est retrouvé comme ETG : rattachement, pas de commerce créé', async () => {
    const existingEtg = {
      ...existingEntity,
      id: 'etg-existant',
      type: EntityTypes.ETG,
      nom_d_usage: 'ETG Martin',
    };
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(existingEtg as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([] as any);

    const res = await authed(request(app).post('/entite/partenaire').send(validBody));

    expect(res.status).toBe(200);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.entityAndUserRelations.create).mock.calls[0][0].data).toEqual({
      owner_id: regularUser.id,
      entity_id: 'etg-existant',
      relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      deleted_at: null,
    });
    expect(res.body.data.entity.type).toBe(EntityTypes.ETG);
  });

  test('collecteur pro existant → rattachement, aucun compte créé', async () => {
    const existingCollecteur = {
      ...existingEntity,
      id: 'collecteur-existant',
      type: EntityTypes.COLLECTEUR_PRO,
    };
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(existingCollecteur as any);
    vi.mocked(prisma.entityAndUserRelations.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValueOnce([] as any);

    const res = await authed(
      request(app)
        .post('/entite/partenaire')
        .send({ ...validBody, type: EntityTypes.COLLECTEUR_PRO })
    );

    expect(res.status).toBe(200);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(res.body.data.entity.id).toBe('collecteur-existant');
  });

  test('SIRET d’une entité qui ne reçoit pas de carcasses (CCG, SVI…) → 409, rien n’est créé', async () => {
    vi.mocked(prisma.entity.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'ccg-1', type: EntityTypes.CCG, siret: '12345678900012' } as any);

    const res = await authed(request(app).post('/entite/partenaire').send(validBody));

    expect(res.status).toBe(409);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();
  });

  test('nouveau collecteur pro → entité COLLECTEUR_PRO et représentant avec le seul rôle COLLECTEUR_PRO', async () => {
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.entity.create).mockImplementation((async ({ data }: any) => ({
      id: 'collecteur-created',
      ...data,
    })) as any);
    vi.mocked(prisma.user.create).mockImplementation((async ({ data }: any) => ({ ...data })) as any);

    const res = await authed(
      request(app)
        .post('/entite/partenaire')
        .send({ ...validBody, type: EntityTypes.COLLECTEUR_PRO })
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.entity.create).mock.calls[0][0].data.type).toBe(EntityTypes.COLLECTEUR_PRO);
    expect(vi.mocked(prisma.user.create).mock.calls[0][0].data.roles).toEqual([UserRoles.COLLECTEUR_PRO]);
    expect(inviteUser).toHaveBeenCalledTimes(1);
    const relations = vi.mocked(prisma.entityAndUserRelations.create).mock.calls.map((call) => call[0].data);
    expect(relations).toEqual([
      expect.objectContaining({
        entity_id: 'collecteur-created',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      }),
      {
        owner_id: regularUser.id,
        entity_id: 'collecteur-created',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
      },
    ]);
  });
});
