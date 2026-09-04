import z from 'zod';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { IS_CELLAR_CONFIGURED, trichineDocumentKey, uploadToCellar } from '~/third-parties/cellar';
import {
  TrichineDocumentSource,
  type TrichineDocumentSourceValue,
  type TrichineRattachementIndiceValue,
  type TrichineRattachementSourceValue,
  type TrichineTexteSourceValue,
} from '~/utils/trichine';

/**
 * Upload d'un document trichine (rapport COFRAC, photographie de larve) vers Cellar.
 *
 * La clé de stockage est toujours calculée par le serveur à partir de l'id du document :
 * le client n'envoie que le fichier, jamais un chemin. Sans ça, un client pourrait
 * rattacher n'importe quelle clé du bucket — y compris celle d'un autre laboratoire.
 */

// Le body JSON est plafonné à 5 Mo (index.ts) et le base64 pèse ~4/3 du binaire
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

// Une pièce jointe d'email ne transite pas par le body JSON : on la télécharge chez Brevo, et
// seule la taille du fichier stocké nous limite (un rapport COFRAC scanné dépasse vite 3,5 Mo).
export const MAX_INBOUND_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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

// Provenance d'un document reçu sur l'adresse de dépôt des rapports (source EMAIL)
export type DocumentEmailOrigin = {
  message_id: string;
  expediteur: string;
  sujet: string | null;
  recu_at: Date;
};

type StoreBufferProps = {
  type: string;
  body: Buffer;
  contentType: string;
  // Null pour un document reçu par email : l'expéditeur n'est pas forcément un utilisateur Zacharie
  userId: string | null;
  poolId?: string;
  ftpId?: string;
  source?: TrichineDocumentSourceValue;
  nomFichier?: string;
  email?: DocumentEmailOrigin;
  // Ce qui a permis de rattacher le document : le contenu du fichier ou le message qui le portait
  rattachementSource?: TrichineRattachementSourceValue;
  // Ce qui a été reconnu dans le document pour le rattacher (référence, numéros de bracelet…)
  rattachementIndice?: TrichineRattachementIndiceValue;
  // Texte lu dans le document, conservé pour expliquer après coup rattachement et résultat
  texteExtrait?: string;
  texteSource?: TrichineTexteSourceValue;
  maxBytes?: number;
};

export async function storeTrichineDocumentFromBuffer({
  type,
  body,
  contentType,
  userId,
  poolId,
  ftpId,
  source = TrichineDocumentSource.UPLOAD,
  nomFichier,
  email,
  rattachementSource,
  rattachementIndice,
  texteExtrait,
  texteSource,
  maxBytes = MAX_UPLOAD_BYTES,
}: StoreBufferProps): Promise<StoreResult> {
  if (!IS_CELLAR_CONFIGURED) {
    return { kind: 'error', status: 503, error: "Le stockage de documents n'est pas disponible" };
  }
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    return { kind: 'error', status: 400, error: 'Format de fichier non supporté' };
  }
  if (!body.length) {
    return { kind: 'error', status: 400, error: 'Fichier illisible' };
  }
  if (body.length > maxBytes) {
    return {
      kind: 'error',
      status: 400,
      error: `Fichier trop volumineux (${Math.floor(maxBytes / 1024 / 1024)} Mo maximum)`,
    };
  }

  const document = await prisma.trichineDocument.create({
    data: {
      type,
      source,
      fichier_url: '',
      nom_fichier: nomFichier,
      ajoute_par_user_id: userId,
      pool_id: poolId,
      ftp_id: ftpId,
      email_message_id: email?.message_id,
      email_expediteur: email?.expediteur,
      email_sujet: email?.sujet,
      rattachement_source: rattachementSource,
      rattachement_indice: rattachementIndice,
      texte_extrait: texteExtrait,
      texte_source: texteSource,
      email_recu_at: email?.recu_at,
    },
  });
  const key = trichineDocumentKey({ type, documentId: document.id, extension });
  try {
    await uploadToCellar({ key, body, contentType });
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

// Dépôt applicatif : le fichier arrive encodé en base64 dans le body JSON
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
  return storeTrichineDocumentFromBuffer({
    type,
    body: Buffer.from(file.content, 'base64'),
    contentType: file.content_type,
    userId,
    poolId,
    ftpId,
  });
}
