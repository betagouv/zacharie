import { useEffect, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import type { CarcasseWithModificationRequests } from '@api/src/types/carcasse';
import AnomaliePicker from '@app/components/AnomaliePicker';
import { buildCarcasseNavSections } from '@app/utils/build-carcasse-nav-sections';

function countDetails(carcasse: CarcasseWithModificationRequests): number {
  return (
    (carcasse.examinateur_anomalies_carcasse?.length ?? 0) +
    (carcasse.examinateur_anomalies_abats?.length ?? 0)
  );
}

export default function CarcasseDetailsModal({
  carcasses,
  modal,
}: {
  carcasses: CarcasseWithModificationRequests[];
  modal: ReturnType<typeof createModal>;
}) {
  const isModalOpen = useIsModalOpen(modal);
  const [selectedCarcasseId, setSelectedCarcasseId] = useState<string | null>(null);

  // Repartir de la liste à chaque réouverture.
  useEffect(() => {
    if (!isModalOpen) setSelectedCarcasseId(null);
  }, [isModalOpen]);

  const selectedCarcasse = selectedCarcasseId
    ? carcasses.find((c) => c.zacharie_carcasse_id === selectedCarcasseId)
    : null;

  return (
    <modal.Component
      title="Ajouter des anomalies"
      size="large"
      buttons={[{ doClosesModal: true, children: 'Terminer' }]}
    >
      {!selectedCarcasse ? (
        <div className="flex flex-col gap-2 p-1">
          <p className="text-sm text-gray-600">
            Sélectionnez une carcasse pour ajouter ou modifier ses anomalies.
          </p>
          {carcasses.map((carcasse) => {
            const count = countDetails(carcasse);
            return (
              <button
                key={carcasse.zacharie_carcasse_id}
                type="button"
                onClick={() => setSelectedCarcasseId(carcasse.zacharie_carcasse_id)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{carcasse.numero_bracelet}</span>
                  <span className="text-sm text-gray-600">{carcasse.espece || 'Espèce à renseigner'}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {count > 0 ? `${count} anomalie${count > 1 ? 's' : ''}` : 'Aucune anomalie'}
                  </span>
                  <span
                    className="fr-icon-arrow-right-s-line"
                    aria-hidden
                  />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              priority="tertiary no outline"
              iconId="fr-icon-arrow-left-line"
              onClick={() => setSelectedCarcasseId(null)}
            >
              Carcasses
            </Button>
            <span className="text-sm font-semibold">
              {selectedCarcasse.numero_bracelet} — {selectedCarcasse.espece}
            </span>
          </div>
          <AnomaliePicker
            key={selectedCarcasse.zacharie_carcasse_id}
            sections={buildCarcasseNavSections(selectedCarcasse)}
          />
        </div>
      )}
    </modal.Component>
  );
}
