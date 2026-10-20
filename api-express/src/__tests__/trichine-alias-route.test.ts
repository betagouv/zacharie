import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  Prisma,
  TrichineAliasObjet,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  UserRoles,
} from '@prisma/client';
import trichineAliasRouter from '~/controllers/trichine-alias';
import prisma from '~/prisma';

// PUT/DELETE /trichine-alias/:objet/:id — chaque entité (SVI, LVD, LNR) pose sa propre référence
// interne sur un objet qu'elle voit déjà, tant que l'objet n'est pas figé.

const app = express();
app.use(express.json());
app.use('/trichine-alias', trichineAliasRouter);

const sviUser = { id: 'user-svi', roles: [UserRoles.SVI], activated: true, isZacharieAdmin: false };
const laboUser = { id: 'user-labo', roles: [UserRoles.LABORATOIRE], activated: true, isZacharieAdmin: false };
const chasseur = {
  id: 'user-chasseur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  isZacharieAdmin: false,
};

const put = (user: object, path: string, reference: string) =>
  request(app).put(`/trichine-alias/${path}`).set('x-test-user', JSON.stringify(user)).send({ reference });

const pool = {
  id: 'pool-1',
  cree_par_user_id: 'user-svi',
  statut: TrichineStatutAnalyse.EN_COURS_ANALYSES,
  deleted_at: null as Date | null,
  TrichinePoolFTPs: [
    {
      TrichineFTP: {
        deleted_at: null as Date | null,
        statut_logistique: TrichineStatutLogistiqueFTP.RECUE,
        destinataire_entity_id: 'labo-1',
      },
    },
  ],
};

const ftp = {
  id: 'ftp-1',
  expediteur_user_id: 'user-svi',
  expediteur_entity_id: 'svi-1',
  destinataire_entity_id: 'labo-1',
  statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
  statut_analytique: TrichineStatutAnalyse.EN_COURS_ANALYSES,
  deleted_at: null as Date | null,
};

// Sert à la fois à l'entité de l'utilisateur (entity_id) et à son équipe SVI (owner_id)
const travaillePour = (entityId: string, userId: string) =>
  vi
    .mocked(prisma.entityAndUserRelations.findMany)
    .mockResolvedValue([{ entity_id: entityId, owner_id: userId }] as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichineAlias.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.trichineAlias.create).mockImplementation((async ({ data }: { data: object }) => ({
    id: 'alias-1',
    ...data,
  })) as never);
  vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool as never);
  vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValue(ftp as never);
});

