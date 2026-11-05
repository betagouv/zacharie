import { toast } from 'react-toastify';
import type { Carcasse } from '@prisma/client';
import API from '@app/services/api';
import type { AdminSoftDeleteResponse } from '@api/src/types/responses';

// Suppression d'une carcasse par l'admin, depuis la page carcasse ou la page fiche. Renvoie la date de
// suppression, ou null si l'admin a annulé ou si le serveur a refusé (fiche clôturée…).
export async function adminSoftDeleteCarcasse(
  carcasse: Pick<Carcasse, 'zacharie_carcasse_id' | 'numero_bracelet'>
): Promise<Date | null> {
  const confirmMessage = `Supprimer la carcasse ${carcasse.numero_bracelet} ? Elle disparaîtra de l'application et des statistiques.`;
  if (!window.confirm(confirmMessage)) return null;
  const response = (await API.post({
    path: `admin/carcasse/${encodeURIComponent(carcasse.zacharie_carcasse_id)}/soft-delete`,
  })) as AdminSoftDeleteResponse;
  if (!response.ok || !response.data) {
    toast.error(response.error);
    return null;
  }
  toast.success('La carcasse a été supprimée');
  return response.data.deleted_at;
}
