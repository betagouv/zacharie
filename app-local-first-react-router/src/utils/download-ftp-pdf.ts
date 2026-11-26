import { useCallback, useEffect, useState } from 'react';
import downloadApiFile, { fetchApiFile } from '@app/utils/download-api-file';

export default function useDownloadFtpPdf(space: 'trichine' | 'laboratoire') {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onDownloadFtpPdf = async (ftpId: string, numeroFiche: string) => {
    setIsDownloading(true);
    try {
      await downloadApiFile({
        path: `${space}/ftp/${ftpId}/pdf`,
        filename: `FTP-${numeroFiche}.pdf`,
        accept: 'application/pdf',
        erreur: 'Impossible de télécharger la fiche',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const onPreviewFtpPdf = async (ftpId: string) => {
    setIsPreviewLoading(true);
    try {
      const blob = await fetchApiFile({
        path: `${space}/ftp/${ftpId}/pdf`,
        accept: 'application/pdf',
        erreur: 'Impossible d’afficher la fiche',
      });
      if (!blob) return false;
      setPreviewUrl(window.URL.createObjectURL(blob));
      return true;
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = useCallback(() => setPreviewUrl(null), []);

  useEffect(() => {
    if (!previewUrl) return;
    return () => window.URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return { isDownloading, onDownloadFtpPdf, isPreviewLoading, previewUrl, onPreviewFtpPdf, closePreview };
}
