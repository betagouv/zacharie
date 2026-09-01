import { useState } from 'react';
import downloadApiFile from '@app/utils/download-api-file';

// Télécharge le PDF de la fiche de transmission des prélèvements, à imprimer et joindre au colis.
// Généré côté serveur (react-pdf) ; nécessite d'être en ligne.
// Le document est le même des deux côtés, seule la route change selon l'espace.
export default function useDownloadFtpPdf(space: 'trichine' | 'laboratoire') {
  const [isDownloading, setIsDownloading] = useState(false);

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

  return { isDownloading, onDownloadFtpPdf };
}
