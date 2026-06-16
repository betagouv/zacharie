import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { useLocalStorage } from '@uidotdev/usehooks';
import useZustandStore from '@app/zustand/store';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import useExportFeis, {
  EXPORT_COLUMNS_CATALOG,
  DEFAULT_EXPORT_COLUMN_KEYS,
  SIMPLIFIED_EXPORT_COLUMN_KEYS,
} from '@app/utils/export-feis';

const exportModal = createModal({
  id: 'export-feis-columns',
  isOpenedByDefault: false,
});

const catalogByKey = Object.fromEntries(EXPORT_COLUMNS_CATALOG.map((c) => [c.key, c]));

type Props = {
  feiNumbers: Array<string>;
  storageKey: string;
};

export default function ExportFeisModal({ feiNumbers, storageKey }: Props) {
  const { onExportToXlsx, isExporting } = useExportFeis();
  const carcasses = useZustandStore((state) => state.carcasses);

  // Nombre de carcasses qui seront effectivement exportées (mêmes exclusions que l'export :
  // supprimées / manquantes / refusées), 1 ligne = 1 carcasse.
  const feiNumbersKey = feiNumbers.join('|');
  const carcassesCount = useMemo(() => {
    let count = 0;
    for (const feiNumero of feiNumbers) {
      for (const carcasse of filterCarcassesForFei(carcasses, feiNumero)) {
        if (!carcasse) continue;
        if (carcasse.deleted_at) continue;
        if (carcasse.intermediaire_carcasse_manquante) continue;
        if (carcasse.intermediaire_carcasse_refus_intermediaire_id) continue;
        count++;
      }
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feiNumbersKey, carcasses]);
  const [isOpen, setIsOpen] = useState(false);
  const [exportSucceeded, setExportSucceeded] = useState(false);
  useIsModalOpen(exportModal, {
    onDisclose: () => {
      setIsOpen(true);
      setExportSucceeded(false);
    },
    onConceal: () => setIsOpen(false),
  });

  const [selectedKeys, setSelectedKeys] = useLocalStorage<Array<string>>(
    storageKey,
    DEFAULT_EXPORT_COLUMN_KEYS
  );

  // Toute modification des colonnes invalide le message de succès précédent.
  // NB: useLocalStorage renvoie un nouveau tableau à chaque rendu, donc on dépend
  // d'une signature primitive (sinon l'effet se déclencherait à chaque rendu et
  // effacerait aussitôt l'état de succès).
  const selectedKeysSignature = selectedKeys.join('|');
  useEffect(() => {
    setExportSucceeded(false);
  }, [selectedKeysSignature]);

  const orderedSelected = selectedKeys.map((k) => catalogByKey[k]).filter(Boolean);
  const hiddenColumns = EXPORT_COLUMNS_CATALOG.filter((c) => !selectedKeys.includes(c.key));

  const moveColumn = (key: string, direction: -1 | 1) => {
    const idx = selectedKeys.indexOf(key);
    if (idx === -1) return;
    const next = idx + direction;
    if (next < 0 || next >= selectedKeys.length) return;
    const newKeys = [...selectedKeys];
    [newKeys[idx], newKeys[next]] = [newKeys[next], newKeys[idx]];
    setSelectedKeys(newKeys);
  };

  const hasSelection = feiNumbers.length > 0;

  const openExportModal = () => {
    setIsOpen(true);
    setExportSucceeded(false);
    exportModal.open();
  };

  const canExport = !isExporting && orderedSelected.length > 0 && hasSelection;
  const doExport = async () => {
    if (!canExport) return;
    const succeeded = await onExportToXlsx(feiNumbers, selectedKeys);
    setExportSucceeded(succeeded);
  };

  return (
    <>
      <Button
        priority="tertiary"
        iconId="fr-icon-file-download-line"
        onClick={openExportModal}
      >
        Exporter
      </Button>

      <exportModal.Component
        size="large"
        title="Exporter les fiches sélectionnées"
        buttons={
          exportSucceeded
            ? [
                {
                  children: 'Fermer',
                  priority: 'secondary',
                  doClosesModal: true,
                },
              ]
            : [
                {
                  children: 'Annuler',
                  priority: 'secondary',
                  doClosesModal: true,
                },
                {
                  children: isExporting ? 'Export en cours…' : `Exporter`,
                  doClosesModal: false,
                  disabled: !canExport,
                  onClick: doExport,
                },
              ]
        }
      >
        {isOpen && exportSucceeded && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span
              className="ri-checkbox-circle-fill text-6xl text-green-600"
              aria-hidden="true"
            />
            <p className="text-3xl font-bold text-gray-900">Export terminé.</p>
            <p className="text-sm text-gray-600">
              {feiNumbers.length} fiche{feiNumbers.length > 1 ? 's' : ''} · {carcassesCount} carcasse
              {carcassesCount > 1 ? 's' : ''} — le fichier Excel a été téléchargé.
            </p>
          </div>
        )}

        {isOpen && !exportSucceeded && (
          <>
            {!hasSelection && (
              <Alert
                className="mb-3"
                severity="info"
                small
                description="Sélectionnez d'abord des fiches (case à cocher en haut à droite de chaque carte) pour pouvoir les exporter. Vous pouvez déjà configurer les colonnes ci-dessous."
              />
            )}
            {hasSelection && (
              <p className="mb-3 rounded bg-gray-100 px-3 py-2 text-sm text-gray-900">
                <strong>{feiNumbers.length}</strong> fiche{feiNumbers.length > 1 ? 's' : ''} sélectionnée
                {feiNumbers.length > 1 ? 's' : ''}
                {' · '}
                <strong>{carcassesCount}</strong> carcasse{carcassesCount > 1 ? 's' : ''} à exporter
              </p>
            )}
            <p className="mb-3 text-sm text-gray-700">
              Choisissez les colonnes à exporter et leur ordre. Ce choix est conservé pour vos prochains
              exports. Une feuille de métadonnées par fiche est toujours ajoutée au fichier.
            </p>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setSelectedKeys(EXPORT_COLUMNS_CATALOG.map((c) => c.key))}
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setSelectedKeys([])}
              >
                Tout désélectionner
              </button>
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setSelectedKeys(SIMPLIFIED_EXPORT_COLUMN_KEYS)}
              >
                Export simplifié
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-800">
                  Colonnes exportées ({orderedSelected.length})
                </h3>
                {orderedSelected.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Aucune colonne sélectionnée.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {orderedSelected.map((c, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === orderedSelected.length - 1;
                      return (
                        <li
                          key={c.key}
                          className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
                        >
                          <span className="flex-1 truncate text-sm">{c.label}</span>
                          <button
                            type="button"
                            aria-label={`Monter ${c.label}`}
                            title="Monter"
                            disabled={isFirst}
                            className="rounded px-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            onClick={() => moveColumn(c.key, -1)}
                          >
                            <span
                              className="fr-icon--sm fr-icon-arrow-up-line"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            aria-label={`Descendre ${c.label}`}
                            title="Descendre"
                            disabled={isLast}
                            className="rounded px-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            onClick={() => moveColumn(c.key, 1)}
                          >
                            <span
                              className="fr-icon--sm fr-icon-arrow-down-line"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            aria-label={`Retirer ${c.label}`}
                            title="Retirer"
                            className="rounded px-1 text-gray-600 hover:bg-gray-100"
                            onClick={() => setSelectedKeys(selectedKeys.filter((k) => k !== c.key))}
                          >
                            <span
                              className="fr-icon--sm fr-icon-close-line"
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-800">
                  Colonnes disponibles ({hiddenColumns.length})
                </h3>
                {hiddenColumns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Toutes les colonnes sont exportées.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {hiddenColumns.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center gap-2 rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-1.5"
                      >
                        <span className="flex-1 truncate text-sm text-gray-700">{c.label}</span>
                        <button
                          type="button"
                          aria-label={`Ajouter ${c.label}`}
                          title="Ajouter"
                          className="text-action-high-blue-france inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs underline"
                          onClick={() => setSelectedKeys([...selectedKeys, c.key])}
                        >
                          <span
                            className="fr-icon--sm fr-icon-add-line"
                            aria-hidden="true"
                          />
                          Ajouter
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </exportModal.Component>
    </>
  );
}
