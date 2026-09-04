import crypto from 'crypto';
import z from 'zod';
import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  Prisma,
  TrichineStatutLogistiqueFTP,
  type TrichineResultatAnalyse,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { downloadInboundAttachment } from '~/third-parties/brevo-inbound';
import {
  MAX_INBOUND_ATTACHMENT_BYTES,
  storeTrichineDocumentFromBuffer,
} from '~/utils/trichine-document-upload';
import {
  TrichineDocumentSource,
  TrichineDocumentType,
  TrichineRattachementIndice,
  TrichineRattachementSource,
  TrichineTexteSource,
  type TrichineRattachementIndiceValue,
  type TrichineRattachementSourceValue,
} from '~/utils/trichine';
import { extractPdfText } from '~/utils/pdf-text';
import { IS_ALBERT_CONFIGURED } from '~/third-parties/albert';
import { parseTrichineReport, traduireVerdictLaboratoire } from '~/utils/trichine-report-parse';
import { applyPoolResult } from '~/utils/trichine-result';

/**
 * Emails reçus sur l'adresse de dépôt des rapports (TRICHINE_RESULTATS_EMAIL), via le webhook
 * Brevo Inbound Parsing. Le laboratoire répond à la FTP avec son rapport COFRAC en pièce jointe.
 *
 * Le rattachement se fait sur la référence de pool (P-{YY}-{séquence}) lue **dans le PDF** : c'est
 * le document qui fait foi, pas le message qui le porte. Un email peut ainsi transporter les
 * rapports de plusieurs pools, chacun est rattaché au sien. Le sujet et le corps ne servent que
 * de repli, quand le PDF ne porte pas de texte (scan) ou aucune référence.
 *
 * L'expéditeur d'un email n'est jamais une preuve d'identité : on ne rattache un document à un pool
 * que si l'adresse correspond à un utilisateur LABORATOIRE du laboratoire destinataire de la FTP.
 * Sinon le document est stocké sans rattachement, à trier à la main.
 *
 * Un rapport scanné (le cas le plus fréquent) ne porte aucun texte : le message est alors marqué
 * `A_ANALYSER` et l'OCR passe derrière, en cronjob (cf utils/trichine-inbound-ocr.ts).
 *
 * Quand le rapport a été rattaché par son contenu et qu'il porte un verdict non ambigu, le résultat
 * est appliqué au pool au nom de l'utilisateur expéditeur — c'est ce qui évite au laboratoire de
 * ressaisir dans Zacharie ce qu'il vient d'écrire dans son rapport. Le chemin d'application est
 * celui de la saisie manuelle (`applyPoolResult`) : mêmes règles métier, mêmes effets de bord.
 *
 * Tout message reçu laisse une ligne dans `EmailEntrant`, y compris ceux qu'on écarte.
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
const ECHANTILLON_REFERENCE_REGEX = /\bE-\d{2}-\d{6}\b/g;
const FTP_REFERENCE_REGEX = /\bF-\d{2}-\d{6}\b/g;

// Un numéro trop court se retrouverait par hasard dans n'importe quel rapport (n° de page, quantité…)
const LONGUEUR_MIN_BRACELET = 3;

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

export function extractEchantillonReferences(text: string): string[] {
  return extractReferences(text, ECHANTILLON_REFERENCE_REGEX);
}

export function extractFtpReferences(text: string): string[] {
  return extractReferences(text, FTP_REFERENCE_REGEX);
}

/**
 * Numéros de bracelet (n° de scellé côté laboratoire) présents dans le texte. Comparaison bornée
 * aux deux extrémités : « 6940 » ne doit pas se reconnaître dans « 241108069401 ».
 */
