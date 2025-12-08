interface TotalCarcassesCardProps {
  total: number;
  season: string;
}

export default function TotalCarcassesCard({ total, season }: TotalCarcassesCardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center justify-center text-center">
        {/* Icon */}
        <div className="mb-4 flex items-center justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-action-high-blue-france-light"
          >
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="24" cy="24" r="4" fill="currentColor" />
          </svg>
        </div>
        {/* Number */}
        <div className="text-action-high-blue-france-light mb-2 text-4xl font-bold">
          {total.toLocaleString('fr-FR')}
        </div>
        {/* Label */}
        <div className="text-action-high-blue-france-light mb-1 text-base font-medium">
          carcasses prélevées
        </div>
        {/* Season */}
        <div className="text-action-high-blue-france-light text-sm">Saison {season}</div>
      </div>
    </div>
  );
}
