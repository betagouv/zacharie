import { useMemo, useState } from 'react';

interface CircuitBucket {
  agree: number;
  nonAgree: number;
  domestique: number;
  tauxSaisie: number | null;
}

export interface DepartementRow {
  code: string;
  nom: string;
  gg: CircuitBucket;
  pg: CircuitBucket;
}

interface Props {
  rows: DepartementRow[];
  showSearch?: boolean;
}

function formatTaux(taux: number | null): string {
  if (taux === null) return '—';
  return `${taux}%`;
}

function totalRow(rows: DepartementRow[]): {
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  pgAgree: number;
  pgNonAgree: number;
  pgDomestique: number;
} {
  return rows.reduce(
    (acc, r) => ({
      ggAgree: acc.ggAgree + r.gg.agree,
      ggNonAgree: acc.ggNonAgree + r.gg.nonAgree,
      ggDomestique: acc.ggDomestique + r.gg.domestique,
      pgAgree: acc.pgAgree + r.pg.agree,
      pgNonAgree: acc.pgNonAgree + r.pg.nonAgree,
      pgDomestique: acc.pgDomestique + r.pg.domestique,
    }),
    { ggAgree: 0, ggNonAgree: 0, ggDomestique: 0, pgAgree: 0, pgNonAgree: 0, pgDomestique: 0 }
  );
}

export default function ValorisationTable({ rows, showSearch = false }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q));
  }, [rows, filter]);

  const total = useMemo(() => totalRow(filtered), [filtered]);

  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      {showSearch && (
        <div className="border-b p-3">
          <input
            type="search"
            placeholder="Filtrer par département (code ou nom)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="fr-input w-full max-w-md"
          />
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th
              rowSpan={2}
              className="border-r px-3 py-2 text-left font-semibold"
            >
              Département
            </th>
            <th
              colSpan={4}
              className="border-r bg-blue-50 px-3 py-2 text-center font-semibold"
            >
              Grand gibier
            </th>
            <th
              colSpan={4}
              className="bg-amber-50 px-3 py-2 text-center font-semibold"
            >
              Petit gibier
            </th>
          </tr>
          <tr className="text-xs text-gray-600 uppercase">
            <th className="bg-blue-50 px-2 py-1 text-right">Agréé</th>
            <th className="bg-blue-50 px-2 py-1 text-right">Non agréé</th>
            <th className="bg-blue-50 px-2 py-1 text-right">Domestique</th>
            <th className="border-r bg-blue-50 px-2 py-1 text-right">Taux saisie</th>
            <th className="bg-amber-50 px-2 py-1 text-right">Agréé</th>
            <th className="bg-amber-50 px-2 py-1 text-right">Non agréé</th>
            <th className="bg-amber-50 px-2 py-1 text-right">Domestique</th>
            <th className="bg-amber-50 px-2 py-1 text-right">Taux saisie</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className="px-3 py-6 text-center text-gray-500"
              >
                Aucune donnée à afficher.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr
                key={r.code}
                className="border-t hover:bg-gray-50"
              >
                <td className="border-r px-3 py-2">
                  <span className="font-mono text-gray-500">{r.code}</span>{' '}
                  <span className="text-gray-800">{r.nom}</span>
                </td>
                <td className="px-2 py-2 text-right">{r.gg.agree}</td>
                <td className="px-2 py-2 text-right">{r.gg.nonAgree}</td>
                <td className="px-2 py-2 text-right">{r.gg.domestique}</td>
                <td className="border-r px-2 py-2 text-right font-semibold">{formatTaux(r.gg.tauxSaisie)}</td>
                <td className="px-2 py-2 text-right">{r.pg.agree}</td>
                <td className="px-2 py-2 text-right">{r.pg.nonAgree}</td>
                <td className="px-2 py-2 text-right">{r.pg.domestique}</td>
                <td className="px-2 py-2 text-right font-semibold">{formatTaux(r.pg.tauxSaisie)}</td>
              </tr>
            ))
          )}
        </tbody>
        {filtered.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
              <td className="border-r px-3 py-2">Total</td>
              <td className="px-2 py-2 text-right">{total.ggAgree}</td>
              <td className="px-2 py-2 text-right">{total.ggNonAgree}</td>
              <td className="px-2 py-2 text-right">{total.ggDomestique}</td>
              <td className="border-r px-2 py-2 text-right">—</td>
              <td className="px-2 py-2 text-right">{total.pgAgree}</td>
              <td className="px-2 py-2 text-right">{total.pgNonAgree}</td>
              <td className="px-2 py-2 text-right">{total.pgDomestique}</td>
              <td className="px-2 py-2 text-right">—</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
