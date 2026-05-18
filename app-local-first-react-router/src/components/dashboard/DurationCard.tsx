import { accentStyles, type DashboardAccent } from './KpiCard';

interface DurationCardProps {
  title: string;
  accent: DashboardAccent;
  iconId?: string;
  durationMs: number | null;
  sublabel?: string;
}

function formatDuration(ms: number): { value: string; unit: string } {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return { value: String(seconds), unit: 'sec' };

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { value: String(minutes), unit: minutes > 1 ? 'minutes' : 'minute' };

  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    return { value: rounded.toLocaleString('fr-FR'), unit: rounded > 1 ? 'heures' : 'heure' };
  }

  const days = ms / (1000 * 60 * 60 * 24);
  const roundedDays = Math.round(days * 10) / 10;
  return { value: roundedDays.toLocaleString('fr-FR'), unit: roundedDays > 1 ? 'jours' : 'jour' };
}

export default function DurationCard({ title, accent, iconId, durationMs, sublabel }: DurationCardProps) {
  const styles = accentStyles[accent];
  const formatted = durationMs != null && durationMs >= 0 ? formatDuration(durationMs) : null;

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        {iconId && (
          <div
            className={[
              'flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl',
              styles.iconBg,
            ].join(' ')}
          >
            <span
              className={[iconId, styles.iconColor].join(' ')}
              style={{ fontSize: '40px' }}
              aria-hidden="true"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          {formatted ? (
            <div className="flex items-baseline gap-2">
              <span className="text-action-high-blue-france-light text-5xl font-bold leading-none">
                {formatted.value}
              </span>
              <span className="text-action-high-blue-france-light text-2xl font-bold">
                {formatted.unit}
              </span>
            </div>
          ) : (
            <span className="text-action-high-blue-france-light text-3xl font-bold leading-none">—</span>
          )}
          <div className="text-action-high-blue-france-light mt-3 text-lg font-bold">{title}</div>
          {sublabel && <div className="mt-1 text-sm text-gray-600">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
