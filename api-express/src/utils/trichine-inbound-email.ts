import crypto from 'crypto';
import z from 'zod';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  TrichineStatutLogistiqueFTP,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { downloadInboundAttachment } from '~/third-parties/brevo-inbound';
import {
  MAX_INBOUND_ATTACHMENT_BYTES,
  storeTrichineDocumentFromBuffer,
} from '~/utils/trichine-document-upload';
import { TrichineDocumentSource, TrichineDocumentType } from '~/utils/trichine';

/**
 * Emails reçus sur l'adresse de dépôt des rapports (TRICHINE_RESULTATS_EMAIL), via le webhook
 * Brevo Inbound Parsing. Le laboratoire répond à la FTP avec son rapport COFRAC en pièce jointe :
 * on rattache le document au pool dont la référence (P-{YY}-{séquence}) figure dans le message.
 *
 * L'expéditeur d'un email n'est jamais une preuve d'identité : on ne rattache un document à un pool
 * que si l'adresse correspond à un utilisateur LABORATOIRE du laboratoire destinataire de la FTP.
 * Sinon le document est stocké sans rattachement, à trier à la main.
 */

/* -------------------------------------------------------------------------- */
/* Payload du webhook                                                          */
/* -------------------------------------------------------------------------- */

const addressSchema = z.object({ Name: z.string().nullish(), Address: z.string() });

const attachmentSchema = z.object({
  Name: z.string(),
  ContentType: z.string(),
  ContentLength: z.number().nullish(),
  ContentID: z.string().nullish(),
  DownloadToken: z.string(),
});

export const inboundEmailItemSchema = z.object({
  Uuid: z.array(z.string()).nullish(),
  MessageId: z.string().nullish(),
  From: addressSchema.nullish(),
  To: z.array(addressSchema).nullish(),
  Recipients: z.array(z.string()).nullish(),
  SentAtDate: z.string().nullish(),
  Subject: z.string().nullish(),
  RawTextBody: z.string().nullish(),
  RawHtmlBody: z.string().nullish(),
  ExtractedMarkdownMessage: z.string().nullish(),
  SpamScore: z.number().nullish(),
  Attachments: z.array(attachmentSchema).nullish(),
});

export const inboundEmailPayloadSchema = z.object({ items: z.array(inboundEmailItemSchema) });

export type InboundEmailItem = z.infer<typeof inboundEmailItemSchema>;
type InboundAttachment = z.infer<typeof attachmentSchema>;

/* -------------------------------------------------------------------------- */
/* Analyse du message (fonctions pures)                                        */
/* -------------------------------------------------------------------------- */

// Au-delà, SpamAssassin considère le message comme du spam : on ne stocke rien.
export const SPAM_SCORE_MAX = 5;

const POOL_REFERENCE_REGEX = /\bP-\d{2}-\d{6}\b/g;
const FTP_REFERENCE_REGEX = /\bF-\d{2}-\d{6}\b/g;

// Types acceptés en pièce jointe (mêmes formats que le dépôt applicatif)
const DOCUMENT_TYPE_BY_CONTENT_TYPE: Record<string, string> = {
  'application/pdf': TrichineDocumentType.RAPPORT_COFRAC,
  'image/jpeg': TrichineDocumentType.AUTRE,
  'image/png': TrichineDocumentType.AUTRE,
  'image/webp': TrichineDocumentType.AUTRE,
};

// Un client mail envoie « application/pdf; name="rapport.pdf" »
export function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

export function isSupportedAttachment(contentType: string): boolean {
  return !!DOCUMENT_TYPE_BY_CONTENT_TYPE[normalizeContentType(contentType)];
}

export function documentTypeForAttachment(contentType: string): string {
  return DOCUMENT_TYPE_BY_CONTENT_TYPE[normalizeContentType(contentType)] ?? TrichineDocumentType.AUTRE;
}

// Le texte fouillé : sujet, corps (texte et HTML détagué) et noms des pièces jointes
export function searchableTextFromItem(item: InboundEmailItem): string {
  const html = (item.RawHtmlBody ?? '').replace(/<[^>]*>/g, ' ');
  return [
    item.Subject ?? '',
    item.RawTextBody ?? '',
    item.ExtractedMarkdownMessage ?? '',
    html,
    ...(item.Attachments ?? []).map((attachment) => attachment.Name),
  ].join('\n');
}