describe('PUT /trichine-alias/:objet/:id', () => {
  test('le SVI pose la référence de son service sur son pool', async () => {
    travaillePour('svi-1', 'user-svi');

    const response = await put(sviUser, 'pool/pool-1', '  SVI-2026-12 ');

    expect(response.status).toBe(200);
    expect(prisma.trichineAlias.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          entity_id: 'svi-1',
          objet_type: TrichineAliasObjet.POOL,
          pool_id: 'pool-1',
          reference: 'SVI-2026-12',
        },
      })
    );
  });

  test("un pool d'une autre équipe SVI reste introuvable", async () => {
    travaillePour('svi-1', 'user-svi');
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue({
      ...pool,
      cree_par_user_id: 'autre-agent',
    } as never);

    const response = await put(sviUser, 'pool/pool-1', 'A1');

    expect(response.status).toBe(404);
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('le laboratoire pose sa référence au nom du labo destinataire de la FTP', async () => {
    travaillePour('labo-1', 'user-labo');

    const response = await put(laboUser, 'ftp/ftp-1', 'LIMS-0087');

    expect(response.status).toBe(200);
    expect(prisma.trichineAlias.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity_id: 'labo-1', ftp_id: 'ftp-1' }) })
    );
  });

  test("une FTP encore en brouillon n'est pas visible du laboratoire", async () => {
    travaillePour('labo-1', 'user-labo');
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValue({
      ...ftp,
      statut_logistique: TrichineStatutLogistiqueFTP.BROUILLON,
    } as never);

    const response = await put(laboUser, 'ftp/ftp-1', 'LIMS-0087');

    expect(response.status).toBe(404);
  });

  test('la référence est figée une fois les analyses du pool terminées', async () => {
    travaillePour('labo-1', 'user-labo');
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue({
      ...pool,
      statut: TrichineStatutAnalyse.ANALYSES_TERMINEES,
    } as never);

    const response = await put(laboUser, 'pool/pool-1', 'LIMS-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/figée/);
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('la référence est figée une fois la FTP clôturée', async () => {
    travaillePour('svi-1', 'user-svi');
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValue({
      ...ftp,
      statut_logistique: TrichineStatutLogistiqueFTP.TRAITEE,
    } as never);

    const response = await put(sviUser, 'ftp/ftp-1', 'A1');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/clôturée/);
  });

  test("une référence déjà donnée par l'entité à un autre pool est refusée, casse ignorée", async () => {
    travaillePour('labo-1', 'user-labo');
    vi.mocked(prisma.trichineAlias.findFirst).mockResolvedValueOnce({
      reference: 'LIMS-1',
      echantillon_id: null,
      pool_id: 'pool-2',
      ftp_id: null,
      TrichineEchantillon: null,
      TrichinePool: { reference_pool: 'P-26-SVI01-0002' },
      TrichineFTP: null,
    } as never);

    const response = await put(laboUser, 'pool/pool-1', 'lims-1');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'La référence « LIMS-1 » est déjà utilisée pour le pool P-26-SVI01-0002'
    );
    expect(prisma.trichineAlias.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entity_id: 'labo-1',
          objet_type: TrichineAliasObjet.POOL,
          reference: { equals: 'lims-1', mode: 'insensitive' },
        },
      })
    );
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('changer la casse de sa propre référence reste possible', async () => {
    travaillePour('labo-1', 'user-labo');
    // 1er appel : contrôle des doublons (c'est ce pool) ; 2e : alias existant à mettre à jour
    vi.mocked(prisma.trichineAlias.findFirst)
      .mockResolvedValueOnce({
        reference: 'lims-1',
        echantillon_id: null,
        pool_id: 'pool-1',
        ftp_id: null,
      } as never)
      .mockResolvedValueOnce({ id: 'alias-1' } as never);
    vi.mocked(prisma.trichineAlias.update).mockResolvedValue({ id: 'alias-1' } as never);

    const response = await put(laboUser, 'pool/pool-1', 'LIMS-1');

    expect(response.status).toBe(200);
    expect(prisma.trichineAlias.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'alias-1' }, data: { reference: 'LIMS-1' } })
    );
  });

  test('format invalide → 400', async () => {
    travaillePour('svi-1', 'user-svi');

    const response = await put(sviUser, 'pool/pool-1', 'réf;DROP');

    expect(response.status).toBe(400);
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('un utilisateur ni SVI ni laboratoire ne peut pas poser de référence', async () => {
    const response = await put(chasseur, 'pool/pool-1', 'A1');

    expect(response.status).toBe(403);
  });

  test('un compte non activé ne peut pas poser de référence', async () => {
    travaillePour('svi-1', 'user-svi');

    const response = await put({ ...sviUser, activated: false }, 'pool/pool-1', 'A1');

    expect(response.status).toBe(400);
    expect(prisma.trichineAlias.create).not.toHaveBeenCalled();
  });

  test('un agent de deux services pose la référence au nom du service qui a constitué le pool', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { entity_id: 'svi-1', owner_id: 'user-svi' },
      { entity_id: 'svi-2', owner_id: 'user-svi' },
    ] as never);
    vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue({
      ...pool,
      cree_par_entity_id: 'svi-2',
    } as never);

    await put(sviUser, 'pool/pool-1', 'A1');

    expect(prisma.trichineAlias.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity_id: 'svi-2' }) })
    );
  });

  test('une référence prise au même instant par un collègue → 400, pas 500', async () => {
    travaillePour('svi-1', 'user-svi');
    vi.mocked(prisma.trichineAlias.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const response = await put(sviUser, 'pool/pool-1', 'A1');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/vient d’être utilisée/);
  });
});

describe('DELETE /trichine-alias/:objet/:id', () => {
  test("retire la référence de l'entité de l'utilisateur", async () => {
    travaillePour('labo-1', 'user-labo');

    const response = await request(app)
      .delete('/trichine-alias/pool/pool-1')
      .set('x-test-user', JSON.stringify(laboUser));

    expect(response.status).toBe(200);
    expect(prisma.trichineAlias.deleteMany).toHaveBeenCalledWith({
      where: { entity_id: 'labo-1', pool_id: 'pool-1' },
    });
  });
});
