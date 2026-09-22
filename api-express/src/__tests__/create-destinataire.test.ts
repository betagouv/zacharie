import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import adminEntityRouter from '~/controllers/admin/entity';
import entiteRouter from '~/controllers/entite';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { sendEmail } from '~/third-parties/brevo';
import { inviteUser } from '~/utils/invite-user';
import { EntityRelationStatus, EntityRelationType, EntityTypes, UserRoles } from '@prisma/client';

vi.mock('~/third-parties/brevo', () => ({
  // ces deux-là renvoient l'objet enrichi : le code continue de travailler avec leur retour
  updateOrCreateBrevoCompany: vi.fn((entity: unknown) => Promise.resolve(entity)),
  createBrevoContact: vi.fn((user: unknown) => Promise.resolve(user)),
  linkBrevoCompanyToContact: vi.fn().mockResolvedValue(undefined),
  updateBrevoContact: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendTemplateEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/utils/invite-user', () => ({
  inviteUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
  captureException: vi.fn(),
}));

// vitest.setup.ts ne mocke ni entity.create/count ni user.create : on les ajoute ici
(prisma.entity as any).create = vi.fn();
(prisma.entity as any).count = vi.fn();
(prisma.user as any).create = vi.fn();

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.fr',
  prenom: 'Ada',
  nom_de_famille: 'Admin',
  roles: [UserRoles.CHASSEUR],
  isZacharieAdmin: true,
};

const chasseurUser = {
  id: 'chasseur-1',
  email: 'chasseur@example.fr',
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res, next) => {
  req.user = adminUser;
  next();
});
adminApp.use(adminEntityRouter);
adminApp.use(sendError);

const entiteApp = express();
entiteApp.use(express.json());
entiteApp.use('/entite/', entiteRouter);
entiteApp.use(sendError);

const destinataireBody = {
  type: EntityTypes.COMMERCE_DE_DETAIL,
  raison_sociale: 'Boucherie du Centre',
  siret: '12345678900011',
  email: 'boucher@example.fr',
  nom_de_famille: 'Bernard',
  prenom: 'Louis',
  address_ligne_1: '3 rue des Halles',
  address_ligne_2: '',
  code_postal: '34000',
  ville: 'Montpellier',
};

const createdEntity = {
  id: 'entity-new',
  nom_d_usage: 'Boucherie du Centre',
  type: EntityTypes.COMMERCE_DE_DETAIL,
};

const createdOwner = {
  id: 'owner-new',
  email: 'boucher@example.fr',
  prenom: 'Louis',
  nom_de_famille: 'Bernard',
  roles: [UserRoles.COMMERCE_DE_DETAIL],
};

// le check d'email libre et createUserId passent tous les deux par user.findUnique :
// on répond en fonction du critère pour ne pas faire boucler createUserId
function mockUserFindUnique(userForEmail: unknown) {
  (prisma.user.findUnique as any).mockImplementation(({ where }: any) =>
    Promise.resolve(where?.email ? userForEmail : null)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.entity.findFirst as any).mockResolvedValue(null);
  (prisma.entity.create as any).mockResolvedValue(createdEntity);
  (prisma.entity.count as any).mockResolvedValue(0);
  (prisma.user.create as any).mockResolvedValue(createdOwner);
  (prisma.entityAndUserRelations.create as any).mockResolvedValue({ id: 'relation-new' });
  mockUserFindUnique(null);
});

