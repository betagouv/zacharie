import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NoSuchKey, S3Client } from '@aws-sdk/client-s3';

// Valeurs factices : rend IS_CELLAR_CONFIGURED vrai sans dépendre de l'env de la machine
vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  CELLAR_HOST: 'cellar.test',
  CELLAR_KEY_ID: 'id-factice',
  CELLAR_KEY_SECRET: 'secret-factice',
  CELLAR_BUCKET: 'bucket-factice',
}));

import { getFromCellar } from '~/third-parties/cellar';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getFromCellar', () => {
  test('objet absent (NoSuchKey) → null', async () => {
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(new NoSuchKey({ message: 'x', $metadata: {} }));
    await expect(getFromCellar('trichine/AUTRE/2026/doc.pdf')).resolves.toBeNull();
  });

  test('autre erreur (panne, réseau) → erreur 502', async () => {
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('réseau'));
    await expect(getFromCellar('trichine/AUTRE/2026/doc.pdf')).rejects.toMatchObject({ status: 502 });
  });
});
