import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { getFromCellar } from '~/third-parties/cellar';

// GET /laboratoire/pool/:pool_id/document/:document_id — téléchargement du rapport déposé.
// Contrat épinglé ici : le fichier n'est servi qu'au laboratoire destinataire du pool,
// et seulement s'il est bien rattaché à ce pool (pas de lecture d'une clé voisine par son id).

vi.mock('~/third-parties/cellar', () => ({
  IS_CELLAR_CONFIGURED: true,
  getFromCellar: vi.fn(),
  trichineDocumentKey: vi.fn(),
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
        expediteur_entity_id: 'entity-etg',
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

const get = (documentId = 'doc-1') =>
  request(app)
    .get(`/laboratoire/pool/pool-1/document/${documentId}`)
    .set('x-test-user', JSON.stringify(laboUser));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { EntityRelatedWithUser: { id: 'entity-labo', is_lnr: false } } as never,
  ]);
  vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool as never);
  vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue({
    id: 'doc-1',
    type: 'RAPPORT_COFRAC',
    fichier_url: 'trichine/RAPPORT_COFRAC/2026/doc-1.pdf',
  } as never);
  vi.mocked(getFromCellar).mockResolvedValue(Buffer.from('%PDF-1.4'));
});

describe('GET /laboratoire/pool/:pool_id/document/:document_id', () => {
  test('sert le document au laboratoire destinataire du pool', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('P-26-0001-doc-1.pdf');
    expect(getFromCellar).toHaveBeenCalledWith('trichine/RAPPORT_COFRAC/2026/doc-1.pdf');
  });

  test('le document est cherché sur ce pool, pas sur son seul id', async () => {
    await get();
    expect(prisma.trichineDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', pool_id: 'pool-1', deleted_at: null },
    });
  });

  test("404 si le pool n'est pas destiné à un laboratoire de l'utilisateur", async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { EntityRelatedWithUser: { id: 'entity-autre-labo', is_lnr: false } } as never,
    ]);
    const response = await get();
    expect(response.status).toBe(404);
    expect(getFromCellar).not.toHaveBeenCalled();
  });

  test('404 si le fichier a disparu du stockage', async () => {
    vi.mocked(getFromCellar).mockResolvedValue(null);
    const response = await get();
    expect(response.status).toBe(404);
  });
});
