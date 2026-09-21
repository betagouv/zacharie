import { PieChart } from 'react-dsfr-chart/PieChart';
import 'react-dsfr-chart/css';

interface ValorisationTotals {
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  ggTauxSaisie: number | null;
  pgAgreeAnimaux: number;
  pgNonAgreeAnimaux: number;
  pgDomestiqueAnimaux: number;
  pgTauxSaisie: number | null;
}

interface Props {
  totals: ValorisationTotals | null;
}

function buildPieData(totals: ValorisationTotals, type: 'gg' | 'pg') {
  const [agree, nonAgree, domestique] =
    type === 'gg'
      ? [totals.ggAgree, totals.ggNonAgree, totals.ggDomestique]
      : [totals.pgAgreeAnimaux, totals.pgNonAgreeAnimaux, totals.pgDomestiqueAnimaux];
  const labels: string[] = [];
  const values: number[] = [];
  if (agree > 0) {
    labels.push('Circuit agréé (ETG)');
    values.push(agree);
  }
  if (nonAgree > 0) {
    labels.push('Circuit non agréé');
    values.push(nonAgree);
  }
  if (domestique > 0) {
    labels.push('Usage domestique privé');
    values.push(domestique);
  }
  return { labels, values };
}

export default function SectionValorisation({ totals }: Props) {
  const gg = totals ? buildPieData(totals, 'gg') : { labels: [], values: [] };
  const pg = totals ? buildPieData(totals, 'pg') : { labels: [], values: [] };
  const ggEmpty = gg.values.length === 0;
  const pgEmpty = pg.values.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-blue-600"
        />
        <h3 className="mb-3 text-lg font-bold">Circuits grand gibier</h3>
        {ggEmpty ? (
          <p className="py-12 text-center text-sm text-gray-500">Aucune donnée</p>
        ) : (
          <PieChart
            x={gg.labels}
            y={gg.values}
            name={gg.labels}
            fill
            selectedPalette="categorical"
          />
        )}
      </div>
      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-amber-500"
        />
        <h3 className="mb-3 text-lg font-bold">Circuits petit gibier</h3>
        {pgEmpty ? (
          <p className="py-12 text-center text-sm text-gray-500">Aucune donnée</p>
        ) : (
          <PieChart
            x={pg.labels}
            y={pg.values}
            name={pg.labels}
            fill
            selectedPalette="categorical"
          />
        )}
      </div>
    </div>
  );
}
