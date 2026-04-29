interface CircuitBucket {
  agree: number;
  nonAgree: number;
  domestique: number;
  tauxSaisie: number | null;
}

interface Props {
  code: string;
  nom: string;
  gg: CircuitBucket;
  pg: CircuitBucket;
}

function formatTaux(taux: number | null): string {
  if (taux === null) return '—';
  return `${taux}%`;
}

function CircuitRow({ label, gg, pg }: { label: string; gg: number; pg: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 py-1.5 last:border-b-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-right text-sm font-medium">{gg}</span>
      <span className="text-right text-sm font-medium">{pg}</span>
    </div>
  );
}

export default function DepartementValorisationCard({ code, nom, gg, pg }: Props) {
  const totalGg = gg.agree + gg.nonAgree + gg.domestique;
  const totalPg = pg.agree + pg.nonAgree + pg.domestique;

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="fr-h5 mb-0">
          <span className="text-action-high-blue-france">{code}</span>
          <span className="text-gray-700"> — {nom}</span>
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b-2 border-gray-300 pb-1.5">
        <span className="text-xs text-gray-500 uppercase">Circuit</span>
        <span className="text-right text-xs text-gray-500 uppercase">Grand gibier</span>
        <span className="text-right text-xs text-gray-500 uppercase">Petit gibier</span>
      </div>
      <CircuitRow
        label="Circuit agréé (ETG)"
        gg={gg.agree}
        pg={pg.agree}
      />
      <CircuitRow
        label="Circuit non agréé"
        gg={gg.nonAgree}
        pg={pg.nonAgree}
      />
      <CircuitRow
        label="Usage domestique privé"
        gg={gg.domestique}
        pg={pg.domestique}
      />
      <div className="grid grid-cols-3 gap-2 py-1.5 font-semibold">
        <span className="text-sm">Total</span>
        <span className="text-right text-sm">{totalGg}</span>
        <span className="text-right text-sm">{totalPg}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Taux saisie GG</div>
          <div className="text-lg font-semibold">{formatTaux(gg.tauxSaisie)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Taux saisie PG</div>
          <div className="text-lg font-semibold">{formatTaux(pg.tauxSaisie)}</div>
        </div>
      </div>
    </div>
  );
}
