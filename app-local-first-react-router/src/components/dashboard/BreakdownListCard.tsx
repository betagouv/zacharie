import { accentStyles, type DashboardAccent } from './KpiCard';

export interface BreakdownItem {
  label: string;
  value: number;
  sublabel?: string;
}

interface BreakdownListCardProps {
  title: string;
  accent: DashboardAccent;
  iconId?: string;
  items: BreakdownItem[];
  emptyLabel?: string;
}

export default function BreakdownListCard({
  title,
  accent,
  iconId,
  items,
  emptyLabel = 'Aucune donnée',
}: BreakdownListCardProps) {
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
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li
              key={`${item.label}-${index}`}
              className={[
                'flex items-center justify-between gap-3',
                index < items.length - 1 ? 'border-b border-gray-100 pb-3' : '',
              ].join(' ')}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-gray-700">{item.label}</span>
                {item.sublabel && (
                  <span className="truncate text-xs text-gray-500">{item.sublabel}</span>
                )}
              </div>
              <span className="text-action-high-blue-france-light shrink-0 text-2xl font-bold">
                {item.value.toLocaleString('fr-FR')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
