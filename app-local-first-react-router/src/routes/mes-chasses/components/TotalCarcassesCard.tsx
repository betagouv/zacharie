interface TotalCarcassesCardProps {
  total: number;
  season: string;
}

export default function TotalCarcassesCard({ total, season }: TotalCarcassesCardProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center justify-center text-center">
        {/* Icon */}
        <div className="mb-4 flex items-center justify-center">
          <CarcassesIcon width={45} height={45} className="text-action-high-blue-france-light" />
        </div>
        {/* Number */}
        <div className="text-action-high-blue-france-light mb-2 text-5xl font-bold">
          {total.toLocaleString('fr-FR')}
        </div>
        {/* Label */}
        <div className="text-action-high-blue-france-light mb-1 text-xl font-bold">carcasses prélevées</div>
        {/* Season */}
        <div className="text-action-high-blue-france-light text-sm">Saison {season}</div>
      </div>
    </div>
  );
}

function CarcassesIcon({ width, height, className }: { width: number; height: number; className?: string }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M7.27273 2.96065C5.04313 3.27956 3.27956 5.04313 2.96065 7.27273H4.36364V8.72727H2.96065C3.27956 10.9569 5.04313 12.7204 7.27273 13.0393V11.6364H8.72727V13.0393C10.9569 12.7204 12.7204 10.9569 13.0393 8.72727H11.6364V7.27273H13.0393C12.7204 5.04313 10.9569 3.27956 8.72727 2.96065V4.36364H7.27273V2.96065ZM1.49449 7.27273C1.82988 4.23882 4.23882 1.82988 7.27273 1.49449V0H8.72727V1.49449C11.7612 1.82988 14.1701 4.23882 14.5055 7.27273H16V8.72727H14.5055C14.1701 11.7612 11.7612 14.1701 8.72727 14.5055V16H7.27273V14.5055C4.23882 14.1701 1.82988 11.7612 1.49449 8.72727H0V7.27273H1.49449ZM9.45455 8C9.45455 8.80335 8.80335 9.45455 8 9.45455C7.19665 9.45455 6.54545 8.80335 6.54545 8C6.54545 7.19665 7.19665 6.54545 8 6.54545C8.80335 6.54545 9.45455 7.19665 9.45455 8Z"
        fill="currentColor"
      />
    </svg>
  );
}
