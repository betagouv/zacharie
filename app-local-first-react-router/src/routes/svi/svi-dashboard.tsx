import { useMemo, type ReactNode } from 'react';
import dayjs from 'dayjs';
import { CarcasseType } from '@prisma/client';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Button } from '@codegouvfr/react-dsfr/Button';
import Chargement from '@app/components/Chargement';
import {
  countAnimaux,
  useSviCarcassesAVenir,
  sviCarcassesAVenirModal,
} from '@app/utils/svi-carcasses-a-venir';
import SviCarcassesAVenirModal from '@app/components/SviCarcassesAVenirModal';

const COLOR_GRAND = 'var(--background-action-high-blue-france)';
const COLOR_PETIT = '#6277df';
const BAR_COLOR = 'var(--background-action-high-blue-france)';

// Tranches d'ancienneté depuis l'arrivée chez l'ETG : plus c'est ancien, plus la
// transmission au SVI est imminente (ordre = priorité d'inspection à venir).
const ANCIENNETE_BUCKETS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'today', label: "Aujourd'hui", min: 0, max: 0 },
  { key: '1-2', label: '1 à 2 jours', min: 1, max: 2 },
  { key: '3-5', label: '3 à 5 jours', min: 3, max: 5 },
  { key: '6+', label: '6 jours et +', min: 6, max: Infinity },
];

function bucketForDays(days: number): string {
  const bucket = ANCIENNETE_BUCKETS.find((b) => days >= b.min && days <= b.max);
  return bucket ? bucket.key : 'unknown';
}

