import '@gouvfr/dsfr-chart/PieChart';
// @ts-expect-error dsfr-chart CSS has no type declarations
import '@gouvfr/dsfr-chart/PieChart/css';
import DepartementValorisationCard from '@app/components/DepartementValorisationCard';
import { type DepartementRow } from './DepartementsTable';

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
  scope: 'departemental' | 'regional' | 'national';
  departements: DepartementRow[];
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

export default function SectionValorisation({ scope, departements, totals }: Props) {
  const isSingleDept = scope === 'departemental' && departements.length === 1;

  if (departements.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucune carcasse n'a été enregistrée dans Zacharie pour le périmètre de votre fédération sur la saison
        en cours.
      </p>
    );
  }

  if (isSingleDept) {
    return <DepartementValorisationCard {...departements[0]} />;
  }

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
          // @ts-expect-error dsfr-chart web component
          <pie-chart
            x={JSON.stringify([gg.labels])}
            y={JSON.stringify([gg.values])}
            name={JSON.stringify(gg.labels)}
            fill="true"
            unit-tooltip=""
            selected-palette="categorical"
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
          // @ts-expect-error dsfr-chart web component
          <pie-chart
            x={JSON.stringify([pg.labels])}
            y={JSON.stringify([pg.values])}
            name={JSON.stringify(pg.labels)}
            fill="true"
            unit-tooltip=""
            selected-palette="categorical"
          />
        )}
      </div>
    </div>
  );
}
