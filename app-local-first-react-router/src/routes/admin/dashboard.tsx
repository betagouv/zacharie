import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminDashboardResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const funnelLabels: Array<{ key: keyof AdminDashboardResponse['data']['funnel']; label: string }> = [
  { key: 'chasseurs_inscrits', label: 'Chasseurs inscrits' },
  { key: 'compte_valide', label: 'Compte validé (n° examinateur)' },
  { key: 'fiche_ouverte', label: 'Fiche ouverte (non finalisée)' },
  { key: 'envoye_1_fiche', label: 'Envoyé >= 1 fiche' },
  { key: 'envoye_2_fiches', label: 'Envoyé >= 2 fiches' },
  { key: 'envoye_3_fiches', label: 'Envoyé >= 3 fiches' },
];

const dsfrBlues = [
  'var(--background-action-high-blue-france)',
  '#3a55d1',
  '#4e66d8',
  '#6277df',
  '#7688e5',
  '#8a99ec',
];

function getSeasons(): Array<{ label: string; from: string; to: string }> {
  const now = dayjs();
  const currentYear = now.year();
  const currentSeasonStart = now.month() < 6 ? currentYear - 1 : currentYear; // month() is 0-indexed, 6 = July
  const seasons: Array<{ label: string; from: string; to: string }> = [];
  for (let startYear = 2024; startYear <= currentSeasonStart; startYear++) {
    seasons.push({
      label: `${startYear}-${startYear + 1}`,
      from: `${startYear}-07-01`,
      to: `${startYear + 1}-06-30`,
    });
  }
  return seasons;
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => dayjs().subtract(90, 'day').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(() => dayjs().format('YYYY-MM-DD'));

  const seasons = getSeasons();

  useEffect(() => {
    setLoading(true);
    API.get({ path: 'admin/dashboard', query: { date_from: dateFrom, date_to: dateTo } })
      .then((res) => res as AdminDashboardResponse)
      .then((res) => {
        if (res.ok) {
          setData(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading && !data) {
    return <Chargement />;
  }

  if (!data) {
    return <p>Erreur lors du chargement des données.</p>;
  }

  const maxFunnel = data.funnel.chasseurs_inscrits || 1;
  const totalInscriptions = data.inscriptions_par_jour.reduce((sum, r) => sum + r.count, 0);

  const inscriptionsParJourCompletes = (() => {
    const countByDate = new Map(data.inscriptions_par_jour.map((r) => [r.date, r.count]));
    const result: Array<{ date: string; count: number }> = [];
    let current = dayjs(dateFrom);
    const end = dayjs(dateTo);
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const key = current.format('YYYY-MM-DD');
      result.push({ date: key, count: countByDate.get(key) ?? 0 });
      current = current.add(1, 'day');
    }
    return result;
  })();

  return (
    <div className="py-6 space-y-6">
      <h2 className="text-xl font-bold">Tableau de bord</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Chasseurs inscrits</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--background-action-high-blue-france)' }}>
            {data.funnel.chasseurs_inscrits.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Comptes validés</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--background-action-high-blue-france)' }}>
            {data.funnel.compte_valide.toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {maxFunnel > 0 ? ((data.funnel.compte_valide / maxFunnel) * 100).toFixed(1) : 0}% des inscrits
          </p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Inscriptions (période)</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--background-action-high-blue-france)' }}>
            {totalInscriptions.toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {dayjs(dateFrom).format('DD/MM/YY')} — {dayjs(dateTo).format('DD/MM/YY')}
          </p>
        </div>
      </div>

      {/* Funnel */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-5">Funnel chasseurs</h3>
        <div className="space-y-3">
          {funnelLabels.map(({ key, label }, i) => {
            const count = data.funnel[key];
            const pct = maxFunnel > 0 ? (count / maxFunnel) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-4">
                <div className="w-56 shrink-0 text-sm text-right text-gray-600">{label}</div>
                <div className="flex-1 relative h-9 rounded bg-gray-50">
                  <div
                    className="h-full rounded flex items-center px-3 text-white text-sm font-semibold transition-all duration-300"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      backgroundColor: dsfrBlues[i],
                      minWidth: '80px',
                    }}
                  >
                    {count.toLocaleString('fr-FR')}
                  </div>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inscriptions par jour */}
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Inscriptions chasseurs par jour</h3>
          <div className="flex items-end gap-3">
            <button
              type="button"
              className={`fr-btn fr-btn--sm fr-btn--tertiary`}
              onClick={() => {
                setDateFrom('2024-07-01');
                setDateTo(dayjs().format('YYYY-MM-DD'));
              }}
            >
              Global
            </button>
            {seasons.map((season) => {
              const isActive = dateFrom === season.from && dateTo === season.to;
              return (
                <button
                  key={season.label}
                  type="button"
                  className={`fr-btn fr-btn--sm ${isActive ? 'fr-btn--secondary' : 'fr-btn--tertiary'}`}
                  onClick={() => {
                    setDateFrom(season.from);
                    setDateTo(season.to);
                  }}
                >
                  {season.label}
                </button>
              );
            })}
            <div>
              <label className="fr-label text-xs mb-1" htmlFor="date-from">
                Début
              </label>
              <input
                id="date-from"
                className="fr-input fr-input--sm"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="fr-label text-xs mb-1" htmlFor="date-to">
                Fin
              </label>
              <input
                id="date-to"
                className="fr-input fr-input--sm"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>
        {inscriptionsParJourCompletes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune inscription sur cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={inscriptionsParJourCompletes}>
              <XAxis dataKey="date" tickFormatter={(d: string) => dayjs(d).format('DD/MM')} />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) => dayjs(String(d)).format('DD/MM/YYYY')}
                formatter={(value) => [value, 'Inscriptions']}
              />
              <Bar dataKey="count" fill="var(--background-action-high-blue-france)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
