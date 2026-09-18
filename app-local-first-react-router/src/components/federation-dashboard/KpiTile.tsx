interface Props {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray';
}

// La couleur ne sert qu'à repérer la tuile : un filet vertical, pas un aplat.
const ACCENT_RULE: Record<NonNullable<Props['accent']>, string> = {
  blue: 'bg-blue-600',
  amber: 'bg-amber-500',
  green: 'bg-emerald-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
  gray: 'bg-gray-400',
};

export default function KpiTile({ label, value, sublabel, accent = 'gray' }: Props) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white py-4 pr-4 pl-5">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT_RULE[accent]}`}
      />
      <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 tabular-nums sm:text-4xl">
        {value}
      </div>
      {sublabel && <div className="mt-1.5 text-xs leading-snug text-gray-500">{sublabel}</div>}
    </div>
  );
}
