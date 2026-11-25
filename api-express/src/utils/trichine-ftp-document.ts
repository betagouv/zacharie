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

async function findFtpPdfDocument(ftpId: string) {
  return prisma.trichineDocument.findFirst({
    where: { ftp_id: ftpId, type: TrichineDocumentType.FTP_PDF, deleted_at: null },
    orderBy: { created_at: 'desc' },
  });
}

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