export default function SviDashboard() {
  const { carcasses, loading } = useSviCarcassesAVenir();

  const stats = useMemo(() => {
    const rows = carcasses ?? [];
    let totalAnimaux = 0;
    let grandGibier = 0;
    let petitGibier = 0;
    const especeMap = new Map<string, number>();
    const etgSet = new Set<string>();
    const ancienneteMap = new Map<string, number>();
    const ficheSet = new Set<string>();

    for (const carcasse of rows) {
      const animaux = countAnimaux(carcasse);
      totalAnimaux += animaux;
      if (carcasse.type === CarcasseType.PETIT_GIBIER) petitGibier += animaux;
      else grandGibier += animaux;
      if (carcasse.espece) especeMap.set(carcasse.espece, (especeMap.get(carcasse.espece) ?? 0) + animaux);
      etgSet.add(carcasse.etg_nom);
      ficheSet.add(carcasse.fei_numero);

      const days = carcasse.arrived_at
        ? dayjs().startOf('day').diff(dayjs(carcasse.arrived_at).startOf('day'), 'day')
        : -1;
      const bucketKey = days >= 0 ? bucketForDays(days) : 'unknown';
      ancienneteMap.set(bucketKey, (ancienneteMap.get(bucketKey) ?? 0) + animaux);
    }

    const typeData = [
      { name: 'Grand gibier', value: grandGibier },
      { name: 'Petit gibier', value: petitGibier },
    ].filter((d) => d.value > 0);
    const parEspece = Array.from(especeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const parAnciennete = ANCIENNETE_BUCKETS.map((b) => ({
      name: b.label,
      value: ancienneteMap.get(b.key) ?? 0,
    }));

    return {
      totalCarcasses: rows.length,
      totalAnimaux,
      nbEtg: etgSet.size,
      nbFiches: ficheSet.size,
      typeData,
      parEspece,
      parAnciennete,
    };
  }, [carcasses]);

  if (loading) {
    return <Chargement />;
  }

  const isEmpty = stats.totalCarcasses === 0;

  return (
    <main
      role="main"
      id="svi-dashboard"
    >
      <title>Tableau de bord | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-container fr-my-4w">
        {/* En-tête : ce que représente le tableau de bord */}
        <header className="mb-6">
          <h1 className="fr-h3 mb-1">Carcasses à venir</h1>
          <p className="fr-text--sm m-0 text-gray-600">
            Carcasses acceptées chez vos ETG, en attente de transmission au SVI. Cet aperçu vous aide à
            anticiper les inspections à venir. Les décomptes sont exprimés en nombre d'animaux (un lot de
            petit gibier compte pour plusieurs animaux).
          </p>
        </header>

        {isEmpty ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-center text-gray-500">
            Aucune carcasse en attente chez vos ETG pour le moment.
          </div>
        ) : (
          <>
            {/* Chiffres clés */}
            <section
              aria-label="Chiffres clés"
              className="mb-6"
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatTile
                  value={stats.totalAnimaux}
                  label="Animaux à venir"
                />
                <StatTile
                  value={stats.totalCarcasses}
                  label="Carcasses & lots"
                />
                <StatTile
                  value={stats.nbFiches}
                  label={`Fiche${stats.nbFiches > 1 ? 's' : ''} concernée${stats.nbFiches > 1 ? 's' : ''}`}
                />
                <StatTile
                  value={stats.nbEtg}
                  label={`ETG concerné${stats.nbEtg > 1 ? 's' : ''}`}
                />
              </div>
              <div className="mt-4 flex justify-center md:justify-start">
                <Button
                  priority="secondary"
                  iconId="fr-icon-list-unordered"
                  onClick={() => sviCarcassesAVenirModal.open()}
                >
                  Voir le détail par fiche ({stats.nbFiches})
                </Button>
              </div>
            </section>

            {/* Graphiques */}
            <section aria-label="Répartition des carcasses à venir">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Ancienneté (imminence) — en premier car c'est le plus actionnable */}
                <ChartCard
                  title="Ancienneté chez l'ETG"
                  hint="Nombre d'animaux par tranche d'attente depuis leur arrivée chez l'ETG. Plus l'attente est longue, plus la transmission au SVI est probablement imminente."
                  className="md:col-span-2"
                >
                  <ResponsiveContainer
                    width="100%"
                    height={240}
                  >
                    <BarChart
                      data={stats.parAnciennete}
                      margin={{ left: 0, right: 10 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Animaux"
                        fill={BAR_COLOR}
                      >
                        <LabelList
                          dataKey="value"
                          position="top"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Répartition grand / petit gibier */}
                <ChartCard
                  title="Grand / petit gibier"
                  hint="Répartition des animaux à venir entre grand et petit gibier."
                >
                  <ResponsiveContainer
                    width="100%"
                    height={240}
                  >
                    <PieChart>
                      <Pie
                        data={stats.typeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.name} : ${entry.value}`}
                      >
                        {stats.typeData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === 'Grand gibier' ? COLOR_GRAND : COLOR_PETIT}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Par espèce */}
                <ChartCard
                  title="Par espèce"
                  hint="Nombre d'animaux à venir par espèce, du plus fréquent au moins fréquent."
                >
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(240, stats.parEspece.length * 32)}
                  >
                    <BarChart
                      data={stats.parEspece}
                      layout="vertical"
                      margin={{ left: 20, right: 30 }}
                    >
                      <XAxis
                        type="number"
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name="Animaux"
                        fill={BAR_COLOR}
                      >
                        <LabelList
                          dataKey="value"
                          position="right"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </section>
          </>
        )}
      </div>
      <SviCarcassesAVenirModal carcasses={carcasses ?? []} />
    </main>
  );
}

// Chiffre clé : le nombre en avant, le libellé en dessous.
function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-action-high-blue-france m-0 text-3xl font-bold">{value}</p>
      <p className="fr-text--sm m-0 text-gray-600">{label}</p>
    </div>
  );
}

// Carte de graphique : titre + texte d'aide, puis le graphique.
function ChartCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded border border-gray-200 bg-white p-4 ${className ?? ''}`}>
      <h2 className="fr-text--sm m-0 mb-1 font-bold text-gray-800">{title}</h2>
      <p className="fr-text--xs m-0 mb-3 text-gray-500">{hint}</p>
      {children}
    </div>
  );
}
