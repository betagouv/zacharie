import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dayjs from 'dayjs';
import { CELLAR_BUCKET, CELLAR_HOST, CELLAR_KEY_ID, CELLAR_KEY_SECRET } from '~/config';

export const IS_CELLAR_CONFIGURED = !!(CELLAR_HOST && CELLAR_KEY_ID && CELLAR_KEY_SECRET && CELLAR_BUCKET);

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!IS_CELLAR_CONFIGURED) {
    throw new Error("Cellar n'est pas configuré");
  }
  if (!client) {
    client = new S3Client({
      endpoint: `https://${CELLAR_HOST}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: CELLAR_KEY_ID, secretAccessKey: CELLAR_KEY_SECRET },
    });
  }
  return client;
}

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

export async function getFromCellar(key: string): Promise<Buffer | null> {
  try {
    const response = await getClient().send(new GetObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }));
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw Object.assign(new Error('Cellar indisponible'), { status: 502, cause: error });
  }
}

export async function deleteFromCellar(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: CELLAR_BUCKET, Key: key }));
}
