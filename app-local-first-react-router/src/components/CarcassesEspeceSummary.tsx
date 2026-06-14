import { useMemo, useState } from 'react';
import { Carcasse, CarcasseType } from '@prisma/client';

/**
 * Bloc compact et masquable affichant le total du nombre de carcasses par espèce.
 * Le total est calculé à partir de la liste fournie (donc en fonction des filtres actifs).
 */
export default function CarcassesEspeceSummary({
  carcasses,
  storageKey,
}: {
  carcasses: Array<Pick<Carcasse, 'espece' | 'type' | 'nombre_d_animaux'>>;
  storageKey: string;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved === null ? true : saved === 'true';
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  const { rows, total } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const carcasse of carcasses) {
      if (!carcasse.espece) continue;
      const count = carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
      map.set(carcasse.espece, (map.get(carcasse.espece) ?? 0) + count);
      total += count;
    }
    const rows = Array.from(map.entries())
      .map(([espece, count]) => ({ espece, count }))
      .sort((a, b) => b.count - a.count);
    return { rows, total };
  }, [carcasses]);

  return (
    <div className="mb-4 rounded border border-gray-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold text-gray-800"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          Total par espèce
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">
            {total} carcasse{total > 1 ? 's' : ''}
          </span>
        </span>
        <span
          className={`fr-icon--sm transition-transform ${open ? 'fr-icon-arrow-up-s-line' : 'fr-icon-arrow-down-s-line'}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-2">
          {rows.length === 0 ? (
            <p className="m-0 text-sm text-gray-400">Aucune carcasse</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {rows.map(({ espece, count }) => (
                <li
                  key={espece}
                  className="flex items-baseline gap-1 text-sm"
                >
                  <span className="font-semibold text-gray-900">{count}</span>
                  <span className="text-gray-600">{espece}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
