import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import prisma from '~/prisma';
import { getFromCellar } from '~/third-parties/cellar';

// GET /laboratoire/ftp/:ftp_id/document/:document_id — photographie de larve jointe à la FTP de
// confirmation. Servie au LVD qui l'envoie et au LNR qui la reçoit, et seulement si elle est
// rattachée à cette FTP.

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

const ftp = {
  id: 'ftp-lnr',
  numero_fiche: 'F-26-LVD01-0002',
  deleted_at: null as Date | null,
  expediteur_entity_id: 'entity-lvd',
  destinataire_entity_id: 'entity-lnr',
};

const get = () =>
  request(app).get('/laboratoire/ftp/ftp-lnr/document/doc-1').set('x-test-user', JSON.stringify(laboUser));

const travaillePour = (entityId: string, isLnr: boolean) =>
  vi
    .mocked(prisma.entityAndUserRelations.findMany)
    .mockResolvedValue([{ EntityRelatedWithUser: { id: entityId, is_lnr: isLnr } } as never]);

beforeEach(() => {
  vi.clearAllMocks();
  travaillePour('entity-lvd', false);
  vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValue(ftp as never);
  vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue({
    id: 'doc-1',
    type: 'PHOTOGRAPHIE_LARVE',
    fichier_url: 'trichine/PHOTOGRAPHIE_LARVE/2026/doc-1.jpg',
  } as never);
  vi.mocked(getFromCellar).mockResolvedValue(Buffer.from('jpeg'));
});

describe('GET /laboratoire/ftp/:ftp_id/document/:document_id', () => {
  test('sert la photo au LVD expéditeur', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('F-26-LVD01-0002-doc-1.jpg');
  });

  test('sert la photo au LNR destinataire', async () => {
    travaillePour('entity-lnr', true);
    const response = await get();
    expect(response.status).toBe(200);
  });

  test('la photo est cherchée sur cette FTP, pas sur son seul id', async () => {
    await get();
    expect(prisma.trichineDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', ftp_id: 'ftp-lnr', deleted_at: null },
    });
  });

  test('404 pour un laboratoire étranger à la FTP', async () => {
    travaillePour('entity-autre-labo', false);
    const response = await get();
    expect(response.status).toBe(404);
    expect(getFromCellar).not.toHaveBeenCalled();
  });
});
