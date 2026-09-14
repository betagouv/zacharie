import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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

const CIRCUIT_COLORS = {
  agree: '#3b82f6',
  nonAgree: '#f59e0b',
  domestique: '#10b981',
};

// Grand gibier : une carcasse = un animal. Petit gibier : on compte les animaux des lots.
function buildPie(totals: ValorisationTotals, type: 'gg' | 'pg') {
  const [agree, nonAgree, domestique] =
    type === 'gg'
      ? [totals.ggAgree, totals.ggNonAgree, totals.ggDomestique]
      : [totals.pgAgreeAnimaux, totals.pgNonAgreeAnimaux, totals.pgDomestiqueAnimaux];
  return [
    { name: 'Circuit agréé (ETG)', value: agree, color: CIRCUIT_COLORS.agree },
    { name: 'Circuit non agréé', value: nonAgree, color: CIRCUIT_COLORS.nonAgree },
    { name: 'Usage domestique privé', value: domestique, color: CIRCUIT_COLORS.domestique },
  ].filter((d) => d.value > 0);
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
          <h3 className="fr-h6 mb-1">Répartition Petit gibier</h3>
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
    </div>
  );
}
