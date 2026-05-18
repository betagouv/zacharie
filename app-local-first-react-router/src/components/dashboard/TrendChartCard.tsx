import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accentStyles, type DashboardAccent } from './KpiCard';

interface TrendChartCardProps {
  title: string;
  accent: DashboardAccent;
  iconId?: string;
  data: { label: string; value: number }[];
  yLabel?: string;
}

const BAR_COLORS: Record<DashboardAccent, string> = {
  pink: '#A6557E',
  blue: '#3558A2',
  purple: '#7245C4',
  green: '#3A5B22',
  yellow: '#8C6A00',
  orange: '#B34000',
};

export default function TrendChartCard({ title, accent, iconId, data, yLabel }: TrendChartCardProps) {
  const styles = accentStyles[accent];
  const barColor = BAR_COLORS[accent];
  const isEmpty = data.every((d) => d.value === 0);

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
      {isEmpty ? (
        <p className="text-sm text-gray-500">Aucune donnée sur la période</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4B5563' }} tickLine={false} />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#4B5563' }}
                tickLine={false}
                axisLine={false}
                label={
                  yLabel
                    ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#4B5563' }
                    : undefined
                }
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v) => [Number(v).toLocaleString('fr-FR'), 'Fiches']}
              />
              <Bar dataKey="value" fill={barColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
