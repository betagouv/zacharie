import { useCallback, useEffect, useState } from 'react';
import downloadApiFile, { fetchApiFile } from '@app/utils/download-api-file';

// Télécharge ou prévisualise le PDF de la fiche de transmission des prélèvements, à imprimer et joindre au colis.
// Généré côté serveur (react-pdf) ; nécessite d'être en ligne.
// Le document est le même des deux côtés, seule la route change selon l'espace.
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

  // L'URL du blob affiché dans l'aperçu est libérée dès qu'on la remplace ou qu'on quitte la page
  useEffect(() => {
    if (!previewUrl) return;
    return () => window.URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return { isDownloading, onDownloadFtpPdf, isPreviewLoading, previewUrl, onPreviewFtpPdf, closePreview };
}
