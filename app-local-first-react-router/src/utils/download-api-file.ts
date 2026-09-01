import { toast } from 'react-toastify';
import { capture } from '@app/services/sentry';
import API from '@app/services/api';

/**
 * Télécharge un fichier servi par l'API (PDF de fiche de transmission, document déposé sur un pool).
 * Quand l'API refuse la demande elle répond en JSON et non en binaire : on affiche alors son message.
 * Nécessite d'être en ligne.
 */
export default async function downloadApiFile({
  path,
  filename,
  accept = 'application/octet-stream',
  erreur = 'Impossible de télécharger le fichier',
}: {
  path: string;
  filename: string;
  accept?: string;
  erreur?: string;
}): Promise<boolean> {
  try {
    const res = await API.get({ path, headers: { Accept: accept } });
    if (!(res instanceof Response)) {
      toast.error(res?.error || erreur);
      return false;
    }
    if (res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || erreur);
      return false;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    capture(error as Error, { extra: { path } });
    toast.error('Une erreur est survenue lors du téléchargement');
    return false;
  }
}
