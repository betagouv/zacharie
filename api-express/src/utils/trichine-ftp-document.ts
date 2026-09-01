import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import {
  getFromCellar,
  IS_CELLAR_CONFIGURED,
  trichineDocumentKey,
  uploadToCellar,
} from '~/third-parties/cellar';
import { getFtpPdfBuffer } from '~/templates/get-ftp-pdf';
import { TrichineDocumentType } from '~/utils/trichine';

/**
 * PDF de la FTP : document de référence de ce qui a été effectivement envoyé au laboratoire.
 * Il est figé au moment de l'envoi et archivé sur Cellar (cf doc/trichine.md §12.2).
 * Sans Cellar (dev, test), rien n'est stocké et le PDF est régénéré à la demande.
 */

async function findFtpPdfDocument(ftpId: string) {
  return prisma.trichineDocument.findFirst({
    where: { ftp_id: ftpId, type: TrichineDocumentType.FTP_PDF, deleted_at: null },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Génère le PDF de la FTP au moment de son envoi et l'archive.
 * Renvoie le buffer (pour la pièce jointe de la notification) même si l'archivage échoue :
 * l'envoi de la FTP ne doit pas échouer parce que le stockage est indisponible.
 */
export async function archiveFtpPdf(ftpId: string, userId: string): Promise<Buffer | null> {
  const pdf = await getFtpPdfBuffer(ftpId);
  if (!pdf || !IS_CELLAR_CONFIGURED) return pdf;

  try {
    const document = await prisma.trichineDocument.create({
      data: {
        type: TrichineDocumentType.FTP_PDF,
        fichier_url: '',
        ajoute_par_user_id: userId,
        ftp_id: ftpId,
      },
    });
    const key = trichineDocumentKey({
      type: TrichineDocumentType.FTP_PDF,
      documentId: document.id,
      extension: 'pdf',
    });
    await uploadToCellar({ key, body: pdf, contentType: 'application/pdf' });
    await prisma.trichineDocument.update({ where: { id: document.id }, data: { fichier_url: key } });
  } catch (error) {
    capture(error as Error, { extra: { ftpId, context: 'archive_ftp_pdf' } });
  }
  return pdf;
}

/**
 * PDF à servir en téléchargement : la version archivée si elle existe, sinon une génération
 * à la volée (FTP encore en brouillon, ou archivage indisponible au moment de l'envoi).
 */
export async function getArchivedOrFreshFtpPdf(ftpId: string): Promise<Buffer | null> {
  if (IS_CELLAR_CONFIGURED) {
    const document = await findFtpPdfDocument(ftpId);
    if (document?.fichier_url) {
      const archived = await getFromCellar(document.fichier_url);
      if (archived) return archived;
    }
  }
  return getFtpPdfBuffer(ftpId);
}
