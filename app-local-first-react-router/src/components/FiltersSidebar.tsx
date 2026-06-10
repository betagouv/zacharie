import { useEffect, useState, type ReactNode } from 'react';

interface FiltersSidebarProps {
  children: ReactNode;
  storageKey: string;
  activeFilterCount?: number;
  onReset?: () => void;
  title?: string;
}

// Sidebar de filtres réutilisable, calquée sur la page « Mes fiches » chasseur.
// - Desktop : panneau collé à gauche, repliable en une bande étroite (état persité en localStorage).
// - Mobile : bouton « Filtres » + panneau modal overlay.
// À placer comme premier enfant d'un conteneur `md:flex` ; le contenu principal suit dans un `flex-1`.
export default function FiltersSidebar({
  children,
  storageKey,
  activeFilterCount = 0,
  onReset,
  title = 'Filtres',
}: FiltersSidebarProps) {
  const [open, setOpen] = useState(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) return stored === 'true';
    return window.innerWidth >= 768;
  });
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(open));
  }, [open, storageKey]);

  const countBadge =
    activeFilterCount > 0 ? (
      <span className="bg-action-high-blue-france flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
        {activeFilterCount}
      </span>
    ) : null;

  return (
    <>
      {/* Mobile : bouton filtres */}
      <div className="mb-2 flex md:hidden">
        <button
          type="button"
          aria-label="Filtres"
          className="relative flex h-10 items-center gap-1 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          onClick={() => setShowMobileFilters(true)}
        >
          <span
            className="fr-icon--sm ri-filter-3-line"
            aria-hidden="true"
          />
          <span>Filtres</span>
          {countBadge}
        </button>
      </div>

      {/* Mobile : panneau modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-[800] md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="m-0 text-lg font-bold">{title}</h2>
              <button
                type="button"
                className="text-action-high-blue-france text-sm underline"
                onClick={() => setShowMobileFilters(false)}
              >
                Fermer
              </button>
            </div>
            {onReset && activeFilterCount > 0 && (
              <button
                type="button"
                className="text-action-high-blue-france mb-2 text-xs underline"
                onClick={onReset}
              >
                Réinitialiser les filtres
              </button>
            )}
            {children}
          </div>
        </div>
      )}

      {/* Desktop : sidebar repliée -> bande étroite */}
      {!open && (
        <button
          type="button"
          aria-label="Afficher les filtres"
          title="Afficher les filtres"
          className="relative sticky top-0 hidden h-screen shrink-0 items-start border-r border-gray-200 bg-white px-2 py-3 md:flex"
          onClick={() => setOpen(true)}
        >
          <span
            className="fr-icon--sm ri-filter-3-line text-gray-700"
            aria-hidden="true"
          />
          {activeFilterCount > 0 && (
            <span className="bg-action-high-blue-france absolute top-1 right-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {/* Desktop : sidebar ouverte */}
      {open && (
        <aside className="sticky top-0 hidden h-screen w-52 shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-3 py-2 md:block">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
              {title}
              {countBadge}
            </span>
            <span className="flex items-center gap-2">
              {onReset && activeFilterCount > 0 && (
                <button
                  type="button"
                  className="text-action-high-blue-france text-xs underline"
                  onClick={onReset}
                >
                  Réinitialiser
                </button>
              )}
              <button
                type="button"
                aria-label="Replier les filtres"
                title="Replier les filtres"
                className="fr-icon-arrow-left-s-line fr-icon--sm text-gray-500 hover:text-gray-800"
                onClick={() => setOpen(false)}
              />
            </span>
          </div>
          {children}
        </aside>
      )}
    </>
  );
}
