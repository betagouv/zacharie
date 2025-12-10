interface CarcassBreakdownCardProps {
  bigGame: number;
  smallGame: number;
}

export default function CarcassBreakdownCard({ bigGame, smallGame }: CarcassBreakdownCardProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Big Game Card */}
      <div className="flex flex-1 items-center justify-start gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <div className="text-action-high-blue-france-light text-2xl font-bold">
          {bigGame.toLocaleString('fr-FR')}
        </div>
        <div className="text-action-high-blue-france-light text-sm font-bold">
          carcasses grand gibier prélevées
        </div>
      </div>
      {/* Small Game Card */}
      <div className="flex flex-1 items-center justify-start gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <div className="text-action-high-blue-france-light text-2xl font-bold">
          {smallGame.toLocaleString('fr-FR')}
        </div>
        <div className="text-action-high-blue-france-light text-sm font-bold">
          carcasses petit gibier prélevées
        </div>
      </div>
    </div>
  );
}