export function bracelesPresentsDansTexte(texte: string, numeros: string[]): string[] {
  const majuscules = texte.toUpperCase();
  return numeros.filter((numero) => {
    if (!numero || numero.length < LONGUEUR_MIN_BRACELET) return false;
    const echappe = numero.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![A-Z0-9])${echappe}(?![A-Z0-9])`).test(majuscules);
  });
}

type CandidatBracelets = { poolId: string; reference: string; bracelets: string[] };

export type ChoixParBracelets = {
  poolId: string;
  reference: string;
  trouves: string[];
  total: number;
  // Tous les échantillons du pool sont cités : le rapport porte bien sur ce mélange, et lui seul
  couvertureComplete: boolean;
};

/**
 * Choisit le pool dont le rapport parle, d'après les numéros de bracelet qu'il cite.
 * Un rapport d'analyse liste les échantillons du mélange : le bon pool est celui qui en a le plus,
 * et il doit devancer strictement les autres. Un seul numéro reconnu ne suffit que si le pool
 * n'en compte qu'un — sinon c'est probablement une collision avec un autre nombre du document.
 */
export function choisirPoolParBracelets(
  candidats: CandidatBracelets[],
  texte: string
): ChoixParBracelets | null {
  const scores = candidats
    .map((candidat) => ({
      poolId: candidat.poolId,
      reference: candidat.reference,
      trouves: bracelesPresentsDansTexte(texte, candidat.bracelets),
      total: candidat.bracelets.length,
    }))
    .filter((score) => score.trouves.length > 0)
    .sort((a, b) => b.trouves.length - a.trouves.length);

  const meilleur = scores[0];
  if (!meilleur) return null;
  if (scores[1] && scores[1].trouves.length === meilleur.trouves.length) return null;
  if (meilleur.trouves.length < 2 && meilleur.total > 1) return null;

  return { ...meilleur, couvertureComplete: meilleur.trouves.length === meilleur.total };
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

/** Le laboratoire au nom duquel l'expéditeur de l'email peut agir. */
export type InboundLabo = {
  userId: string;
  entityIds: string[];
  isLnr: boolean;
};

export async function getSenderLabo(email: string): Promise<InboundLabo | null> {
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
    select: { owner_id: true, entity_id: true, EntityRelatedWithUser: { select: { is_lnr: true } } },
  });
  if (!relations.length) return null;
  return {
    userId: relations[0].owner_id,
    entityIds: [...new Set(relations.map((relation) => relation.entity_id))],
    isLnr: relations.some((relation) => relation.EntityRelatedWithUser.is_lnr),
  };
}

// Tout ce dont `applyPoolResult` a besoin, pour que le résultat lu dans le rapport emprunte
// exactement le chemin de la saisie manuelle.
const poolForInboundInclude = Prisma.validator<Prisma.TrichinePoolInclude>()({
  TrichineEchantillons: {
    where: { deleted_at: null },
    select: {
      reference_echantillon: true,
      Carcasse: {
        select: {
          // Le n° de marquage est imprimé sur la FTP : c'est le « n° de scellé » que le
          // laboratoire recopie dans son rapport, et souvent le seul lien avec Zacharie
          numero_bracelet: true,
          premier_detenteur_user_id: true,
          current_owner_user_id: true,
          current_owner_entity_id: true,
        },
      },
    },
  },
  TrichinePoolFTPs: {
    select: {
      id: true,
      TrichineFTP: {
        select: {
          id: true,
          deleted_at: true,
          statut_logistique: true,
          destinataire_entity_id: true,
          ftp_parent_id: true,
          expediteur_user_id: true,
          expediteur_entity_id: true,
        },
      },
    },
  },
});

type PoolForInbound = Prisma.TrichinePoolGetPayload<{ include: typeof poolForInboundInclude }>;
type LinkForInbound = PoolForInbound['TrichinePoolFTPs'][number];

// Le lien pool ↔ FTP par lequel le pool est arrivé chez le laboratoire expéditeur
function pickLinkForLabo(pool: PoolForInbound, entityIds: string[]): LinkForInbound | undefined {
  return pool.TrichinePoolFTPs.find(
    (link) =>
      entityIds.includes(link.TrichineFTP.destinataire_entity_id) &&
      !link.TrichineFTP.deleted_at &&
      link.TrichineFTP.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON
  );
}

export type InboundTarget =
  | {
      kind: 'pool';
      id: string;
      reference: string;
      pool: PoolForInbound;
      link: LinkForInbound;
      indice: TrichineRattachementIndiceValue;
      // Sur un rattachement par numéros de bracelet : tous les échantillons du pool sont cités
      couvertureComplete: boolean;
      bracelets?: string;
    }
  | { kind: 'ftp'; id: string; reference: string; indice: TrichineRattachementIndiceValue }
  | { kind: 'none' };

function cibleDepuisPool(
  pool: PoolForInbound,
  link: LinkForInbound,
  indice: TrichineRattachementIndiceValue,
  couvertureComplete = true
): InboundTarget {
  return {
    kind: 'pool',
    id: pool.id,
    reference: pool.reference_pool,
    pool,
    link,
    indice,
    couvertureComplete,
  };
}

/** Pools destinés au laboratoire expéditeur — la seule population qu'il a le droit de renseigner. */
async function chargerPoolsDuLabo(where: Prisma.TrichinePoolWhereInput, labo: InboundLabo) {
  const pools = await prisma.trichinePool.findMany({
    where: {
      ...where,
      deleted_at: null,
      TrichinePoolFTPs: {
        some: {
          TrichineFTP: {
            destinataire_entity_id: { in: labo.entityIds },
            deleted_at: null,
            statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
          },
        },
      },
    },
    include: poolForInboundInclude,
  });
  return pools
    .map((pool) => ({ pool, link: pickLinkForLabo(pool, labo.entityIds) }))
    .filter((candidat): candidat is { pool: PoolForInbound; link: LinkForInbound } => !!candidat.link);
}

/**
 * Références explicites (pool, puis FTP) — ce que porte le sujet d'un message, et ce que porte un
 * rapport quand le laboratoire a bien recopié la référence client demandée sur la FTP.
 */
export async function findInboundTarget(
  poolReferences: string[],
  ftpReferences: string[],
  labo: InboundLabo | null
): Promise<InboundTarget> {
  if (!labo) return { kind: 'none' };
  if (poolReferences.length) {
    const candidats = await chargerPoolsDuLabo({ reference_pool: { in: poolReferences } }, labo);
    for (const reference of poolReferences) {
      const candidat = candidats.find(({ pool }) => pool.reference_pool === reference);
      if (candidat) {
        return cibleDepuisPool(candidat.pool, candidat.link, TrichineRattachementIndice.REFERENCE_POOL);
      }
    }
  }
  if (ftpReferences.length) {
    const ftps = await prisma.trichineFTP.findMany({
      where: {
        numero_fiche: { in: ftpReferences },
        deleted_at: null,
        destinataire_entity_id: { in: labo.entityIds },
        statut_logistique: { not: TrichineStatutLogistiqueFTP.BROUILLON },
      },
      select: { id: true, numero_fiche: true },
    });
    const reference = ftpReferences.find((ref) => ftps.some((ftp) => ftp.numero_fiche === ref));
    const ftp = ftps.find((candidate) => candidate.numero_fiche === reference);
    if (ftp) {
      return {
        kind: 'ftp',
        id: ftp.id,
        reference: ftp.numero_fiche,
        indice: TrichineRattachementIndice.REFERENCE_FTP,
      };
    }
  }
  return { kind: 'none' };
}

/** Références d'échantillon `E-{YY}-{séquence}` → le pool qui les contient. */
async function findTargetByEchantillons(references: string[], labo: InboundLabo): Promise<InboundTarget> {
  if (!references.length) return { kind: 'none' };
  const candidats = await chargerPoolsDuLabo(
    { TrichineEchantillons: { some: { reference_echantillon: { in: references }, deleted_at: null } } },
    labo
  );
  const candidat = candidats[0];
  return candidat
    ? cibleDepuisPool(candidat.pool, candidat.link, TrichineRattachementIndice.REFERENCE_ECHANTILLON)
    : { kind: 'none' };
}

/**
 * Numéros de bracelet (n° de scellé). C'est le cas courant : les rapports réels ne portent ni la
 * référence de pool ni celle de la FTP, seulement l'identification des échantillons.
 * Population candidate volontairement étroite : les pools du laboratoire encore sans résultat.
 */
async function findTargetByBracelets(texte: string, labo: InboundLabo): Promise<InboundTarget> {
  const candidats = await chargerPoolsDuLabo({ resultat_analyse: null }, labo);
  if (!candidats.length) return { kind: 'none' };

  const choix = choisirPoolParBracelets(
    candidats.map(({ pool }) => ({
      poolId: pool.id,
      reference: pool.reference_pool,
      bracelets: pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse?.numero_bracelet).filter(
        (numero): numero is string => !!numero
      ),
    })),
    texte
  );
  if (!choix) return { kind: 'none' };

  const candidat = candidats.find(({ pool }) => pool.id === choix.poolId)!;
  return {
    ...cibleDepuisPool(
      candidat.pool,
      candidat.link,
      TrichineRattachementIndice.NUMEROS_BRACELET,
      choix.couvertureComplete
    ),
    bracelets: `${choix.trouves.length}/${choix.total}`,
  } as InboundTarget;
}

/**
 * Rattachement d'un document d'après son contenu, du plus fiable au plus faible :
 * référence de pool, référence d'échantillon, numéros de bracelet, référence de FTP.
 */
export async function findTargetInDocumentText(
  texte: string,
  labo: InboundLabo | null
): Promise<InboundTarget> {
  if (!labo) return { kind: 'none' };
  const parReference = await findInboundTarget(extractPoolReferences(texte), [], labo);
  if (parReference.kind !== 'none') return parReference;

  const parEchantillon = await findTargetByEchantillons(extractEchantillonReferences(texte), labo);
  if (parEchantillon.kind !== 'none') return parEchantillon;

  const parBracelets = await findTargetByBracelets(texte, labo);
  if (parBracelets.kind !== 'none') return parBracelets;

  return findInboundTarget([], extractFtpReferences(texte), labo);
}

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                   */
/* -------------------------------------------------------------------------- */

export const EmailEntrantStatut = {
  // Pièces jointes stockées, mais au moins un document sans texte : l'OCR passera derrière (cron)
  A_ANALYSER: 'A_ANALYSER',
  TRAITE: 'TRAITE',
  IGNORE: 'IGNORE',
  ERREUR: 'ERREUR',
} as const;

export type InboundAttachmentResult = {
  nom_fichier: string;
  statut: 'stocke' | 'deja_stocke' | 'echec';
  pool_reference?: string;
  ftp_numero?: string;
  rattachement_source?: TrichineRattachementSourceValue;
  // Ce qui a été reconnu dans le document (référence de pool / d'échantillon, numéros de bracelet)
  rattachement_indice?: TrichineRattachementIndiceValue;
  // Sur un rattachement par bracelets : « 5/5 » — une couverture partielle n'applique pas le résultat
  bracelets?: string;
  // false = le PDF ne porte aucun texte (scan) : seul un OCR permettrait de le lire
  texte_lu?: boolean;
  // Verdict lu dans le rapport, et ce qu'on en a fait
  resultat_lu?: TrichineResultatAnalyse;
  resultat_applique?: boolean;
  // Motif métier du refus (résultat déjà saisi, non autorisé pour ce laboratoire…)
  resultat_refus?: string;
  // Le rapport cite plusieurs verdicts contradictoires : la saisie manuelle reste nécessaire
  rapport_ambigu?: boolean;
};

export type InboundEmailResult = {
  message_id: string;
  // Motif d'un email écarté sans rien stocker
  ignored?: 'spam' | 'expediteur_inconnu_sans_reference' | 'aucune_piece_jointe_exploitable';
  attachments: InboundAttachmentResult[];
  stored: number;
  skipped: number;
  failed: number;
  resultats_appliques: number;
  // Documents stockés sans texte lisible : l'OCR (cron) prendra le relais
  a_ocreriser: number;
};

/**
 * Un rattachement par numéros de bracelet ne vaut décision que si le rapport cite **tous** les
 * échantillons du pool : c'est la signature d'un rapport portant sur ce mélange et lui seul.
 * Couverture partielle = le document est rattaché, mais le résultat reste à saisir à la main.
 */
export function resultatApplicable(cible: Extract<InboundTarget, { kind: 'pool' }>): boolean {
  if (cible.indice !== TrichineRattachementIndice.NUMEROS_BRACELET) return true;
  return cible.couvertureComplete;
}

/**
 * Applique au pool le verdict lu dans le rapport. Le laboratoire expéditeur en est l'auteur :
 * c'est lui qui a écrit le rapport, la traçabilité est la même que s'il avait saisi dans l'app.
 */
export async function appliquerResultatDuRapport({
  texte,
  cible,
  labo,
  nomFichier,
  expediteur,
}: {
  texte: string;
  cible: Extract<InboundTarget, { kind: 'pool' }>;
  labo: InboundLabo;
  nomFichier: string;
  expediteur: string;
}): Promise<Partial<InboundAttachmentResult>> {
  const rapport = parseTrichineReport(texte);
  if (!rapport.resultat) {
    return { rapport_ambigu: rapport.ambigu || undefined };
  }
  // Le laboratoire écrit dans son vocabulaire ; Zacharie a le sien (« non négatif » d'un LVD = douteux)
  const resultat = traduireVerdictLaboratoire(rapport.resultat, labo.isLnr);
  const trace = `Résultat lu automatiquement dans le rapport « ${nomFichier} » reçu de ${expediteur}.`;
  const outcome = await applyPoolResult({
    pool: cible.pool,
    ftp: cible.link.TrichineFTP,
    link: cible.link,
    body: {
      resultat_analyse: resultat,
      parasite_identifie: labo.isLnr ? rapport.parasite_identifie : undefined,
      reference_labo: rapport.reference_labo,
      commentaire: [cible.pool.commentaire, trace].filter(Boolean).join('\n'),
    },
    userId: labo.userId,
    isLnr: labo.isLnr,
  });
  if (outcome.kind === 'error') {
    return { resultat_lu: resultat, resultat_applique: false, resultat_refus: outcome.error };
  }
  return { resultat_lu: resultat, resultat_applique: true };
}

async function traiterEmail(
  item: InboundEmailItem
): Promise<{ result: InboundEmailResult; labo: InboundLabo | null }> {
  const messageId = messageIdFromItem(item);
  const result: InboundEmailResult = {
    message_id: messageId,
    attachments: [],
    stored: 0,
    skipped: 0,
    failed: 0,
    resultats_appliques: 0,
    a_ocreriser: 0,
  };

  if ((item.SpamScore ?? 0) > SPAM_SCORE_MAX) {
    return { result: { ...result, ignored: 'spam' }, labo: null };
  }

  const attachments = dedupeAttachmentsByName(
    (item.Attachments ?? []).filter((attachment) => isSupportedAttachment(attachment.ContentType))
  );
  if (!attachments.length) {
    return { result: { ...result, ignored: 'aucune_piece_jointe_exploitable' }, labo: null };
  }

  const expediteur = (item.From?.Address ?? '').trim().toLowerCase();
  const texteEmail = searchableTextFromItem(item);
  const poolReferencesEmail = extractPoolReferences(texteEmail);
  const ftpReferencesEmail = extractFtpReferences(texteEmail);
  const labo = expediteur ? await getSenderLabo(expediteur) : null;
  if (!labo && !poolReferencesEmail.length && !ftpReferencesEmail.length) {
    return { result: { ...result, ignored: 'expediteur_inconnu_sans_reference' }, labo: null };
  }

  // Repli commun à toutes les pièces jointes, calculé une fois
  const cibleEmail = await findInboundTarget(poolReferencesEmail, ftpReferencesEmail, labo);

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
      result.attachments.push({ nom_fichier: attachment.Name, statut: 'deja_stocke' });
      continue;
    }
    const body = await downloadInboundAttachment(attachment.DownloadToken);
    if (!body) {
      result.failed++;
      result.attachments.push({ nom_fichier: attachment.Name, statut: 'echec' });
      continue;
    }

    const contentType = normalizeContentType(attachment.ContentType);
    let cible = { kind: 'none' } as InboundTarget;
    let rattachementSource: TrichineRattachementSourceValue | undefined;
    let texteLu: boolean | undefined;
    let texte: string | null = null;

    // Sans laboratoire reconnu aucun rattachement n'est possible : inutile de lire le PDF
    if (labo && contentType === 'application/pdf') {
      texte = await extractPdfText(body);
      texteLu = !!texte;
      if (texte) {
        const cibleContenu = await findTargetInDocumentText(texte, labo);
        if (cibleContenu.kind !== 'none') {
          cible = cibleContenu;
          rattachementSource = TrichineRattachementSource.CONTENU_FICHIER;
        }
      }
    }
    // Le message ne sert que de repli : le document prime sur ce que dit l'email
    if (cible.kind === 'none' && cibleEmail.kind !== 'none') {
      cible = cibleEmail;
      rattachementSource = TrichineRattachementSource.EMAIL;
    }

    const stored = await storeTrichineDocumentFromBuffer({
      type: documentTypeForAttachment(attachment.ContentType),
      body,
      contentType,
      userId: null,
      source: TrichineDocumentSource.EMAIL,
      nomFichier: attachment.Name,
      poolId: cible.kind === 'pool' ? cible.id : undefined,
      ftpId: cible.kind === 'ftp' ? cible.id : undefined,
      email,
      rattachementSource,
      rattachementIndice: cible.kind === 'none' ? undefined : cible.indice,
      texteExtrait: texte ?? undefined,
      texteSource: texte ? TrichineTexteSource.PDF_NATIF : undefined,
      maxBytes: MAX_INBOUND_ATTACHMENT_BYTES,
    });
    if (stored.kind === 'error') {
      result.failed++;
      result.attachments.push({ nom_fichier: attachment.Name, statut: 'echec', texte_lu: texteLu });
      capture('Trichine inbound: pièce jointe non stockée', {
        extra: { messageId, fichier: attachment.Name, error: stored.error },
      });
      continue;
    }
    result.stored++;
    if (!texte) result.a_ocreriser++;

    // Le résultat n'est lu que dans un rapport rattaché par son propre contenu : le même document
    // porte alors l'identification des échantillons et le verdict, rien n'est déduit du message.
    let resultat: Partial<InboundAttachmentResult> = {};
    if (
      labo &&
      texte &&
      cible.kind === 'pool' &&
      rattachementSource === TrichineRattachementSource.CONTENU_FICHIER &&
      resultatApplicable(cible)
    ) {
      resultat = await appliquerResultatDuRapport({
        texte,
        cible,
        labo,
        nomFichier: attachment.Name,
        expediteur,
      });
      if (resultat.resultat_applique) result.resultats_appliques++;
    }

    result.attachments.push({
      nom_fichier: attachment.Name,
      statut: 'stocke',
      pool_reference: cible.kind === 'pool' ? cible.reference : undefined,
      ftp_numero: cible.kind === 'ftp' ? cible.reference : undefined,
      rattachement_source: rattachementSource,
      rattachement_indice: cible.kind === 'none' ? undefined : cible.indice,
      bracelets: cible.kind === 'pool' ? cible.bracelets : undefined,
      texte_lu: texteLu,
      ...resultat,
    });
  }

  // Un document non rattaché n'est visible de personne : il faut le rattacher à la main.
  const nonRattaches = result.attachments.filter(
    (attachment) => attachment.statut === 'stocke' && !attachment.rattachement_source
  );
  if (nonRattaches.length) {
    capture('Trichine inbound: rapport reçu sans rattachement', {
      extra: {
        messageId,
        expediteur,
        sujet: item.Subject ?? '',
        fichiers: nonRattaches.map((attachment) => attachment.nom_fichier).join(', '),
        // Un PDF sans texte est un scan : il faudrait un OCR pour le rattacher automatiquement
        pdf_sans_texte: nonRattaches.some((attachment) => attachment.texte_lu === false) ? 'oui' : 'non',
        laboratoire_reconnu: labo ? 'oui' : 'non',
      },
    });
  }

  return { result, labo };
}

/**
 * Journal de bord : une ligne par message reçu, écartés compris. C'est le seul endroit où lire
 * ce qui est arrivé sur l'adresse de dépôt — ne jamais laisser une erreur d'écriture faire
 * échouer l'ingestion elle-même.
 */
async function journaliserEmailEntrant(
  item: InboundEmailItem,
  result: InboundEmailResult,
  labo: InboundLabo | null
) {
  const statut = result.ignored
    ? EmailEntrantStatut.IGNORE
    : result.failed
      ? EmailEntrantStatut.ERREUR
      : // Sans Albert, un document sans texte le restera : inutile de le mettre en attente d'OCR
        result.a_ocreriser && IS_ALBERT_CONFIGURED
        ? EmailEntrantStatut.A_ANALYSER
        : EmailEntrantStatut.TRAITE;
  const donnees = {
    brevo_uuid: item.Uuid?.[0] ?? null,
    expediteur: (item.From?.Address ?? '').trim().toLowerCase(),
    destinataires: item.Recipients ?? (item.To ?? []).map((address) => address.Address),
    sujet: item.Subject ?? null,
    recu_at: receivedAtFromItem(item),
    spam_score: item.SpamScore ?? null,
    nb_pieces_jointes: (item.Attachments ?? []).length,
    statut,
    motif_ignore: result.ignored ?? null,
    laboratoire_reconnu: !!labo,
    detail: {
      attachments: result.attachments,
      stored: result.stored,
      skipped: result.skipped,
      failed: result.failed,
      resultats_appliques: result.resultats_appliques,
      a_ocreriser: result.a_ocreriser,
    },
  };
  try {
    await prisma.emailEntrant.upsert({
      where: { message_id: result.message_id },
      create: { message_id: result.message_id, ...donnees },
      update: donnees,
    });
  } catch (error) {
    capture(error as Error, {
      extra: { context: 'journaliser_email_entrant', messageId: result.message_id },
    });
  }
}

export async function ingestInboundEmail(item: InboundEmailItem): Promise<InboundEmailResult> {
  const { result, labo } = await traiterEmail(item);
  await journaliserEmailEntrant(item, result, labo);
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
