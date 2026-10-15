import { Button } from '@codegouvfr/react-dsfr/Button';
import { track } from '@app/services/matomo';
import {
  downloadTrichineExport,
  type ExportRow,
  type TrichineExportFormat,
} from '@app/utils/export-trichine';

/**
 * Export d'un registre du laboratoire pour import dans son LIMS : les lignes cochées,
 * sinon toutes les lignes affichées (filtres appliqués).
 */
export default function ExportButtons<T extends { id: string }>({
  nom,
  rows,
  selectedIds,
  toExportRow,
}: {
  nom: 'pools' | 'echantillons' | 'ftps';
  rows: Array<T>;
  selectedIds: Array<string>;
  toExportRow: (item: T) => ExportRow;
}) {
  const items = selectedIds.length ? rows.filter((item) => selectedIds.includes(item.id)) : rows;
  const exporter = (format: TrichineExportFormat) => {
    downloadTrichineExport({ rows: items.map(toExportRow), nom, format });
    track('laboratoire', 'exporter', `${nom}-${format}`, items.length);
  };
  return (
    <>
      <Button
        type="button"
        priority="secondary"
        iconId="fr-icon-download-line"
        disabled={!items.length}
        onClick={() => exporter('csv')}
      >
        Exporter en CSV ({items.length})
      </Button>
      <Button
        type="button"
        priority="secondary"
        iconId="fr-icon-download-line"
        disabled={!items.length}
        onClick={() => exporter('json')}
      >
        Exporter en JSON ({items.length})
      </Button>
    </>
  );
}
