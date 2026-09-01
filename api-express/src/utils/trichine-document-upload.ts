import z from 'zod';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { IS_CELLAR_CONFIGURED, trichineDocumentKey, uploadToCellar } from '~/third-parties/cellar';

/**
 * Upload d'un document trichine (rapport COFRAC, photographie de larve) vers Cellar.
 *
 * La clé de stockage est toujours calculée par le serveur à partir de l'id du document :
 * le client n'envoie que le fichier, jamais un chemin. Sans ça, un client pourrait
 * rattacher n'importe quelle clé du bucket — y compris celle d'un autre laboratoire.
 */

// Le body JSON est plafonné à 5 Mo (index.ts) et le base64 pèse ~4/3 du binaire
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Sens inverse, pour servir un document stocké : la clé Cellar ne porte que l'extension
export const DOCUMENT_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([contentType, extension]) => [extension, contentType])
);

export const uploadedFileSchema = z.object({
  content_type: z.enum(Object.keys(EXTENSIONS) as [string, ...string[]]),
  // contenu binaire encodé en base64 (sans préfixe data:)
  content: z.string().min(1),
});

export type UploadedFile = z.infer<typeof uploadedFileSchema>;

type StoreResult =
  | { kind: 'ok'; document: Awaited<ReturnType<typeof prisma.trichineDocument.create>> }
  | { kind: 'error'; status: number; error: string };

export async function storeTrichineDocument({
  type,
  file,
  userId,
  poolId,
  ftpId,
}: {
  type: string;
  file: UploadedFile;
  userId: string;
  poolId?: string;
  ftpId?: string;
}): Promise<StoreResult> {
  if (!IS_CELLAR_CONFIGURED) {
    return { kind: 'error', status: 503, error: "Le stockage de documents n'est pas disponible" };
  }
  const body = Buffer.from(file.content, 'base64');
  if (!body.length) {
    return { kind: 'error', status: 400, error: 'Fichier illisible' };
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    return { kind: 'error', status: 400, error: 'Fichier trop volumineux (3,5 Mo maximum)' };
  }

  const document = await prisma.trichineDocument.create({
    data: { type, fichier_url: '', ajoute_par_user_id: userId, pool_id: poolId, ftp_id: ftpId },
  });
  const key = trichineDocumentKey({
    type,
    documentId: document.id,
    extension: EXTENSIONS[file.content_type],
  });
  try {
    await uploadToCellar({ key, body, contentType: file.content_type });
  } catch (error) {
    capture(error as Error, { extra: { documentId: document.id, context: 'store_trichine_document' } });
    await prisma.trichineDocument.delete({ where: { id: document.id } });
    return { kind: 'error', status: 502, error: "Le document n'a pas pu être enregistré" };
  }
  return {
    kind: 'ok',
    document: await prisma.trichineDocument.update({
      where: { id: document.id },
      data: { fichier_url: key },
    }),
  };
}
