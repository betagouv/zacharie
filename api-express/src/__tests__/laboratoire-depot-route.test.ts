import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import laboratoireRouter from '~/controllers/laboratoire';
import { sendError } from '~/middlewares/errors';
import prisma from '~/prisma';
import { uploadToCellar } from '~/third-parties/cellar';

// Dépôts de fichiers d'un laboratoire : valeurs bornées (type de document, nombre et format des
// photos) et limite de débit par utilisateur.

vi.mock('~/third-parties/cellar', () => ({
  IS_CELLAR_CONFIGURED: true,
  getFromCellar: vi.fn(),
  trichineDocumentKey: vi.fn(() => 'trichine/cle'),
  uploadToCellar: vi.fn(),
}));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/laboratoire', laboratoireRouter);
app.use(sendError);

const laboUser = (id = 'user-labo') =>
  JSON.stringify({ id, roles: [UserRoles.LABORATOIRE], activated: true, isZacharieAdmin: false });

const ftp = {
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
};

const pool = {
  id: 'pool-1',
  reference_pool: 'P-26-0001',
  deleted_at: null as Date | null,
  TrichineEchantillons: [] as unknown[],
  TrichinePoolFTPs: [{ TrichineFTP: ftp }],
};

const pdf = { content_type: 'application/pdf', content: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') };
const jpeg = {
  content_type: 'image/jpeg',
  content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64'),
};

const postDocumentPool = (body: object, userId?: string) =>
  request(app).post('/laboratoire/pool/pool-1/documents').set('x-test-user', laboUser(userId)).send(body);

const postPhotos = (body: object) =>
  request(app).post('/laboratoire/ftp/ftp-1/photos').set('x-test-user', laboUser()).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { EntityRelatedWithUser: { id: 'entity-labo', is_lnr: false } } as never,
  ]);
  vi.mocked(prisma.trichinePool.findUnique).mockResolvedValue(pool as never);
  vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValue(ftp as never);
  vi.mocked(prisma.trichineDocument.create).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.trichineDocument.update).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(uploadToCellar).mockResolvedValue('trichine/cle');
});

describe('POST /laboratoire/pool/:pool_id/documents', () => {
  test.each(['FTP_PDF', 'PHOTOGRAPHIE_LARVE', '../autre-prefixe'])(
    'type %s → 400, rien stocké',
    async (type) => {
      const response = await postDocumentPool({ type, file: pdf });
      expect(response.status).toBe(400);
      expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
      expect(uploadToCellar).not.toHaveBeenCalled();
    }
  );

  test.each(['RAPPORT_COFRAC', 'AUTRE', undefined])('type %s → accepté', async (type) => {
    const response = await postDocumentPool({ type, file: pdf });
    expect(response.status).toBe(200);
    expect(uploadToCellar).toHaveBeenCalledTimes(1);
  });
});

describe('POST /laboratoire/ftp/:ftp_id/photos', () => {
  test('un PDF → 400, rien stocké', async () => {
    const response = await postPhotos({ files: [pdf] });
    expect(response.status).toBe(400);
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });

  test('11 photos → 400, rien stocké', async () => {
    const response = await postPhotos({ files: Array(11).fill(jpeg) });
    expect(response.status).toBe(400);
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });

  test('10 photos → acceptées', async () => {
    const response = await postPhotos({ files: Array(10).fill(jpeg) });
    expect(response.status).toBe(200);
    expect(uploadToCellar).toHaveBeenCalledTimes(10);
  });
});

describe('limite de débit des dépôts', () => {
  // La limite est désactivée en NODE_ENV=test pour ne pas gêner les autres suites :
  // elle est réactivée le temps de ce test.
  test('61e dépôt du même utilisateur en 15 min → 429, un autre utilisateur passe', async () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      for (let i = 0; i < 60; i++) {
        expect((await postDocumentPool({ file: pdf }, 'user-rafale')).status).toBe(200);
      }
      const bloque = await postDocumentPool({ file: pdf }, 'user-rafale');
      expect(bloque.status).toBe(429);
      expect(bloque.body.error).toBe('Trop de dépôts de fichiers, veuillez réessayer dans 15 minutes.');
      expect((await postDocumentPool({ file: pdf }, 'user-autre')).status).toBe(200);
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  });
});
