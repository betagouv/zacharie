import { useUrlFilters } from './use-url-filters';

export type AdminView = {
  label: string;
  params: Record<string, string>;
};

// Clé de comparaison : paramètres triés, valeurs de liste triées, sans les paramètres ignorés.
function viewKey(params: URLSearchParams, ignored: Array<string>) {
  return [...params.entries()]
    .filter(([key, value]) => value && !ignored.includes(key))
    .map(([key, value]) => `${key}=${value.split(',').sort().join(',')}`)
    .sort()
    .join('&');
}

// Vues prédéfinies d'une liste admin : chaque vue est un jeu de filtres dans l'URL.
// `keep` : paramètres conservés au changement de vue et ignorés pour savoir quelle vue est active (le tri).
export default function AdminViews({ views, keep = [] }: { views: Array<AdminView>; keep?: Array<string> }) {
  const { searchParams, replaceFilters } = useUrlFilters();
  const ignored = ['page', ...keep];
  const currentKey = viewKey(searchParams, ignored);

  return (
    <div
      className="flex flex-wrap gap-1 py-2"
      role="group"
      aria-label="Vues"
    >
      {views.map((view) => {
        const active = viewKey(new URLSearchParams(view.params), ignored) === currentKey;
        return (
          <button
            key={view.label}
            type="button"
            aria-pressed={active}
            className="rounded-full border px-2 py-0.5 text-xs"
            style={
              active
                ? {
                    backgroundColor: 'var(--background-active-blue-france)',
                    color: 'var(--text-inverted-blue-france)',
                    borderColor: 'var(--background-active-blue-france)',
                  }
                : {
                    backgroundColor: 'var(--background-contrast-grey)',
                    color: 'var(--text-default-grey)',
                    borderColor: 'var(--border-default-grey)',
                  }
            }
            onClick={() => replaceFilters(view.params, keep)}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
