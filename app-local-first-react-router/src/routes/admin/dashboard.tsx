import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type {
  AdminDeltaBphResponse,
  AdminPartsDeMarcheResponse,
  AdminSaisiesSviResponse,
} from '@api/src/types/responses';
import { BarChart } from 'react-dsfr-chart/BarChart';
import { LineChart } from 'react-dsfr-chart/LineChart';
import 'react-dsfr-chart/css';
import { Tabs } from '@codegouvfr/react-dsfr/Tabs';

const dashboardTabs = [
  { tabId: 'general' as const, label: 'Général' },
  { tabId: 'saisies-svi' as const, label: 'Saisies SVI' },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [partsDeMarche, setPartsDeMarche] = useState<AdminPartsDeMarcheResponse['data'] | null>(null);
  const [saisiesSvi, setSaisiesSvi] = useState<AdminSaisiesSviResponse['data'] | null>(null);
  const [deltaBph, setDeltaBph] = useState<AdminDeltaBphResponse['data'] | null>(null);
  const [selectedTab, setSelectedTab] = useState('general');

  useEffect(() => {
    Promise.all([
      API.get({ path: 'admin/parts-de-marche' })
        .then((res) => res as AdminPartsDeMarcheResponse)
        .then((res) => {
          if (res.ok) {
            setPartsDeMarche(res.data);
          }
        }),
      API.get({ path: 'admin/saisies-svi' })
        .then((res) => res as AdminSaisiesSviResponse)
        .then((res) => {
          if (res.ok) {
            setSaisiesSvi(res.data);
          }
        }),
      API.get({ path: 'admin/delta-bph' })
        .then((res) => res as AdminDeltaBphResponse)
        .then((res) => {
          if (res.ok) {
            setDeltaBph(res.data);
          }
        }),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Chargement />;
  }

  return (
    <div className="space-y-6 py-6">
      <title>
        Tableau de bord | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <h2 className="text-xl font-bold">Tableau de bord</h2>

      <Tabs
        selectedTabId={selectedTab}
        tabs={dashboardTabs}
        onTabChange={setSelectedTab}
      >
        {selectedTab === 'general' && (
          <div className="space-y-6 pt-4">
            {/* Parts de marché par circuit */}
            {partsDeMarche && partsDeMarche.circuit_long.length > 0 && (
              <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-lg font-semibold">Parts de marché par circuit</h3>
                <p className="mb-5 text-sm text-gray-500">
                  Part de marché absolue, potentielle et réelle sur l&apos;ensemble du circuit long, par
                  saison de chasse, en tonnes de viande de gibier
                </p>
                <BarChart
                  x={partsDeMarche.circuit_long.map((row) => row.saison)}
                  y={[
                    partsDeMarche.circuit_long.map((row) => row.volume_absolu),
                    partsDeMarche.circuit_long.map((row) => row.volume_potentiel),
                    partsDeMarche.circuit_long.map((row) => row.volume_reel),
                  ]}
                  name={['Volume absolu', 'Volume potentiel', 'Volume réel']}
                  colors={['#cacafb', '#6a6af4', '#000091']}
                  height={350}
                  unitTooltip="t"
                  ariaLabel="Parts de marché par circuit"
                />
              </div>
            )}

            {/* Delta BPH distribution */}
            {deltaBph &&
              deltaBph.deltas.length > 0 &&
              (() => {
                const bucketSize = 5;
                const buckets: Record<number, number> = {};
                for (let b = -100; b <= 100; b += bucketSize) {
                  buckets[b] = 0;
                }
                for (const d of deltaBph.deltas) {
                  const b = Math.max(-100, Math.min(100, Math.floor(d / bucketSize) * bucketSize));
                  buckets[b] = (buckets[b] ?? 0) + 1;
                }
                const chartData = Object.entries(buckets)
                  .map(([key, count]) => ({ delta: Number(key), count }))
                  .sort((a, b) => a.delta - b.delta);

                return (
                  <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-1 text-lg font-semibold">
                      Répartition des examinateurs initiaux par delta de score BPH
                    </h3>
                    <p className="mb-5 text-sm text-gray-500">
                      Différence entre la moyenne des 5 fiches les plus récentes et les 5 premières fiches
                      (score BPH absolu). Examinateurs avec au moins 10 fiches. L&apos;axe vertical donne le
                      nombre d&apos;examinateurs initiaux.
                    </p>
                    <LineChart
                      x={chartData.map((d) => d.delta)}
                      y={[chartData.map((d) => d.count)]}
                      name={['Examinateurs']}
                      colors={['#e3a902']}
                      height={350}
                      fill
                      xMin={-100}
                      xMax={100}
                      yMax={Math.max(...chartData.map((d) => d.count), 6)}
                      ariaLabel="Répartition des examinateurs initiaux par delta de score BPH"
                    />
                  </div>
                );
              })()}
          </div>
        )}

        {selectedTab === 'saisies-svi' && (
          <div className="space-y-6 pt-4">
            {/* Taux de saisie SVI */}
            {saisiesSvi && (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="text-sm text-gray-500">Carcasses inspectées (SVI)</p>
                  <p
                    className="mt-1 text-3xl font-bold"
                    style={{ color: 'var(--background-action-high-blue-france)' }}
                  >
                    {saisiesSvi.total_inspectees.toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="text-sm text-gray-500">Taux de saisie global</p>
                  <p
                    className="mt-1 text-3xl font-bold"
                    style={{ color: 'var(--background-action-high-blue-france)' }}
                  >
                    {saisiesSvi.taux_saisie_global}%
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {saisiesSvi.total_saisies.toLocaleString('fr-FR')} carcasses saisies
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="text-sm text-gray-500">Taux mauvaises pratiques</p>
                  <p
                    className="mt-1 text-3xl font-bold"
                    style={{ color: 'var(--background-action-high-blue-france)' }}
                  >
                    {saisiesSvi.taux_mauvaises_pratiques}%
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {saisiesSvi.total_mauvaises_pratiques.toLocaleString('fr-FR')} carcasses (mauvaises
                    pratiques)
                  </p>
                </div>
              </div>
            )}

            {/* Saisies SVI — tous les motifs */}
            {saisiesSvi && saisiesSvi.motifs.length > 0 && (
              <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-1 text-lg font-semibold">Tous les motifs de saisie totale (IPM2)</h3>
                <p className="mb-5 text-sm text-gray-500">
                  Fréquence des motifs sur l&apos;ensemble des saisies totales
                </p>
                <div className="space-y-2">
                  {saisiesSvi.motifs.map(({ motif, count, is_mauvaise_pratique }, i) => {
                    const maxCount = saisiesSvi.motifs[0].count;
                    const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div
                        key={motif}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="w-80 shrink-0 truncate text-right text-sm text-gray-600"
                          title={motif}
                        >
                          {motif}
                        </div>
                        <div className="relative h-7 flex-1 rounded bg-gray-50">
                          <div
                            className="flex h-full items-center rounded px-2 text-xs font-semibold text-white"
                            style={{
                              width: `${Math.max(pct, 3)}%`,
                              backgroundColor: is_mauvaise_pratique
                                ? '#e1000f'
                                : i === 0
                                  ? '#000091'
                                  : '#6a6af4',
                              minWidth: '40px',
                            }}
                          >
                            {count}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Saisies SVI — motifs mauvaises pratiques uniquement */}
            {saisiesSvi &&
              saisiesSvi.motifs.filter((m) => m.is_mauvaise_pratique).length > 0 &&
              (() => {
                const mauvaises = saisiesSvi.motifs.filter((m) => m.is_mauvaise_pratique);
                return (
                  <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-1 text-lg font-semibold">Motifs mauvaises pratiques (saisie totale)</h3>
                    <p className="mb-5 text-sm text-gray-500">
                      Sous-ensemble des motifs liés aux mauvaises pratiques d&apos;hygiène
                    </p>
                    <div className="space-y-2">
                      {mauvaises.map(({ motif, count }, i) => {
                        const maxCount = mauvaises[0].count;
                        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div
                            key={motif}
                            className="flex items-center gap-3"
                          >
                            <div
                              className="w-80 shrink-0 truncate text-right text-sm text-gray-600"
                              title={motif}
                            >
                              {motif}
                            </div>
                            <div className="relative h-7 flex-1 rounded bg-gray-50">
                              <div
                                className="flex h-full items-center rounded px-2 text-xs font-semibold text-white"
                                style={{
                                  width: `${Math.max(pct, 3)}%`,
                                  backgroundColor: i === 0 ? '#e1000f' : '#f28f8f',
                                  minWidth: '40px',
                                }}
                              >
                                {count}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
      </Tabs>
    </div>
  );
}
