import '@gouvfr/dsfr-chart/PieChart';
// @ts-expect-error dsfr-chart CSS has no type declarations
import '@gouvfr/dsfr-chart/PieChart/css';
import KpiTile from './KpiTile';

interface AnomaliesData {
  total: number;
  breakdown: Array<{ motif: string; count: number }>;
}

interface SviMotif {
  motif: string;
  count: number;
}

interface Props {
  examinateursActifs: number;
  anomalies: AnomaliesData;
  sviMotifs: SviMotif[];
  ggTauxSaisie: number | null;
  nationalGgTauxSaisie25_26: number;
  season: string | null;
}

function buildPieData(items: Array<{ motif: string; count: number }>, max: number) {
  const sliced = items.slice(0, max);
  return {
    labels: sliced.map((i) => i.motif),
    values: sliced.map((i) => i.count),
  };
}

export default function SectionSuiviSanitaire({
  examinateursActifs,
  anomalies,
  sviMotifs,
  ggTauxSaisie,
  nationalGgTauxSaisie25_26,
  season,
}: Props) {
  const anomaliesPie = buildPieData(anomalies.breakdown, 10);
  const motifsPie = buildPieData(sviMotifs, 10);

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <h3 className="text-2xl font-normal">Examens initiaux chasseurs</h3>
        <div className="grid grid-cols-2 gap-4">
          <KpiTile
            label="Examinateurs actifs"
            value={examinateursActifs}
            sublabel="Examinateurs initiaux ayant envoyé ≥ 1 FEI"
            accent="blue"
          />
          <KpiTile
            label="Anomalies signalées"
            value={anomalies.total}
            sublabel="Anomalies signalées lors de l'examen initial"
            accent="blue"
          />
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 bg-blue-600"
          />
          <h4 className="mb-3 text-lg font-bold">Anomalies signalées</h4>
          {anomaliesPie.values.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune anomalie signalée</p>
          ) : (
            // @ts-expect-error dsfr-chart web component
            <pie-chart
              x={JSON.stringify([anomaliesPie.labels])}
              y={JSON.stringify([anomaliesPie.values])}
              name={JSON.stringify(anomaliesPie.labels)}
              fill="true"
              unit-tooltip=""
              selected-palette="categorical"
            />
          )}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-2xl font-normal">Inspections services vétérinaires</h3>
        <div className="grid grid-cols-2 gap-4">
          <KpiTile
            label={`Taux de saisie saison ${season ?? ''}`}
            value={ggTauxSaisie !== null ? `${ggTauxSaisie}%` : '—'}
            sublabel="Pourcentage de carcasses saisies en circuit agréé"
            accent="blue"
          />
          <KpiTile
            label="Taux de saisie national 25-26"
            value={`${nationalGgTauxSaisie25_26}%`}
            sublabel="Pourcentage de carcasses saisies en circuit agréé"
            accent="blue"
          />
        </div>

        <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 bg-blue-600"
          />
          <h4 className="mb-3 text-lg font-bold">Motifs de saisies sanitaires</h4>
          {motifsPie.values.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune saisie sanitaire</p>
          ) : (
            // @ts-expect-error dsfr-chart web component
            <pie-chart
              x={JSON.stringify([motifsPie.labels])}
              y={JSON.stringify([motifsPie.values])}
              name={JSON.stringify(motifsPie.labels)}
              fill="true"
              unit-tooltip=""
              selected-palette="categorical"
            />
          )}
        </div>
      </div>
    </div>
  );
}
