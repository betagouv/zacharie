interface CarcassBreakdownCardProps {
  bigGame: number;
  smallGame: number;
}

export default function CarcassBreakdownCard({ bigGame, smallGame }: CarcassBreakdownCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Big Game Card */}
      <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
        <div className="text-action-high-blue-france-light text-3xl font-bold">
          {bigGame.toLocaleString('fr-FR')}
        </div>
        <div className="text-action-high-blue-france-light text-sm font-medium">
          carcasses grand gibier prélevées
        </div>
      </div>
      {/* Small Game Card */}
      <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-sm">
        <div className="text-action-high-blue-france-light mb-1 text-3xl font-bold">
          {smallGame.toLocaleString('fr-FR')}
        </div>
        <div className="text-action-high-blue-france-light text-sm font-medium">
          carcasses petit gibier prélevées
        </div>
      </div>
    </div>
  );
}
