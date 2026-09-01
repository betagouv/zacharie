import { describe, test, expect, vi, beforeEach } from 'vitest';

const uploadToCellar = vi.fn().mockResolvedValue('');
// Cellar est simulé « configuré » : en vrai (dev / test) IS_CELLAR_CONFIGURED vaut false
vi.mock('~/third-parties/cellar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/third-parties/cellar')>()),
  IS_CELLAR_CONFIGURED: true,
  uploadToCellar: (args: unknown) => uploadToCellar(args),
}));

import prisma from '~/prisma';
import { storeTrichineDocument } from '~/utils/trichine-document-upload';

const pdf = { content_type: 'application/pdf', content: Buffer.from('%PDF-fake').toString('base64') };

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
});
