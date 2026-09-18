import {
  type CircuitBucket,
  type PetitGibierBucket,
} from '@app/components/federation-dashboard/DepartementsTable';

interface Props {
  code: string;
  nom: string;
  gg: CircuitBucket;
  pg: PetitGibierBucket;
}

function formatTaux(taux: number | null): string {
  if (taux === null) return '—';
  return `${taux}%`;
}

function CircuitRow({
  label,
  gg,
  pgAnimaux,
  pgLots,
}: {
  label: string;
  gg: number;
  pgAnimaux: number;
  pgLots: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-100 py-1.5 last:border-b-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-right text-sm font-medium">{gg}</span>
      <span className="text-right text-sm font-medium">
        {pgAnimaux}
        <span className="block text-xs font-normal text-gray-500">
          {pgLots} lot{pgLots > 1 ? 's' : ''}
        </span>
      </span>
    </div>
  );
}

export default function DepartementValorisationCard({ code, nom, gg, pg }: Props) {
  const totalGg = gg.agree + gg.nonAgree + gg.domestique;
  const totalPgLots = pg.agree + pg.nonAgree + pg.domestique;
  const totalPgAnimaux = pg.agreeAnimaux + pg.nonAgreeAnimaux + pg.domestiqueAnimaux;

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
        pgAnimaux={pg.agreeAnimaux}
        pgLots={pg.agree}
      />
      <CircuitRow
        label="Circuit non agréé"
        gg={gg.nonAgree}
        pgAnimaux={pg.nonAgreeAnimaux}
        pgLots={pg.nonAgree}
      />
      <CircuitRow
        label="Usage domestique privé"
        gg={gg.domestique}
        pgAnimaux={pg.domestiqueAnimaux}
        pgLots={pg.domestique}
      />
      <div className="grid grid-cols-3 gap-2 py-1.5 font-semibold">
        <span className="text-sm">Total</span>
        <span className="text-right text-sm">{totalGg} animaux</span>
        <span className="text-right text-sm">
          {totalPgAnimaux} animaux
          <span className="block text-xs font-normal text-gray-500">
            {totalPgLots} lot{totalPgLots > 1 ? 's' : ''}
          </span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Taux saisie GG</div>
          <div className="text-lg font-semibold">{formatTaux(gg.tauxSaisie)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">Taux saisie PG (lots)</div>
          <div className="text-lg font-semibold">{formatTaux(pg.tauxSaisie)}</div>
        </div>
      </div>
    </div>
  );
}
