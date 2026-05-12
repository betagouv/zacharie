import { accentStyles, type DashboardAccent } from './KpiCard';

interface VolumeCardProps {
  volume7d: number;
  volume30d: number;
  title: string;
  accent: DashboardAccent;
  iconId?: string;
}

export default function VolumeCard({ volume7d, volume30d, title, accent, iconId }: VolumeCardProps) {
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
        <h3 className="text-action-high-blue-france-light text-lg font-bold">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border-r border-gray-200 pr-4">
          <div className="text-action-high-blue-france-light text-3xl font-bold leading-none">
            {volume7d.toLocaleString('fr-FR')}
          </div>
          <div className="mt-2 text-sm text-gray-600">7 derniers jours</div>
        </div>
        <div>
          <div className="text-action-high-blue-france-light text-3xl font-bold leading-none">
            {volume30d.toLocaleString('fr-FR')}
          </div>
          <div className="mt-2 text-sm text-gray-600">30 derniers jours</div>
        </div>
      </div>
    </div>
  );
}
