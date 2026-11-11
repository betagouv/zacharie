import { describe, test, expect, vi, beforeEach } from 'vitest';

const uploadToCellar = vi.fn().mockResolvedValue('');
// Cellar est forcé « configuré » : le test ne doit pas dépendre de l'env de la machine
vi.mock('~/third-parties/cellar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/third-parties/cellar')>()),
  IS_CELLAR_CONFIGURED: true,
  uploadToCellar: (args: unknown) => uploadToCellar(args),
}));

import prisma from '~/prisma';
import { storeTrichineDocument } from '~/utils/trichine-document-upload';

const pdf = { content_type: 'application/pdf', content: Buffer.from('%PDF-fake').toString('base64') };
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.trichineDocument.create).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.trichineDocument.update).mockImplementation((async ({
    data,
  }: {
    data: { fichier_url: string };
  }) => ({ id: 'doc-1', ...data })) as never);
});

describe('storeTrichineDocument', () => {
  test('la clé de stockage est calculée par le serveur à partir de l’id du document', async () => {
    const result = await storeTrichineDocument({
      type: 'RAPPORT_COFRAC',
      file: pdf,
      userId: 'user-1',
      poolId: 'pool-1',
    });

    expect(result.kind).toBe('ok');
    const { key, contentType } = uploadToCellar.mock.calls[0][0];
    expect(key).toMatch(/^trichine\/RAPPORT_COFRAC\/\d{4}\/doc-1\.pdf$/);
    expect(contentType).toBe('application/pdf');
  });

  test('fichier trop volumineux → 400, aucun upload', async () => {
    const result = await storeTrichineDocument({
      type: 'RAPPORT_COFRAC',
      file: { content_type: 'application/pdf', content: Buffer.alloc(4 * 1024 * 1024).toString('base64') },
      userId: 'user-1',
      poolId: 'pool-1',
    });

    expect(result).toMatchObject({ kind: 'error', status: 400 });
    expect(uploadToCellar).not.toHaveBeenCalled();
  });

  test('upload en échec → le document créé est supprimé', async () => {
    uploadToCellar.mockRejectedValueOnce(new Error('cellar down'));

    const result = await storeTrichineDocument({
      type: 'RAPPORT_COFRAC',
      file: pdf,
      userId: 'user-1',
      poolId: 'pool-1',
    });

    expect(result).toMatchObject({ kind: 'error', status: 502 });
    expect(prisma.trichineDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
  });

  test('contenu PNG déclaré PDF → 400, ni document créé ni upload', async () => {
    const result = await storeTrichineDocument({
      type: 'RAPPORT_COFRAC',
      file: { content_type: 'application/pdf', content: pngBytes.toString('base64') },
      userId: 'user-1',
      poolId: 'pool-1',
    });

    expect(result).toMatchObject({
      kind: 'error',
      status: 400,
      error: 'Le contenu du fichier ne correspond pas à son format',
    });
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
    expect(uploadToCellar).not.toHaveBeenCalled();
  });

  test.each([
    ['application/pdf', Buffer.from('%PDF-1.4')],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['image/png', pngBytes],
    ['image/webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])],
  ])('contenu conforme au format déclaré (%s) → accepté', async (contentType, bytes) => {
    const result = await storeTrichineDocument({
      type: 'PHOTOGRAPHIE_LARVE',
      file: { content_type: contentType, content: bytes.toString('base64') },
      userId: 'user-1',
      ftpId: 'ftp-1',
    });

    expect(result.kind).toBe('ok');
    expect(uploadToCellar).toHaveBeenCalledTimes(1);
  });
});
