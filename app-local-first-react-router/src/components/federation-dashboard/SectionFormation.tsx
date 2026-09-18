import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface FormationRow {
  code: string;
  nom: string;
  examinateursActifs: number;
  tauxSaisieBph: number | null;
  scoreBph: number | null;
  sviEligible: number;
  bphCount: number;
}

export interface FormationNational {
  bphRate: number; // %
  scoreBph: number | null;
  sviEligible: number;
  bphCount: number;
}

interface Props {
  departements: FormationRow[];
  national: FormationNational;
}

export default function SectionFormation({ departements, national }: Props) {
  // Top 30 par examinateurs
  const topExaminateurs = [...departements]
    .filter((d) => d.examinateursActifs > 0)
    .sort((a, b) => b.examinateursActifs - a.examinateursActifs)
    .slice(0, 30)
    .sort((a, b) => a.code.localeCompare(b.code));

  // Top 30 par taux saisie BPH (où dispo)
  const bphChartData = [...departements]
    .filter((d) => d.tauxSaisieBph !== null && d.sviEligible > 0)
    .sort((a, b) => (b.tauxSaisieBph ?? 0) - (a.tauxSaisieBph ?? 0))
    .slice(0, 30)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((d) => ({
      code: d.code,
      tauxSaisieBph: d.tauxSaisieBph,
      scoreBph: d.scoreBph,
    }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="fr-h6 mb-3">
            Examinateurs actifs par département
            {topExaminateurs.length < departements.length ? ` (top ${topExaminateurs.length})` : ''}
          </h3>
          {topExaminateurs.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              Aucun examinateur n'a transmis de FEI cette saison.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(280, topExaminateurs.length * 26)}
            >
              <BarChart
                data={topExaminateurs}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  dataKey="code"
                  type="category"
                  width={48}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar
                  dataKey="examinateursActifs"
                  fill="#16a34a"
                  name="Examinateurs"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="fr-h6 mb-2">Taux saisie SVI pour non-respect des BPH</h3>
          <p className="mb-3 text-xs text-gray-500">Référence nationale&nbsp;: {national.bphRate}%</p>
          {bphChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              Pas encore de retour SVI sur les carcasses de la saison.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(280, bphChartData.length * 26)}
            >
              <BarChart
                data={bphChartData}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  dataKey="code"
                  type="category"
                  width={48}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <ReferenceLine
                  x={national.bphRate}
                  stroke="#0891b2"
                  strokeDasharray="3 3"
                  label={{ value: 'national', fill: '#0891b2', fontSize: 11, position: 'insideTopRight' }}
                />
                <Bar
                  dataKey="tauxSaisieBph"
                  fill="#9333ea"
                  name="Taux BPH (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
