import dayjs from 'dayjs';
import type { TrichineHistoriqueStatut } from '@prisma/client';
import { libelleStatutHistorique } from '@app/utils/trichine';
import { TrichineCard } from '@app/components/trichine/TrichineDetailPage';

/**
 * Historique réglementaire des changements de statut (`TrichineHistoriqueStatut`).
 * Affiché en colonne latérale sur chaque page de détail : c'est la trace de ce qui s'est
 * passé sur l'objet, et la réponse à « pourquoi ce pool est dans cet état ? ».
 */
export default function TrichineChronologie({ historique }: { historique: Array<TrichineHistoriqueStatut> }) {
  return (
    <TrichineCard titre="Chronologie">
      {historique.length === 0 ? (
        <p className="fr-text--sm fr-mb-0 text-gray-500">Aucun changement enregistré pour l'instant.</p>
      ) : (
        <ul className="m-0 list-none space-y-4 p-0">
          {historique.map((event) => (
            <li
              key={event.id}
              className="border-l-2 border-gray-200 pl-4"
            >
              <p className="fr-text--xs fr-mb-0 text-gray-600">
                {dayjs(event.date_changement).format('DD/MM/YYYY à HH:mm')}
              </p>
              <p className="fr-text--sm fr-mb-0 font-medium">
                {event.ancien_statut && (
                  <span className="text-gray-500">
                    {libelleStatutHistorique(event.ancien_statut)}
                    {' → '}
                  </span>
                )}
                {libelleStatutHistorique(event.nouveau_statut)}
              </p>
              {!!event.commentaire && (
                <p className="fr-text--xs fr-mb-0 text-gray-600">{event.commentaire}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </TrichineCard>
  );
}
