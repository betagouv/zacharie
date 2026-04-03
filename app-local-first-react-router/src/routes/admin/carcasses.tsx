import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminCarcassesResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';

type CarcasseRow = AdminCarcassesResponse['data']['carcasses'][number];

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YYYY HH:mm');
}

export default function AdminCarcassesIntermediaires() {
  const [rows, setRows] = useState<CarcasseRow[]>([]);
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
    API.get({ path: 'admin/carcasses', query })
      .then((res) => res as AdminCarcassesResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.carcasses);
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
          <h3 className="text-lg font-bold">Carcasses ({total})</h3>
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
          placeholder="Rechercher par numéro de bracelet, numéro de FEI ou espèce…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-1">bracelet</th>
            <th className="p-1">espèce</th>
            <th className="p-1">type</th>
            <th className="p-1">fei_numero</th>
            <th className="p-1">nb intermédiaires</th>
            <th className="p-1">created_at</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.zacharie_carcasse_id} className="border-b hover:bg-blue-50">
              <td className="p-1">
                <Link
                  to={`/app/admin/carcasse/${encodeURIComponent(row.zacharie_carcasse_id)}`}
                  className="text-blue-600 underline"
                >
                  {row.numero_bracelet}
                </Link>
              </td>
              <td className="p-1">{row.espece}</td>
              <td className="p-1">{row.type}</td>
              <td className="max-w-[120px] truncate p-1" title={row.fei_numero}>
                {row.fei_numero}
              </td>
              <td className="p-1">{row._count.CarcasseIntermediaire}</td>
              <td className="p-1">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
