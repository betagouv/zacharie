interface RefusalCause {
  label: string;
  count: number;
}

interface RefusalCausesCardProps {
  causes: RefusalCause[];
}

export default function RefusalCausesCard({ causes }: RefusalCausesCardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="text-action-high-blue-france-light mb-4 text-lg font-semibold">
        Causes de refus fréquents
      </div>
      <div className="space-y-3">
        {causes.map((cause, index) => (
          <div
            key={index}
            className="text-action-high-blue-france-light flex flex-row items-center justify-between"
          >
            <span className="text-base font-medium">{cause.count}</span>
            <span className="ml-3 flex-1 text-base">{cause.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="text-action-high-blue-france-light inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
          aria-label="Plus d'informations"
        >
          <span className="text-xs font-bold">?</span>
        </button>
      </div>
    </div>
  );
}
