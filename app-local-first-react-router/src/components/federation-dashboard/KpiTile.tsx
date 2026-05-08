interface Props {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray';
}

const ACCENT_BG: Record<NonNullable<Props['accent']>, string> = {
  blue: 'bg-blue-50 border-blue-200',
  amber: 'bg-amber-50 border-amber-200',
  green: 'bg-green-50 border-green-200',
  red: 'bg-red-50 border-red-200',
  purple: 'bg-purple-50 border-purple-200',
  gray: 'bg-gray-50 border-gray-200',
};

const ACCENT_TEXT: Record<NonNullable<Props['accent']>, string> = {
  blue: 'text-blue-900',
  amber: 'text-amber-900',
  green: 'text-green-900',
  red: 'text-red-900',
  purple: 'text-purple-900',
  gray: 'text-gray-900',
};

export default function KpiTile({ label, value, sublabel, accent = 'gray' }: Props) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${ACCENT_BG[accent]}`}>
      <div className="text-xs font-medium tracking-wide text-gray-600 uppercase">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums sm:text-4xl ${ACCENT_TEXT[accent]}`}>{value}</div>
      {sublabel && <div className="mt-1 text-xs text-gray-500">{sublabel}</div>}
    </div>
  );
}