function extractReferences(text: string, regex: RegExp): string[] {
  return [...new Set(text.toUpperCase().match(regex) ?? [])];
}

export function extractPoolReferences(text: string): string[] {
  return extractReferences(text, POOL_REFERENCE_REGEX);
}

export function extractFtpReferences(text: string): string[] {
  return extractReferences(text, FTP_REFERENCE_REGEX);
}

// Deux pièces jointes homonymes ne sont stockées qu'une fois : la clé d'idempotence est
// (message_id, nom_fichier), et on ne saurait pas les distinguer à un rejeu du webhook.
export function dedupeAttachmentsByName(attachments: InboundAttachment[]): InboundAttachment[] {
  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    if (seen.has(attachment.Name)) return false;
    seen.add(attachment.Name);
    return true;
  });
}

export function messageIdFromItem(item: InboundEmailItem): string {
  if (item.MessageId) return item.MessageId;
  if (item.Uuid?.length) return item.Uuid[0];
  // Sans identifiant Brevo, on en fabrique un stable : sans lui, un rejeu dupliquerait les documents
  return crypto.createHash('sha1').update(JSON.stringify(item)).digest('hex');
}

export function receivedAtFromItem(item: InboundEmailItem): Date {
  const sentAt = item.SentAtDate ? new Date(item.SentAtDate) : null;
  return sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : new Date();
}

/* -------------------------------------------------------------------------- */
/* Rattachement                                                                */
/* -------------------------------------------------------------------------- */

/** Laboratoires (entités) au nom desquels l'expéditeur de l'email peut agir. */
async function getSenderLaboEntityIds(email: string): Promise<string[]> {
  const relations = await prisma.entityAndUserRelations.findMany({
    where: {
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      deleted_at: null,
      EntityRelatedWithUser: { type: EntityTypes.LABORATOIRE, deleted_at: null },
      UserRelatedWithEntity: {
        email: { equals: email, mode: 'insensitive' },
        roles: { has: UserRoles.LABORATOIRE },
        deleted_at: null,
      },
    },
    select: { entity_id: true },
  });
  return [...new Set(relations.map((relation) => relation.entity_id))];
}

type InboundTarget =
  | { kind: 'pool'; id: string; reference: string }
  | { kind: 'ftp'; id: string; reference: string }
  | { kind: 'none' };

/**
 * Cherche l'objet auquel rattacher les pièces jointes, dans l'ordre d'apparition des références
 * dans le message. Un pool d'abord (le rapport porte sur des analyses), une FTP à défaut.
 * Seuls les pools / FTP destinés au laboratoire expéditeur sont éligibles.
 */
async function findInboundTarget(
  poolReferences: string[],
  ftpReferences: string[],
  entityIds: string[]
): Promise<InboundTarget> {
  if (!entityIds.length) return { kind: 'none' };
  if (poolReferences.length) {
    const pools = await prisma.trichinePool.findMany({
      where: {
        reference_pool: { in: poolReferences },
        deleted_at: null,
        TrichinePoolFTPs: {
          some: {
            TrichineFTP: {
              destinataire_entity_id: { in: entityIds },
              deleted_at: null,
              statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
            },
          },
        },
      },
      select: { id: true, reference_pool: true },
    });
    const reference = poolReferences.find((ref) => pools.some((pool) => pool.reference_pool === ref));
    const pool = pools.find((candidate) => candidate.reference_pool === reference);
    if (pool) return { kind: 'pool', id: pool.id, reference: pool.reference_pool };
  }
  if (ftpReferences.length) {
    const ftps = await prisma.trichineFTP.findMany({
      where: {
        numero_fiche: { in: ftpReferences },
        deleted_at: null,
        destinataire_entity_id: { in: entityIds },
        statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
      },
      select: { id: true, numero_fiche: true },
    });
    const reference = ftpReferences.find((ref) => ftps.some((ftp) => ftp.numero_fiche === ref));
    const ftp = ftps.find((candidate) => candidate.numero_fiche === reference);
    if (ftp) return { kind: 'ftp', id: ftp.id, reference: ftp.numero_fiche };
  }
  return { kind: 'none' };
}

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                   */
/* -------------------------------------------------------------------------- */

