import CollapsibleSection from './CollapsibleSection';

interface DateRangeFilterSectionProps {
  title: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  defaultOpen?: boolean;
}

// Section de filtre « Du / Au », même design que la page « Mes fiches ».
// Les deux bornes se limitent mutuellement pour empêcher une plage inversée.
export default function DateRangeFilterSection({
  title,
  from,
  to,
  onChange,
  defaultOpen = true,
}: DateRangeFilterSectionProps) {
  const activeCount = (from ? 1 : 0) + (to ? 1 : 0);
  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      badge={
        activeCount > 0 ? (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">{activeCount}</span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700">Du</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onChange(e.target.value, to)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700">Au</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onChange(from, e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>
    </CollapsibleSection>
  );
}
