export type DashboardAccent = 'pink' | 'blue' | 'purple' | 'green' | 'yellow' | 'orange';

export const accentStyles: Record<DashboardAccent, { iconBg: string; iconColor: string }> = {
  pink: { iconBg: 'bg-[#FEE7FC]', iconColor: 'text-[#A6557E]' },
  blue: { iconBg: 'bg-[#DEE9FF]', iconColor: 'text-[#3558A2]' },
  purple: { iconBg: 'bg-[#F3DDF8]', iconColor: 'text-[#7245C4]' },
  green: { iconBg: 'bg-[#E6FEDA]', iconColor: 'text-[#3A5B22]' },
  yellow: { iconBg: 'bg-[#FEEBA0]', iconColor: 'text-[#8C6A00]' },
  orange: { iconBg: 'bg-[#FEDDC8]', iconColor: 'text-[#B34000]' },
};

interface KpiCardProps {
  value: number;
  label: string;
  sublabel?: string;
  accent: DashboardAccent;
  iconId?: string;
}

export default function KpiCard({ value, label, sublabel, accent, iconId }: KpiCardProps) {
  const styles = accentStyles[accent];
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
        <div className="flex flex-col">
          <div className="text-action-high-blue-france-light text-5xl font-bold leading-none">
            {value.toLocaleString('fr-FR')}
          </div>
          <div className="text-action-high-blue-france-light mt-3 text-lg font-bold">{label}</div>
          {sublabel && <div className="mt-1 text-sm text-gray-600">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
