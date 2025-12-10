interface SeizureRateCardProps {
  rate: number;
  label: string;
}

export default function SeizureRateCard({ rate, label }: SeizureRateCardProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-6 shadow-sm">
      <div className="text-action-high-blue-france-light mb-3 text-4xl font-bold">
        {rate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
      </div>
      <div className="text-action-high-blue-france-light mb-4 text-base font-bold">{label}</div>
    </div>
  );
}
