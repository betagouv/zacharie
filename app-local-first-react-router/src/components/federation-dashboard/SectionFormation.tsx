import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  scope: 'departemental' | 'regional' | 'national';
  departements: FormationRow[];
  national: FormationNational;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#9ca3af';
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#ca8a04';
  if (score >= 25) return '#ea580c';
  return '#dc2626';
}

type SortKey = 'code' | 'examinateursActifs' | 'tauxSaisieBph' | 'scoreBph';

export default function SectionFormation({ scope, departements, national }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('examinateursActifs');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedTable = useMemo(() => {
    const arr = [...departements];
    arr.sort((a, b) => {
      if (sortKey === 'code') {
        const cmp = a.code.localeCompare(b.code);
        return sortDesc ? -cmp : cmp;
      }
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const aNum = aVal === null ? -Infinity : aVal;
      const bNum = bVal === null ? -Infinity : bVal;
      const cmp = (aNum as number) - (bNum as number);
      return sortDesc ? -cmp : cmp;
    });
    return arr;
  }, [departements, sortKey, sortDesc]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(k);
      setSortDesc(true);
    }
  };

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

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="fr-h6 mb-2">Score BPH par département</h3>
        <p className="mb-3 text-xs text-gray-500">
          Score sur 100 (plus c'est haut, mieux c'est). Calcul&nbsp;: 100 × (1 − tauxBPH dept / (2 × tauxBPH
          national)). Score national&nbsp;: {national.scoreBph ?? '—'}/100.
        </p>
        {bphChartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">Pas encore de données SVI.</p>
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
                domain={[0, 100]}
              />
              <YAxis
                dataKey="code"
                type="category"
                width={48}
                tick={{ fontSize: 12 }}
              />
              <Tooltip formatter={(v) => `${v}/100`} />
              <Bar
                dataKey="scoreBph"
                name="Score BPH"
              >
                {bphChartData.map((d) => (
                  <Cell
                    key={d.code}
                    fill={scoreColor(d.scoreBph)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {scope !== 'departemental' && departements.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="cursor-pointer px-3 py-2 text-left font-semibold"
                  onClick={() => handleSort('code')}
                >
                  Département {sortKey === 'code' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('examinateursActifs')}
                >
                  Examinateurs actifs {sortKey === 'examinateursActifs' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('tauxSaisieBph')}
                >
                  Taux saisie BPH {sortKey === 'tauxSaisieBph' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('scoreBph')}
                >
                  Score BPH {sortKey === 'scoreBph' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((r) => (
                <tr
                  key={r.code}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-gray-500">{r.code}</span>{' '}
                    <span className="text-gray-800">{r.nom}</span>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{r.examinateursActifs}</td>
                  <td className="px-2 py-2 text-right">
                    {r.tauxSaisieBph !== null ? `${r.tauxSaisieBph}%` : '—'}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    {r.scoreBph !== null ? `${r.scoreBph}/100` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
