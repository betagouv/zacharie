import { useState } from 'react';
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
import DepartementValorisationCard from '@app/components/DepartementValorisationCard';
import ValorisationTable, { type DepartementRow } from '@app/components/ValorisationTable';

interface ValorisationTotals {
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  ggTauxSaisie: number | null;
  pgAgree: number;
  pgNonAgree: number;
  pgDomestique: number;
  pgTauxSaisie: number | null;
}

interface Props {
  scope: 'departemental' | 'regional' | 'national';
  departements: DepartementRow[];
  totals: ValorisationTotals | null;
}

const CIRCUIT_COLORS = {
  agree: '#3b82f6',
  nonAgree: '#f59e0b',
  domestique: '#10b981',
};

function buildPie(totals: ValorisationTotals, type: 'gg' | 'pg') {
  const prefix = type;
  return [
    { name: 'Circuit agréé (ETG)', value: totals[`${prefix}Agree` as const], color: CIRCUIT_COLORS.agree },
    {
      name: 'Circuit non agréé',
      value: totals[`${prefix}NonAgree` as const],
      color: CIRCUIT_COLORS.nonAgree,
    },
    {
      name: 'Usage domestique privé',
      value: totals[`${prefix}Domestique` as const],
      color: CIRCUIT_COLORS.domestique,
    },
  ].filter((d) => d.value > 0);
}

export default function SectionValorisation({ scope, departements, totals }: Props) {
  const [showTable, setShowTable] = useState(false);
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

  // Stacked bar par dept (limité aux 30 plus gros volumes pour la lisibilité)
  const sortedByVolume = [...departements].sort((a, b) => {
    const totA = a.gg.agree + a.gg.nonAgree + a.gg.domestique + a.pg.agree + a.pg.nonAgree + a.pg.domestique;
    const totB = b.gg.agree + b.gg.nonAgree + b.gg.domestique + b.pg.agree + b.pg.nonAgree + b.pg.domestique;
    return totB - totA;
  });
  const topForChart = sortedByVolume.slice(0, 30);

  const chartData = topForChart
    .map((d) => ({
      code: d.code,
      gg_agree: d.gg.agree,
      gg_nonAgree: d.gg.nonAgree,
      gg_domestique: d.gg.domestique,
      pg_agree: d.pg.agree,
      pg_nonAgree: d.pg.nonAgree,
      pg_domestique: d.pg.domestique,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const pieGg = totals ? buildPie(totals, 'gg') : [];
  const pieGgTotal = pieGg.reduce((s, d) => s + d.value, 0);
  const pieGgEmpty = pieGgTotal === 0;
  const pieGgData = pieGgEmpty ? [{ name: 'Aucune donnée', value: 1, color: '#e5e7eb' }] : pieGg;
  const pieGgPercents = (() => {
    if (pieGgTotal === 0) return new Map<string, number>();
    return new Map(pieGg.map((d) => [d.name, Math.round((d.value / pieGgTotal) * 100)]));
  })();

  const piePg = totals ? buildPie(totals, 'pg') : [];
  const piePgTotal = piePg.reduce((s, d) => s + d.value, 0);
  const piePgEmpty = piePgTotal === 0;
  const piePgData = piePgEmpty ? [{ name: 'Aucune donnée', value: 1, color: '#e5e7eb' }] : piePg;
  const piePgPercents = (() => {
    if (piePgTotal === 0) return new Map<string, number>();
    return new Map(piePg.map((d) => [d.name, Math.round((d.value / piePgTotal) * 100)]));
  })();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="fr-h6 mb-3">Répartition Grand gibier</h3>
          {pieGgEmpty ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune donnée</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={240}
            >
              <PieChart>
                <Pie
                  data={pieGgData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={(entry) => {
                    if (!('name' in entry)) return '';
                    const pct = pieGgPercents.get(entry.name as string);
                    return pct !== undefined ? `${pct}%` : '';
                  }}
                >
                  {pieGgData.map((d) => (
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
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <h3 className="fr-h6 mb-3">Répartition Petit gibier</h3>
          {piePgEmpty ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucune donnée</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={240}
            >
              <PieChart>
                <Pie
                  data={piePgData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label={(entry) => {
                    if (!('name' in entry)) return '';
                    const pct = piePgPercents.get(entry.name as string);
                    return pct !== undefined ? `${pct}%` : '';
                  }}
                >
                  {piePgData.map((d) => (
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

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="fr-h6 mb-3">
          Circuits par département
          {topForChart.length < departements.length ? ` (top ${topForChart.length})` : ''}
        </h3>
        <ResponsiveContainer
          width="100%"
          height={Math.max(280, chartData.length * 28)}
        >
          <BarChart
            data={chartData}
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
              dataKey="gg_agree"
              stackId="gg"
              fill={CIRCUIT_COLORS.agree}
              name="GG agréé"
            />
            <Bar
              dataKey="gg_nonAgree"
              stackId="gg"
              fill={CIRCUIT_COLORS.nonAgree}
              name="GG non agréé"
            />
            <Bar
              dataKey="gg_domestique"
              stackId="gg"
              fill={CIRCUIT_COLORS.domestique}
              name="GG domestique"
            />
            <Bar
              dataKey="pg_agree"
              stackId="pg"
              fill="#93c5fd"
              name="PG agréé"
            />
            <Bar
              dataKey="pg_nonAgree"
              stackId="pg"
              fill="#fcd34d"
              name="PG non agréé"
            />
            <Bar
              dataKey="pg_domestique"
              stackId="pg"
              fill="#6ee7b7"
              name="PG domestique"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <button
          type="button"
          className="fr-btn fr-btn--tertiary fr-btn--sm"
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? 'Masquer le détail' : 'Voir le détail par département'}
        </button>
        {showTable && (
          <div className="mt-3">
            <ValorisationTable
              rows={departements}
              showSearch={scope === 'national'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
