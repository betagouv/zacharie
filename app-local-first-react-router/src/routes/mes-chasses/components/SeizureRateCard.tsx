interface SeizureRateCardProps {
  rate: number;
  label: string;
  isNational?: boolean;
}

export default function SeizureRateCard({ rate, label, isNational = false }: SeizureRateCardProps) {
  return (
    <div className="flex flex-col items-center justify-between rounded-lg bg-white p-6 shadow-sm">
      <div className="text-action-high-blue-france-light mb-3 text-4xl font-bold">
        {rate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
      </div>
      <div className="text-action-high-blue-france-light mb-4 text-base font-medium">{label}</div>
      <div className="flex justify-end">
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
