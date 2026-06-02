import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminFeisResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';

type FeiRow = AdminFeisResponse['data']['feis'][number];

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}

function formatDateOnly(d: Date | string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY');
}

export default function AdminFeis() {
  const [rows, setRows] = useState<FeiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 100;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (debouncedSearch) query.search = debouncedSearch;
    API.get({ path: 'admin/feis', query })
      .then((res) => res as AdminFeisResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.feis);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [offset, debouncedSearch]);

  if (loading && rows.length === 0) {
    return <Chargement />;
  }

  return (
    <div className="py-4">
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Fiches ({total})</h3>
          <div className="flex items-center gap-2">
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Précédent
            </button>
            <span className="text-sm tabular-nums">
              {offset + 1}–{Math.min(offset + limit, total)} / {total}
            </span>
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Suivant
            </button>
          </div>
        </div>
        <input
          type="search"
          className="fr-input"
          placeholder="Rechercher par numéro de fiche ou commune de mise à mort…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-1">numéro</th>
            <th className="p-1">date mise à mort</th>
            <th className="p-1">commune</th>
            <th className="p-1">examinateur</th>
            <th className="p-1">premier détenteur</th>
            <th className="p-1">nb carcasses</th>
            <th className="p-1">SVI</th>
            <th className="p-1">created_at</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.numero}
              className="border-b hover:bg-blue-50"
            >
              <td className="p-1">
                <Link
                  to={`/app/admin/fei/${encodeURIComponent(row.numero)}`}
                  className="text-blue-600 underline"
                >
                  {row.numero}
                </Link>
              </td>
              <td className="p-1">{formatDateOnly(row.date_mise_a_mort)}</td>
              <td className="p-1">{row.commune_mise_a_mort ?? '—'}</td>
              <td
                className="max-w-[160px] truncate p-1"
                title={row.FeiExaminateurInitialUser?.email ?? ''}
              >
                {row.FeiExaminateurInitialUser?.email ?? '—'}
              </td>
              <td
                className="max-w-[160px] truncate p-1"
                title={row.FeiPremierDetenteurEntity?.nom_d_usage ?? row.FeiPremierDetenteurUser?.email ?? ''}
              >
                {row.FeiPremierDetenteurEntity?.nom_d_usage ?? row.FeiPremierDetenteurUser?.email ?? '—'}
              </td>
              <td className="p-1">{row._count.Carcasses}</td>
              <td
                className="max-w-[160px] truncate p-1"
                title={row.FeiSviEntity?.nom_d_usage ?? ''}
              >
                {row.FeiSviEntity?.nom_d_usage ?? '—'}
              </td>
              <td className="p-1">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
