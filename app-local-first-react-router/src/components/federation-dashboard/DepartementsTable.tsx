import { useMemo, useState, type ReactNode } from 'react';
import { type FormationRow } from './SectionFormation';

export interface CircuitBucket {
  agree: number;
  nonAgree: number;
  domestique: number;
  tauxSaisie: number | null;
}

/**
 * Pour le petit gibier une ligne de carcasse est un lot : `agree`/`nonAgree`/`domestique`
 * comptent les lots, les champs `*Animaux` comptent les animaux qu'ils contiennent.
 */
export interface PetitGibierBucket extends CircuitBucket {
  agreeAnimaux: number;
  nonAgreeAnimaux: number;
  domestiqueAnimaux: number;
}

export interface DepartementRow {
  code: string;
  nom: string;
  gg: CircuitBucket;
  pg: PetitGibierBucket;
}

interface MergedRow {
  code: string;
  nom: string;
  examinateursActifs: number;
  ggAgree: number;
  ggNonAgree: number;
  ggDomestique: number;
  ggTotal: number;
  ggTauxSaisie: number | null;
  pgAgree: number;
  pgNonAgree: number;
  pgDomestique: number;
  pgTotal: number;
  pgLots: number;
  pgTauxSaisie: number | null;
  tauxSaisieBph: number | null;
  scoreBph: number | null;
}

interface Props {
  valorisation: DepartementRow[];
  formation: FormationRow[];
  showSearch?: boolean;
}

function formatTaux(taux: number | null): string {
  if (taux === null) return '—';
  return `${taux}%`;
}

