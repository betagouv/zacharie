import { useEffect, useMemo, useState } from 'react';
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
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { SviCarcassesAVenirResponse, SviCarcasseAVenir } from '@api/src/types/responses';

// Nombre d'animaux comptés par carcasse, comme ailleurs dans l'app :
// petit gibier = un lot de plusieurs animaux, grand gibier = 1 carcasse = 1 animal.
function countAnimaux(carcasse: Pick<SviCarcasseAVenir, 'type' | 'nombre_d_animaux'>): number {
  return carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
}

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
  const [carcasses, setCarcasses] = useState<Array<SviCarcasseAVenir> | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    API.get({ path: 'svi/carcasses-a-venir' })
      .then((res) => res as SviCarcassesAVenirResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setCarcasses(res.data.carcasses);
        } else {
          setCarcasses([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const rows = carcasses ?? [];
    let totalAnimaux = 0;
    let grandGibier = 0;
    let petitGibier = 0;
    const especeMap = new Map<string, number>();
    const etgSet = new Set<string>();
    const ancienneteMap = new Map<string, number>();

    // Regroupement par fiche pour la liste de contexte.
    const ficheMap = new Map<
      string,
      { fei_numero: string; etg_nom: string; arrived_at: Date | null; carcasses: Array<SviCarcasseAVenir> }
    >();

    for (const carcasse of rows) {
      const animaux = countAnimaux(carcasse);
      totalAnimaux += animaux;
      if (carcasse.type === CarcasseType.PETIT_GIBIER) petitGibier += animaux;
      else grandGibier += animaux;
      if (carcasse.espece) especeMap.set(carcasse.espece, (especeMap.get(carcasse.espece) ?? 0) + animaux);
      etgSet.add(carcasse.etg_nom);

      const days = carcasse.arrived_at
        ? dayjs().startOf('day').diff(dayjs(carcasse.arrived_at).startOf('day'), 'day')
        : -1;
      const bucketKey = days >= 0 ? bucketForDays(days) : 'unknown';
      ancienneteMap.set(bucketKey, (ancienneteMap.get(bucketKey) ?? 0) + animaux);

      const fiche = ficheMap.get(carcasse.fei_numero);
      if (fiche) {
        fiche.carcasses.push(carcasse);
        if (carcasse.arrived_at && (!fiche.arrived_at || carcasse.arrived_at > fiche.arrived_at)) {
          fiche.arrived_at = carcasse.arrived_at;
        }
      } else {
        ficheMap.set(carcasse.fei_numero, {
          fei_numero: carcasse.fei_numero,
          etg_nom: carcasse.etg_nom,
          arrived_at: carcasse.arrived_at,
          carcasses: [carcasse],
        });
      }
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
    const fiches = Array.from(ficheMap.values()).sort((a, b) => {
      const da = a.arrived_at ? dayjs(a.arrived_at).valueOf() : 0;
      const db = b.arrived_at ? dayjs(b.arrived_at).valueOf() : 0;
      return da - db; // les plus anciennes en premier (les plus imminentes)
    });

    return {
      totalCarcasses: rows.length,
      totalAnimaux,
      nbEtg: etgSet.size,
      typeData,
      parEspece,
      parAnciennete,
      fiches,
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
        <h1 className="fr-h2">Tableau de bord</h1>

        {isEmpty ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-center text-gray-500">
            Aucune carcasse en attente chez vos ETG pour le moment.
          </div>
        ) : (
          <>
            {/* Synthèse en clair */}
            <p className="fr-text--lead mb-1">
              <strong>{stats.totalCarcasses}</strong> carcasse{stats.totalCarcasses > 1 ? 's' : ''} (
              <strong>{stats.totalAnimaux}</strong> animaux) {stats.totalCarcasses > 1 ? 'vont' : 'va'}{' '}
              probablement vous être transmise{stats.totalCarcasses > 1 ? 's' : ''}, depuis{' '}
              <strong>{stats.nbEtg}</strong> ETG.
            </p>
            <p className="fr-text--xs mb-6 text-gray-500">
              Une carcasse de petit gibier peut regrouper plusieurs animaux (lot), d'où l'écart entre le
              nombre de carcasses et le nombre d'animaux.
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Répartition grand / petit gibier */}
              <div className="rounded border border-gray-200 bg-white p-4">
                <h2 className="fr-text--sm m-0 mb-2 font-bold text-gray-800">
                  Répartition grand / petit gibier
                </h2>
                <p className="fr-text--xs m-0 mb-2 text-gray-500">en nombre d'animaux</p>
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
              </div>

              {/* Par espèce */}
              <div className="rounded border border-gray-200 bg-white p-4">
                <h2 className="fr-text--sm m-0 mb-2 font-bold text-gray-800">Par espèce</h2>
                <p className="fr-text--xs m-0 mb-2 text-gray-500">en nombre d'animaux</p>
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
                      fill={BAR_COLOR}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ancienneté chez l'ETG (imminence) */}
              <div className="rounded border border-gray-200 bg-white p-4 md:col-span-2">
                <h2 className="fr-text--sm m-0 mb-2 font-bold text-gray-800">
                  Depuis combien de temps chez l'ETG
                </h2>
                <p className="fr-text--xs m-0 mb-2 text-gray-500">
                  en nombre d'animaux — plus c'est ancien, plus la transmission est probablement imminente
                </p>
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
                      fill={BAR_COLOR}
                    >
                      <LabelList
                        dataKey="value"
                        position="top"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Détail par fiche (contexte) */}
            <div className="mt-6 rounded border border-gray-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-gray-800"
                onClick={() => setDetailOpen((o) => !o)}
                aria-expanded={detailOpen}
              >
                <span>Détail des fiches à venir ({stats.fiches.length})</span>
                <span
                  className={`fr-icon--sm transition-transform ${detailOpen ? 'fr-icon-arrow-up-s-line' : 'fr-icon-arrow-down-s-line'}`}
                  aria-hidden="true"
                />
              </button>
              {detailOpen && (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="px-4 py-2 font-medium">Fiche</th>
                        <th className="px-4 py-2 font-medium">ETG</th>
                        <th className="px-4 py-2 font-medium">Arrivée chez l'ETG</th>
                        <th className="px-4 py-2 font-medium">Carcasses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.fiches.map((fiche) => {
                        const especes = new Map<string, number>();
                        for (const carcasse of fiche.carcasses) {
                          if (!carcasse.espece) continue;
                          especes.set(
                            carcasse.espece,
                            (especes.get(carcasse.espece) ?? 0) + countAnimaux(carcasse)
                          );
                        }
                        return (
                          <tr
                            key={fiche.fei_numero}
                            className="border-t border-gray-100 align-top"
                          >
                            <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                              {fiche.fei_numero}
                            </td>
                            <td className="px-4 py-2">{fiche.etg_nom}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {fiche.arrived_at ? dayjs(fiche.arrived_at).format('DD/MM/YYYY') : '—'}
                            </td>
                            <td className="px-4 py-2">
                              {Array.from(especes.entries())
                                .sort((a, b) => b[1] - a[1])
                                .map(([espece, count]) => `${count} ${espece}`)
                                .join(', ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