export type InboundEmailResult = {
  message_id: string;
  // Motif d'un email écarté sans rien stocker
  ignored?: 'spam' | 'expediteur_inconnu_sans_reference' | 'aucune_piece_jointe_exploitable';
  pool_reference?: string;
  ftp_numero?: string;
  stored: number;
  skipped: number;
  failed: number;
};

export async function ingestInboundEmail(item: InboundEmailItem): Promise<InboundEmailResult> {
  const messageId = messageIdFromItem(item);
  const result: InboundEmailResult = { message_id: messageId, stored: 0, skipped: 0, failed: 0 };

  if ((item.SpamScore ?? 0) > SPAM_SCORE_MAX) {
    return { ...result, ignored: 'spam' };
  }

  const attachments = dedupeAttachmentsByName(
    (item.Attachments ?? []).filter((attachment) => isSupportedAttachment(attachment.ContentType))
  );
  if (!attachments.length) {
    return { ...result, ignored: 'aucune_piece_jointe_exploitable' };
  }

  const expediteur = (item.From?.Address ?? '').trim().toLowerCase();
  const text = searchableTextFromItem(item);
  const poolReferences = extractPoolReferences(text);
  const ftpReferences = extractFtpReferences(text);
  const entityIds = expediteur ? await getSenderLaboEntityIds(expediteur) : [];
  if (!entityIds.length && !poolReferences.length && !ftpReferences.length) {
    return { ...result, ignored: 'expediteur_inconnu_sans_reference' };
  }

  const target = await findInboundTarget(poolReferences, ftpReferences, entityIds);
  if (target.kind === 'pool') result.pool_reference = target.reference;
  if (target.kind === 'ftp') result.ftp_numero = target.reference;

  const email = {
    message_id: messageId,
    expediteur,
    sujet: item.Subject ?? null,
    recu_at: receivedAtFromItem(item),
  };

  for (const attachment of attachments) {
    const dejaStocke = await prisma.trichineDocument.findFirst({
      where: { email_message_id: messageId, nom_fichier: attachment.Name },
      select: { id: true },
    });
    if (dejaStocke) {
      result.skipped++;
      continue;
    }
    const body = await downloadInboundAttachment(attachment.DownloadToken);
    if (!body) {
      result.failed++;
      continue;
    }
    const stored = await storeTrichineDocumentFromBuffer({
      type: documentTypeForAttachment(attachment.ContentType),
      body,
      contentType: normalizeContentType(attachment.ContentType),
      userId: null,
      source: TrichineDocumentSource.EMAIL,
      nomFichier: attachment.Name,
      poolId: target.kind === 'pool' ? target.id : undefined,
      ftpId: target.kind === 'ftp' ? target.id : undefined,
      email,
      maxBytes: MAX_INBOUND_ATTACHMENT_BYTES,
    });
    if (stored.kind === 'error') {
      result.failed++;
      capture('Trichine inbound: pièce jointe non stockée', {
        extra: { messageId, fichier: attachment.Name, error: stored.error },
      });
      continue;
    }
    result.stored++;
  }

  // Un document non rattaché n'est visible de personne : il faut le rattacher à la main.
  if (target.kind === 'none' && result.stored > 0) {
    capture('Trichine inbound: rapport reçu sans rattachement', {
      extra: {
        messageId,
        expediteur,
        sujet: item.Subject ?? '',
        references: [...poolReferences, ...ftpReferences].join(', '),
        laboratoire_reconnu: entityIds.length ? 'oui' : 'non',
      },
    });
  }

  return result;
}

export async function ingestInboundEmails(items: InboundEmailItem[]): Promise<InboundEmailResult[]> {
  const results: InboundEmailResult[] = [];
  // Séquentiel : quelques emails par webhook, et on évite de saturer Cellar et l'API Brevo
  for (const item of items) {
    results.push(await ingestInboundEmail(item));
  }
  return results;
}
