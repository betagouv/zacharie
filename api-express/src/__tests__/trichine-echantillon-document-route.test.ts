import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { getFromCellar, uploadToCellar } from '~/third-parties/cellar';

// Documents joints par le laboratoire à un échantillon d'un pool reçu.
// Contrat épinglé ici : dépôt et téléchargement réservés au laboratoire destinataire du pool,
// pas de nouveau dépôt sur un échantillon retiré du pool (ses documents restent téléchargeables),
// et le document est toujours cherché sur cet échantillon, pas sur son seul id.

vi.mock('~/third-parties/cellar', () => ({
  IS_CELLAR_CONFIGURED: true,
  getFromCellar: vi.fn(),
  trichineDocumentKey: vi.fn().mockReturnValue('trichine/AUTRE/2026/doc-1.pdf'),
  uploadToCellar: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use('/laboratoire', laboratoireRouter);

const laboUser = { id: 'user-labo', roles: [UserRoles.LABORATOIRE], activated: true, isZacharieAdmin: false };

const pool = {
  id: 'pool-1',
  reference_pool: 'P-26-0001',
  deleted_at: null as Date | null,
  TrichineEchantillons: [] as unknown[],
  TrichinePoolFTPs: [
    {
      TrichineFTP: {
        id: 'ftp-1',
        deleted_at: null as Date | null,
        statut_logistique: TrichineStatutLogistiqueFTP.RECUE,
        destinataire_entity_id: 'entity-labo',
        expediteur_entity_id: 'entity-svi',
        DestinataireEntity: {
          id: 'entity-labo',
          is_lnr: false,
          nom_d_usage: null as string | null,
          raison_sociale: null as string | null,
        },
      },
    },
  ],
};

const echantillon = {
  id: 'ech-1',
  reference_echantillon: 'E-26-SVI01-0001',
  deleted_at: null as Date | null,
  pool_id: 'pool-1' as string | null,
  retire_du_pool_id: null as string | null,
};

const echantillonRetire = { ...echantillon, pool_id: null as string | null, retire_du_pool_id: 'pool-1' };

const fichierPdf = { content_type: 'application/pdf', content: Buffer.from('%PDF-1.4').toString('base64') };

const post = () =>
  request(app)
    .post('/laboratoire/echantillon/ech-1/documents')
    .set('x-test-user', JSON.stringify(laboUser))
    .send({ file: fichierPdf });

const get = () =>
  request(app)
    .get('/laboratoire/echantillon/ech-1/document/doc-1')
    .set('x-test-user', JSON.stringify(laboUser));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { EntityRelatedWithUser: { id: 'entity-labo', is_lnr: false } } as never,
  ]);
  vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool as never);
  vi.mocked(prisma.trichineEchantillon.findUnique).mockResolvedValue(echantillon as never);
  vi.mocked(prisma.trichineDocument.create).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.trichineDocument.update).mockResolvedValue({
    id: 'doc-1',
    fichier_url: 'trichine/AUTRE/2026/doc-1.pdf',
  } as never);
  vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue({
    id: 'doc-1',
    type: 'AUTRE',
    fichier_url: 'trichine/AUTRE/2026/doc-1.pdf',
  } as never);
  vi.mocked(getFromCellar).mockResolvedValue(Buffer.from('%PDF-1.4'));
});

describe('POST /laboratoire/echantillon/:echantillon_id/documents', () => {
  test("rattache le document à l'échantillon, en type « Document »", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'AUTRE',
        echantillon_id: 'ech-1',
        pool_id: undefined,
        ftp_id: undefined,
        ajoute_par_user_id: 'user-labo',
      }),
    });
    expect(uploadToCellar).toHaveBeenCalled();
  });

  test("404 si le pool de l'échantillon n'est pas destiné à un laboratoire de l'utilisateur", async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { EntityRelatedWithUser: { id: 'entity-autre-labo', is_lnr: false } } as never,
    ]);
    const response = await post();
    expect(response.status).toBe(404);
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });

  test('404 sur un échantillon retiré du pool', async () => {
    vi.mocked(prisma.trichineEchantillon.findUnique).mockResolvedValue(echantillonRetire as never);
    const response = await post();
    expect(response.status).toBe(404);
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });
});

describe('GET /laboratoire/echantillon/:echantillon_id/document/:document_id', () => {
  test('sert le document, cherché sur cet échantillon', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('E-26-SVI01-0001-doc-1.pdf');
    expect(prisma.trichineDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', echantillon_id: 'ech-1', deleted_at: null },
    });
  });

  test('reste téléchargeable après le retrait du pool', async () => {
    vi.mocked(prisma.trichineEchantillon.findUnique).mockResolvedValue(echantillonRetire as never);
    const response = await get();
    expect(response.status).toBe(200);
    expect(prisma.trichinePool.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pool-1' } })
    );
  });

  test("404 si le pool n'est pas destiné à un laboratoire de l'utilisateur", async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { EntityRelatedWithUser: { id: 'entity-autre-labo', is_lnr: false } } as never,
    ]);
    const response = await get();
    expect(response.status).toBe(404);
    expect(getFromCellar).not.toHaveBeenCalled();
  });
});
