import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import type { SviCarcasseAVenir } from '@api/src/types/responses';
import {
  countAnimaux,
  groupCarcassesAVenirByFiche,
  sviCarcassesAVenirModal,
} from '@app/utils/svi-carcasses-a-venir';

// Modale partagée (dashboard + registre SVI) : détail des carcasses acceptées par un ETG
// rattaché au SVI mais pas encore transmises.
export default function SviCarcassesAVenirModal({ carcasses }: { carcasses: Array<SviCarcasseAVenir> }) {
  const isOpen = useIsModalOpen(sviCarcassesAVenirModal);
  const fiches = useMemo(() => groupCarcassesAVenirByFiche(carcasses), [carcasses]);

  return (
    <sviCarcassesAVenirModal.Component
      size="large"
      title={`Détail des fiches à venir (${fiches.length})`}
      buttons={[{ children: 'Fermer', priority: 'secondary', doClosesModal: true }]}
    >
      {isOpen && (
        <>
          <p className="fr-text--sm mb-3 text-gray-600">
            Carcasses acceptées chez un de vos ETG, en attente de transmission au SVI. Les plus anciennes sont
            probablement les prochaines à vous être transmises.
          </p>
          {fiches.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune carcasse en attente chez vos ETG pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">Fiche</th>
                    <th className="px-4 py-2 font-medium">ETG</th>
                    <th className="px-4 py-2 font-medium">Arrivée chez l'ETG</th>
                    <th className="px-4 py-2 font-medium">Carcasses</th>
                  </tr>
                </thead>
                <tbody>
                  {fiches.map((fiche) => {
                    const especes = new Map<string, number>();
                    for (const carcasse of fiche.carcasses) {
                      if (!carcasse.espece) continue;
                      especes.set(
                        carcasse.espece,
                        (especes.get(carcasse.espece) ?? 0) + countAnimaux(carcasse)
                      );
                    }
                    return (
                      <tr
                        key={fiche.fei_numero}
                        className="border-t border-gray-100 align-top"
                      >
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{fiche.fei_numero}</td>
                        <td className="px-4 py-2">{fiche.etg_nom}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {fiche.arrived_at ? dayjs(fiche.arrived_at).format('DD/MM/YYYY') : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {Array.from(especes.entries())
                            .sort((a, b) => b[1] - a[1])
                            .map(([espece, count]) => `${count} ${espece}`)
                            .join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </sviCarcassesAVenirModal.Component>
  );
}
