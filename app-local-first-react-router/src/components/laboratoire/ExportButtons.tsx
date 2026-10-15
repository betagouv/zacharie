import DropDownMenu from '@app/components/DropDownMenu';
import { track } from '@app/services/matomo';
import {
  downloadTrichineExport,
  type ExportRow,
  type TrichineExportFormat,
} from '@app/utils/export-trichine';

const EXPORT_FORMATS: Array<{ format: TrichineExportFormat; label: string }> = [
  { format: 'csv', label: 'Format CSV' },
  { format: 'json', label: 'Format JSON' },
];

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
    <DropDownMenu
      text={`Exporter (${items.length})`}
      isActive={items.length > 0}
      menuLinks={EXPORT_FORMATS.map(({ format, label }) => ({
        text: label,
        linkProps: {
          href: '#',
          'aria-disabled': !items.length,
          className: !items.length ? 'cursor-not-allowed opacity-50' : '',
          onClick: (e) => {
            e.preventDefault();
            if (!items.length) return;
            exporter(format);
          },
        },
      }))}
    />
  );
}
