import { useState } from 'react';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';
import API from '@app/services/api';

// Télécharge en un seul .zip les certificats des carcasses sélectionnées (registre SVI).
// Le zip est généré côté serveur (POST /certificat/bulk-zip) ; nécessite d'être en ligne.
export default function useDownloadCertificats() {
  const [isDownloading, setIsDownloading] = useState(false);

  const onDownloadCertificats = async (zacharie_carcasse_ids: Array<string>) => {
    if (zacharie_carcasse_ids.length === 0) return;
    setIsDownloading(true);
    try {
      const res = await API.post({
        path: 'certificat/bulk-zip',
        headers: { Accept: 'application/zip' },
        body: { zacharie_carcasse_ids },
      });
      // en cas d'erreur (aucun certificat, non autorisé...), l'API répond en JSON et non en zip
      if (!(res instanceof Response)) {
        toast.error(res?.error || 'Impossible de télécharger les certificats');
        return;
      }
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Aucun certificat à télécharger pour cette sélection');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificats-svi-${dayjs().format('YYYY-MM-DD')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      capture(error as Error, { extra: { zacharie_carcasse_ids } });
      toast.error('Une erreur est survenue lors du téléchargement des certificats');
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, onDownloadCertificats };
}
