import { PieChart } from 'react-dsfr-chart/PieChart';
import 'react-dsfr-chart/css';
import KpiTile from './KpiTile';

import type { FederationScope } from '@api/src/utils/federation-stats';

interface AnomaliesData {
  total: number;
  breakdown: Array<{ motif: string; count: number }>;
}

interface SviMotif {
  motif: string;
  count: number;
}

interface Props {
  valoScope: FederationScope;
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
  valoScope,
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

        {anomaliesPie.values.length > 0 && (
          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 bg-blue-600"
            />
            <h4 className="mb-3 text-lg font-bold">Anomalies signalées</h4>
            <PieChart
              x={anomaliesPie.labels}
              y={anomaliesPie.values}
              name={anomaliesPie.labels}
              fill
              selectedPalette="categorical"
            />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-2xl font-normal">Inspections services vétérinaires</h3>
        <div className="grid grid-cols-2 gap-4">
          <KpiTile
            label={`Taux de saisie ${valoScope} saison ${season ?? ''}`}
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

        {motifsPie.values.length > 0 && (
          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 pl-5">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 bg-blue-600"
            />
            <h4 className="mb-3 text-lg font-bold">Motifs de saisies sanitaires</h4>
            <PieChart
              x={motifsPie.labels}
              y={motifsPie.values}
              name={motifsPie.labels}
              fill
              selectedPalette="categorical"
            />
          </div>
        )}
      </div>
    </div>
  );
}