describe('POST /entity/nouvelle (admin) — destinataire', () => {
  test('crée l’entité, son représentant et la relation ADMIN, puis invite le représentant', async () => {
    const res = await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.entity.id).toBe('entity-new');

    expect(prisma.entity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raison_sociale: 'Boucherie du Centre',
          nom_d_usage: 'Boucherie du Centre',
          type: EntityTypes.COMMERCE_DE_DETAIL,
          siret: '12345678900011',
          code_postal: '34000',
          ville: 'Montpellier',
          zacharie_compatible: true,
        }),
      })
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'boucher@example.fr',
          nom_de_famille: 'Bernard',
          prenom: 'Louis',
          roles: [UserRoles.COMMERCE_DE_DETAIL],
        }),
      })
    );

    expect(inviteUser).toHaveBeenCalledWith(createdOwner, expect.objectContaining({ id: 'admin-1' }));
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ emails: ['contact@zacharie.beta.gouv.fr'] })
    );
  });

  test('un seul rôle sur le représentant', async () => {
    await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    const roles = (prisma.user.create as any).mock.calls[0][0].data.roles;
    expect(roles).toHaveLength(1);
  });

  test('ne crée que la relation ADMIN : l’admin ne devient pas partenaire de l’entité', async () => {
    await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledTimes(1);
    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledWith({
      data: {
        owner_id: 'owner-new',
        entity_id: 'entity-new',
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: EntityRelationStatus.ADMIN,
      },
    });
  });

  test('CONSOMMATEUR_FINAL n’est pas une entité : refusé côté admin', async () => {
    const res = await request(adminApp)
      .post('/entity/nouvelle')
      .send({ ...destinataireBody, type: EntityTypes.CONSOMMATEUR_FINAL });

    expect(res.status).toBe(406);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();
  });

  test('représentant incomplet → 406, rien n’est créé', async () => {
    const { email, ...withoutEmail } = destinataireBody;
    const res = await request(adminApp).post('/entity/nouvelle').send(withoutEmail);

    expect(res.status).toBe(406);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('entité déjà existante → 406, aucun compte créé', async () => {
    (prisma.entity.findFirst as any).mockResolvedValue({ id: 'entity-existing' });

    const res = await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    expect(res.status).toBe(406);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  test('email déjà rattaché à un compte avec des rôles → 409, aucune entité créée', async () => {
    mockUserFindUnique({ id: 'user-existing', email: 'boucher@example.fr', roles: [UserRoles.CHASSEUR] });

    const res = await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    expect(res.status).toBe(409);
    expect(prisma.entity.create).not.toHaveBeenCalled();
  });

  test('email connu mais compte vide → le compte est réutilisé, pas recréé', async () => {
    mockUserFindUnique({ id: 'user-empty', email: 'boucher@example.fr', roles: [] });
    (prisma.user.update as any).mockResolvedValue({ ...createdOwner, id: 'user-empty' });

    const res = await request(adminApp).post('/entity/nouvelle').send(destinataireBody);

    expect(res.status).toBe(200);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-empty' },
      data: {
        roles: [UserRoles.COMMERCE_DE_DETAIL],
        nom_de_famille: 'Bernard',
        prenom: 'Louis',
      },
    });
  });
});

describe('POST /entity/nouvelle (admin) — types historiques', () => {
  test('un ETG est créé sans représentant ni invitation', async () => {
    const res = await request(adminApp)
      .post('/entity/nouvelle')
      .send({ type: EntityTypes.ETG, raison_sociale: 'ETG de la Garenne' });

    expect(res.status).toBe(200);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(inviteUser).not.toHaveBeenCalled();
    expect(prisma.entityAndUserRelations.create).not.toHaveBeenCalled();
  });
});

describe('POST /entite/partenaire (chasseur)', () => {
  test('crée le destinataire ET la relation « je lui transmets des carcasses »', async () => {
    const res = await request(entiteApp)
      .post('/entite/partenaire')
      .set('x-test-user', JSON.stringify(chasseurUser))
      .send(destinataireBody);

    expect(res.status).toBe(200);
    expect(prisma.entityAndUserRelations.create).toHaveBeenCalledTimes(2);
    expect(prisma.entityAndUserRelations.create).toHaveBeenLastCalledWith({
      data: {
        owner_id: 'chasseur-1',
        entity_id: 'entity-new',
        relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        status: EntityRelationStatus.MEMBER,
      },
    });
    expect(inviteUser).toHaveBeenCalledWith(createdOwner, expect.objectContaining({ id: 'chasseur-1' }));
  });

  test('non authentifié → 401', async () => {
    await request(entiteApp).post('/entite/partenaire').send(destinataireBody).expect(401);
  });
});
