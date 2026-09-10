import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dayjs from 'dayjs';
import { CELLAR_BUCKET, CELLAR_HOST, CELLAR_KEY_ID, CELLAR_KEY_SECRET } from '~/config';

/**
 * Object storage Cellar (Clever Cloud, compatible S3) — cf doc/trichine.md §12.2.
 * Stocke les PDF de FTP, les rapports COFRAC et les photographies de larves.
 *
 * Non configuré (dev, test, CI) : `IS_CELLAR_CONFIGURED` vaut false et les appelants
 * régénèrent le document à la volée plutôt que de le lire depuis le stockage.
 */
export const IS_CELLAR_CONFIGURED = !!(CELLAR_HOST && CELLAR_KEY_ID && CELLAR_KEY_SECRET && CELLAR_BUCKET);

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!IS_CELLAR_CONFIGURED) {
    throw new Error("Cellar n'est pas configuré");
  }
  if (!client) {
    client = new S3Client({
      endpoint: `https://${CELLAR_HOST}`,
      // Cellar n'a pas de régions : la valeur n'est qu'un prérequis de signature
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: CELLAR_KEY_ID, secretAccessKey: CELLAR_KEY_SECRET },
    });
  }
  return client;
}

// Convention de clé §12.2 : trichine/{type}/{annee}/{id-document}.{ext}
export function trichineDocumentKey({
  type,
  documentId,
  extension,
}: {
  type: string;
  documentId: string;
  extension: string;
}) {
  return `trichine/${type}/${dayjs().format('YYYY')}/${documentId}.${extension}`;
}

export async function uploadToCellar({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  await getClient().send(
    new PutObjectCommand({ Bucket: CELLAR_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

// Renvoie null si l'objet n'existe pas (clé obsolète, bucket vidé...)
export async function getFromCellar(key: string): Promise<Buffer | null> {
  try {
    const response = await getClient().send(new GetObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }));
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch {
    return null;
  }
}

// URL pré-signée (1h par défaut) pour un téléchargement direct par le navigateur
export async function getCellarSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteFromCellar(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }));
}