function mergeRows(valorisation: DepartementRow[], formation: FormationRow[]): MergedRow[] {
  const valoByCode = new Map(valorisation.map((d) => [d.code, d]));
  const formByCode = new Map(formation.map((d) => [d.code, d]));
  const codes = new Set([...valoByCode.keys(), ...formByCode.keys()]);

  return Array.from(codes)
    .map((code) => {
      const v = valoByCode.get(code);
      const f = formByCode.get(code);
      const gg = v?.gg;
      const pg = v?.pg;
      return {
        code,
        nom: v?.nom ?? f?.nom ?? code,
        examinateursActifs: f?.examinateursActifs ?? 0,
        ggAgree: gg?.agree ?? 0,
        ggNonAgree: gg?.nonAgree ?? 0,
        ggDomestique: gg?.domestique ?? 0,
        ggTotal: (gg?.agree ?? 0) + (gg?.nonAgree ?? 0) + (gg?.domestique ?? 0),
        ggTauxSaisie: gg?.tauxSaisie ?? null,
        pgAgree: pg?.agreeAnimaux ?? 0,
        pgNonAgree: pg?.nonAgreeAnimaux ?? 0,
        pgDomestique: pg?.domestiqueAnimaux ?? 0,
        pgTotal: (pg?.agreeAnimaux ?? 0) + (pg?.nonAgreeAnimaux ?? 0) + (pg?.domestiqueAnimaux ?? 0),
        pgLots: (pg?.agree ?? 0) + (pg?.nonAgree ?? 0) + (pg?.domestique ?? 0),
        pgTauxSaisie: pg?.tauxSaisie ?? null,
        tauxSaisieBph: f?.tauxSaisieBph ?? null,
        scoreBph: f?.scoreBph ?? null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

type NumericKey = Exclude<keyof MergedRow, 'code' | 'nom'>;

interface Column {
  key: NumericKey;
  label: string;
  render?: (row: MergedRow) => ReactNode;
  /** Colonne agrégeable : un taux ne se somme pas, il vaut « — » dans la ligne Total. */
  summable: boolean;
}

interface Group {
  label: string;
  className: string;
  columns: Column[];
}

const GROUPS: Group[] = [
  {
    label: 'Grand gibier',
    className: 'bg-blue-50',
    columns: [
      { key: 'ggAgree', label: 'Agréé', summable: true },
      { key: 'ggNonAgree', label: 'Non agréé', summable: true },
      { key: 'ggDomestique', label: 'Domestique', summable: true },
      { key: 'ggTotal', label: 'Total', summable: true },
      {
        key: 'ggTauxSaisie',
        label: 'Taux saisie',
        render: (r) => formatTaux(r.ggTauxSaisie),
        summable: false,
      },
    ],
  },
  {
    label: 'Petit gibier (animaux)',
    className: 'bg-amber-50',
    columns: [
      { key: 'pgAgree', label: 'Agréé', summable: true },
      { key: 'pgNonAgree', label: 'Non agréé', summable: true },
      { key: 'pgDomestique', label: 'Domestique', summable: true },
      { key: 'pgTotal', label: 'Total', summable: true },
      { key: 'pgLots', label: 'Lots', summable: true },
      {
        key: 'pgTauxSaisie',
        label: 'Taux saisie (lots)',
        render: (r) => formatTaux(r.pgTauxSaisie),
        summable: false,
      },
    ],
  },
  {
    label: "Bonnes pratiques d'hygiène",
    className: 'bg-purple-50',
    columns: [
      {
        key: 'tauxSaisieBph',
        label: 'Taux saisie BPH',
        render: (r) => formatTaux(r.tauxSaisieBph),
        summable: false,
      },
      {
        key: 'scoreBph',
        label: 'Score BPH',
        render: (r) => (r.scoreBph !== null ? `${r.scoreBph}/100` : '—'),
        summable: false,
      },
    ],
  },
];

const EXAMINATEURS_COLUMN: Column = {
  key: 'examinateursActifs',
  label: 'Examinateurs actifs',
  summable: true,
};

type SortKey = 'code' | NumericKey;

function sortIndicator(active: boolean, desc: boolean): string {
  if (!active) return '';
  return desc ? ' ▼' : ' ▲';
}

export default function DepartementsTable({ valorisation, formation, showSearch = false }: Props) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('code');
  const [sortDesc, setSortDesc] = useState(false);

  const rows = useMemo(() => mergeRows(valorisation, formation), [valorisation, formation]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q));
  }, [rows, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === 'code') {
        const cmp = a.code.localeCompare(b.code);
        return sortDesc ? -cmp : cmp;
      }
      // Un département sans donnée (taux null) reste en bas quel que soit le sens du tri.
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      const cmp = aVal - bVal;
      return sortDesc ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDesc]);

  const totals = useMemo(() => {
    const allColumns = [EXAMINATEURS_COLUMN, ...GROUPS.flatMap((g) => g.columns)];
    const acc = new Map<NumericKey, number>();
    for (const col of allColumns) {
      if (!col.summable) continue;
      acc.set(
        col.key,
        filtered.reduce((sum, r) => sum + (r[col.key] ?? 0), 0)
      );
    }
    return acc;
  }, [filtered]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
      return;
    }
    setSortKey(key);
    // Un classement se lit du plus gros au plus petit, sauf pour le code département.
    setSortDesc(key !== 'code');
  };

  const leafColumns = GROUPS.flatMap((g) => g.columns);
  const columnCount = 2 + leafColumns.length;

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
              scope="col"
              rowSpan={2}
              className="cursor-pointer border-r px-3 py-2 text-left font-semibold"
              onClick={() => handleSort('code')}
            >
              Département{sortIndicator(sortKey === 'code', sortDesc)}
            </th>
            <th
              scope="col"
              rowSpan={2}
              className="cursor-pointer border-r bg-green-50 px-2 py-2 text-right font-semibold"
              onClick={() => handleSort(EXAMINATEURS_COLUMN.key)}
            >
              Examinateurs actifs
              {sortIndicator(sortKey === EXAMINATEURS_COLUMN.key, sortDesc)}
            </th>
            {GROUPS.map((group) => (
              <th
                key={group.label}
                scope="colgroup"
                colSpan={group.columns.length}
                className={`border-r px-3 py-2 text-center font-semibold ${group.className}`}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr className="text-xs text-gray-600 uppercase">
            {GROUPS.map((group) =>
              group.columns.map((col, index) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`cursor-pointer px-2 py-1 text-right font-semibold ${group.className} ${
                    index === group.columns.length - 1 ? 'border-r' : ''
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortIndicator(sortKey === col.key, sortDesc)}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="px-3 py-6 text-center text-gray-500"
              >
                Aucune donnée à afficher.
              </td>
            </tr>
          ) : (
            sorted.map((r) => (
              <tr
                key={r.code}
                className="border-t hover:bg-gray-50"
              >
                <td className="border-r px-3 py-2">
                  <span className="font-mono text-gray-500">{r.code}</span>{' '}
                  <span className="text-gray-800">{r.nom}</span>
                </td>
                <td className="border-r px-2 py-2 text-right font-semibold tabular-nums">
                  {r.examinateursActifs}
                </td>
                {GROUPS.map((group) =>
                  group.columns.map((col, index) => (
                    <td
                      key={col.key}
                      className={`px-2 py-2 text-right tabular-nums ${
                        index === group.columns.length - 1 ? 'border-r font-semibold' : ''
                      }`}
                    >
                      {col.render ? col.render(r) : r[col.key]}
                    </td>
                  ))
                )}
              </tr>
            ))
          )}
        </tbody>
        {sorted.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
              <td className="border-r px-3 py-2">Total</td>
              <td className="border-r px-2 py-2 text-right tabular-nums">
                {totals.get(EXAMINATEURS_COLUMN.key)}
              </td>
              {GROUPS.map((group) =>
                group.columns.map((col, index) => (
                  <td
                    key={col.key}
                    className={`px-2 py-2 text-right tabular-nums ${
                      index === group.columns.length - 1 ? 'border-r' : ''
                    }`}
                  >
                    {col.summable ? totals.get(col.key) : '—'}
                  </td>
                ))
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
