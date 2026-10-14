import type { EmailEntrant, TrichineDocument } from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { IS_ALBERT_CONFIGURED, ocrDocument } from '~/third-parties/albert';
import { getFromCellar, IS_CELLAR_CONFIGURED } from '~/third-parties/cellar';
import { DOCUMENT_CONTENT_TYPE_BY_EXTENSION } from '~/utils/trichine-document-upload';
import { TrichineDocumentSource, TrichineRattachementSource, TrichineTexteSource } from '~/utils/trichine';
import {
  appliquerResultatDuRapport,
  EmailEntrantStatut,
  findTargetInDocumentText,
  getSenderLabo,
  resultatApplicable,
  type InboundLabo,
} from '~/utils/trichine-inbound-email';

/**
 * Deuxième passe sur les rapports reçus par email : ceux dont le PDF ne portait aucun texte.
 * Sur les rapports réels, ce sont les plus nombreux — des scans. Le document est relu depuis
 * Cellar, rastérisé et lu par un modèle de vision d'Albert (cf third-parties/albert.ts), puis on
 * rejoue le même chemin que pour un PDF natif : rattachement d'après ce qui est lu, puis verdict.
 *
 * Asynchrone (cronjob) parce qu'un OCR prend des secondes, là où le webhook Brevo doit répondre
 * tout de suite. La file d'attente, c'est le journal lui-même : `EmailEntrant.statut`.
 */

export type OcrDocumentResult = {
  document_id: string;
  nom_fichier: string | null;
  texte_lu: boolean;
  pool_reference?: string;
  ftp_numero?: string;
  rattachement_indice?: string;
  bracelets?: string;
  resultat_lu?: string;
  resultat_applique?: boolean;
  resultat_refus?: string;
  rapport_ambigu?: boolean;
};

async function analyserDocument(
  document: TrichineDocument,
  labo: InboundLabo | null,
  expediteur: string
): Promise<OcrDocumentResult> {
  const resultat: OcrDocumentResult = {
    document_id: document.id,
    nom_fichier: document.nom_fichier,
    texte_lu: false,
  };

  const fichier = await getFromCellar(document.fichier_url);
  if (!fichier) return resultat;
  const extension = document.fichier_url.split('.').pop() ?? '';
  const texte = await ocrDocument(fichier, DOCUMENT_CONTENT_TYPE_BY_EXTENSION[extension] ?? '');
  if (!texte) return resultat;

  resultat.texte_lu = true;
  await prisma.trichineDocument.update({
    where: { id: document.id },
    data: { texte_extrait: texte, texte_source: TrichineTexteSource.OCR_ALBERT },
  });

  // Sans laboratoire reconnu, le texte ne donne aucun droit de rattachement
  if (!labo) return resultat;

  const cible = await findTargetInDocumentText(texte, labo);
  if (cible.kind === 'none') return resultat;

  // Le contenu du document prime : s'il était rattaché d'après le sujet du message, l'OCR corrige.
  await prisma.trichineDocument.update({
    where: { id: document.id },
    data: {
      pool_id: cible.kind === 'pool' ? cible.id : null,
      ftp_id: cible.kind === 'ftp' ? cible.id : null,
      rattachement_source: TrichineRattachementSource.CONTENU_OCR,
      rattachement_indice: cible.indice,
    },
  });
  if (cible.kind === 'ftp') {
    resultat.ftp_numero = cible.reference;
    resultat.rattachement_indice = cible.indice;
    return resultat;
  }

  resultat.pool_reference = cible.reference;
  resultat.rattachement_indice = cible.indice;
  resultat.bracelets = cible.bracelets;
  // Couverture partielle des bracelets : on rattache, mais on ne décide pas à la place du labo
  if (!resultatApplicable(cible)) return resultat;

  const applique = await appliquerResultatDuRapport({
    texte,
    cible,
    labo,
    nomFichier: document.nom_fichier ?? 'rapport',
    expediteur,
  });
  return { ...resultat, ...applique };
}

/** Traite un message en attente d'OCR : tous ses documents encore sans texte. */
export async function analyserEmailEntrant(emailEntrant: EmailEntrant): Promise<OcrDocumentResult[]> {
  const documents = await prisma.trichineDocument.findMany({
    where: {
      email_message_id: emailEntrant.message_id,
      source: TrichineDocumentSource.EMAIL,
      texte_extrait: null,
      deleted_at: null,
    },
  });
  const labo = emailEntrant.expediteur ? await getSenderLabo(emailEntrant.expediteur) : null;

  const resultats: OcrDocumentResult[] = [];
  for (const document of documents) {
    try {
      resultats.push(await analyserDocument(document, labo, emailEntrant.expediteur));
    } catch (error) {
      capture(error as Error, { extra: { context: 'ocr_document', documentId: document.id } });
      resultats.push({ document_id: document.id, nom_fichier: document.nom_fichier, texte_lu: false });
    }
  }

  // Un document illisible même après OCR reste à traiter à la main : le statut ERREUR le signale
  // et sort le message de la file — le rejouer se fait en le repassant à A_ANALYSER.
  const statut = resultats.some((resultat) => !resultat.texte_lu)
    ? EmailEntrantStatut.ERREUR
    : EmailEntrantStatut.TRAITE;
  const detail = (emailEntrant.detail ?? {}) as Record<string, unknown>;
  await prisma.emailEntrant.update({
    where: { id: emailEntrant.id },
    data: { statut, detail: { ...detail, ocr: resultats } },
  });

  return resultats;
}

/** Reprend les messages en attente d'OCR, du plus ancien au plus récent. */
export async function analyserEmailsEntrantsEnAttente(limite = 20): Promise<number> {
  if (!IS_ALBERT_CONFIGURED || !IS_CELLAR_CONFIGURED) return 0;
  const emails = await prisma.emailEntrant.findMany({
    where: { statut: EmailEntrantStatut.A_ANALYSER },
    orderBy: { recu_at: 'asc' },
    take: limite,
  });
  for (const email of emails) {
    await analyserEmailEntrant(email);
  }
  return emails.length;
}
