import { accentStyles, type DashboardAccent } from './KpiCard';

interface EspeceBreakdownCardProps {
  gros: number;
  petit: number;
  accent: DashboardAccent;
  iconId?: string;
}

export default function EspeceBreakdownCard({ gros, petit, accent, iconId }: EspeceBreakdownCardProps) {
  const styles = accentStyles[accent];
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        {iconId && (
          <div
            className={[
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
              styles.iconBg,
            ].join(' ')}
          >
            <span
              className={[iconId, styles.iconColor].join(' ')}
              style={{ fontSize: '28px' }}
              aria-hidden="true"
            />
          </div>
        )}
        <h3 className="text-action-high-blue-france-light text-lg font-bold">Carcasses sur fiches actives</h3>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm text-gray-600">Grand gibier</span>
          <span className="text-action-high-blue-france-light text-2xl font-bold">
            {gros.toLocaleString('fr-FR')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Petit gibier</span>
          <span className="text-action-high-blue-france-light text-2xl font-bold">
            {petit.toLocaleString('fr-FR')}
          </span>
        </div>
      </div>
    </div>
  );
}
