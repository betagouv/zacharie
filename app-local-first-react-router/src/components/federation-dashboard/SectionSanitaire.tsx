import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import KpiTile from './KpiTile';

export interface SanitaireRow {
  code: string;
  nom: string;
  tuberculose: number;
  pestePorcine: number;
  brucellose: number;
  tularemie: number;
  total: number;
}

export interface SanitaireTotals {
  tuberculose: number;
  pestePorcine: number;
  brucellose: number;
  tularemie: number;
}

interface Props {
  scope: 'departemental' | 'regional' | 'national';
  departements: SanitaireRow[];
  totals: SanitaireTotals;
}

const DISEASE_COLORS = {
  tuberculose: '#dc2626',
  pestePorcine: '#ea580c',
  brucellose: '#9333ea',
  tularemie: '#0891b2',
};

type SortKey = 'code' | 'tuberculose' | 'pestePorcine' | 'brucellose' | 'tularemie' | 'total';

export default function SectionSanitaire({ scope, departements, totals }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedTable = useMemo(() => {
    const arr = [...departements];
    arr.sort((a, b) => {
      if (sortKey === 'code') {
        const cmp = a.code.localeCompare(b.code);
        return sortDesc ? -cmp : cmp;
      }
      const cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDesc ? -cmp : cmp;
    });
    return arr;
  }, [departements, sortKey, sortDesc]);

  const totalSum = totals.tuberculose + totals.pestePorcine + totals.brucellose + totals.tularemie;

  const pieRaw = [
    { name: 'Tuberculose bovine', value: totals.tuberculose, color: DISEASE_COLORS.tuberculose },
    { name: 'Pestes porcines', value: totals.pestePorcine, color: DISEASE_COLORS.pestePorcine },
    { name: 'Brucellose', value: totals.brucellose, color: DISEASE_COLORS.brucellose },
    { name: 'Tularémie', value: totals.tularemie, color: DISEASE_COLORS.tularemie },
  ].filter((d) => d.value > 0);
  const pieData = pieRaw.length > 0 ? pieRaw : [{ name: 'Aucune anomalie', value: 1, color: '#e5e7eb' }];
  const piePercents = useMemo(() => {
    if (totalSum === 0) return new Map<string, number>();
    return new Map(pieRaw.map((d) => [d.name, Math.round((d.value / totalSum) * 100)]));
  }, [pieRaw, totalSum]);

  // Bar chart : top 30 dépts par total anomalies (lisibilité)
  const topDepts = [...departements]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 30)
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(k);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
        <strong>Note :</strong> Comptage basé sur les anomalies déclarées par les examinateurs initiaux. Une
        anomalie n'implique pas la confirmation de la maladie — il s'agit d'un signal de veille terrain.
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Tuberculose bovine"
          value={totals.tuberculose}
          sublabel="grand gibier"
          accent="red"
        />
        <KpiTile
          label="Pestes porcines"
          value={totals.pestePorcine}
          sublabel="sanglier"
          accent="amber"
        />
        <KpiTile
          label="Brucellose"
          value={totals.brucellose}
          sublabel="GG + petit gibier à poils"
          accent="purple"
        />
        <KpiTile
          label="Tularémie"
          value={totals.tularemie}
          sublabel="lièvres"
          accent="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="fr-h6 mb-3">
            Suspicions par département
            {topDepts.length < departements.length ? ` (top ${topDepts.length})` : ''}
          </h3>
          {topDepts.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune anomalie sanitaire signalée.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(280, topDepts.length * 26)}
            >
              <BarChart
                data={topDepts}
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
                <Legend />
                <Bar
                  dataKey="tuberculose"
                  stackId="d"
                  fill={DISEASE_COLORS.tuberculose}
                  name="Tuberculose"
                />
                <Bar
                  dataKey="pestePorcine"
                  stackId="d"
                  fill={DISEASE_COLORS.pestePorcine}
                  name="Pestes porcines"
                />
                <Bar
                  dataKey="brucellose"
                  stackId="d"
                  fill={DISEASE_COLORS.brucellose}
                  name="Brucellose"
                />
                <Bar
                  dataKey="tularemie"
                  stackId="d"
                  fill={DISEASE_COLORS.tularemie}
                  name="Tularémie"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="fr-h6 mb-3">Répartition globale</h3>
          {totalSum === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune anomalie</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={260}
            >
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={(entry) => {
                    if (!('name' in entry)) return '';
                    const pct = piePercents.get(entry.name as string);
                    return pct !== undefined ? `${pct}%` : '';
                  }}
                >
                  {pieData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.color}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [Number(v).toLocaleString('fr-FR'), String(n)]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
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
                  onClick={() => handleSort('tuberculose')}
                >
                  Tuberculose {sortKey === 'tuberculose' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('pestePorcine')}
                >
                  Pestes porcines {sortKey === 'pestePorcine' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('brucellose')}
                >
                  Brucellose {sortKey === 'brucellose' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('tularemie')}
                >
                  Tularémie {sortKey === 'tularemie' ? (sortDesc ? '▼' : '▲') : ''}
                </th>
                <th
                  scope="col"
                  className="cursor-pointer px-2 py-2 text-right font-semibold"
                  onClick={() => handleSort('total')}
                >
                  Total {sortKey === 'total' ? (sortDesc ? '▼' : '▲') : ''}
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
                  <td className="px-2 py-2 text-right">{r.tuberculose}</td>
                  <td className="px-2 py-2 text-right">{r.pestePorcine}</td>
                  <td className="px-2 py-2 text-right">{r.brucellose}</td>
                  <td className="px-2 py-2 text-right">{r.tularemie}</td>
                  <td className="px-2 py-2 text-right font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
