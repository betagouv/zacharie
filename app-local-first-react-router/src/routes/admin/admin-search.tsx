import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import dayjs from 'dayjs';
import API from '@app/services/api';
import type { AdminSearchResponse } from '@api/src/types/responses';

type SearchResult = {
  key: string;
  group: string;
  icon: string;
  label: string;
  detail: string;
  to: string;
  deleted: boolean;
};

function toResults(data: AdminSearchResponse['data']): Array<SearchResult> {
  return [
    ...data.users.map((user) => ({
      key: `user-${user.id}`,
      group: 'Utilisateurs',
      icon: 'fr-icon-user-line',
      label: [user.prenom, user.nom_de_famille].filter(Boolean).join(' ') || user.email || user.id,
      detail: [user.email, user.roles.join(', ')].filter(Boolean).join(' · '),
      to: `/app/admin/user/${user.id}`,
      deleted: !!user.deleted_at,
    })),
    ...data.entities.map((entity) => ({
      key: `entity-${entity.id}`,
      group: 'Entités',
      icon: 'fr-icon-building-line',
      label: entity.nom_d_usage || entity.id,
      detail: [entity.type, entity.ville].filter(Boolean).join(' · '),
      to: `/app/admin/entity/${entity.id}`,
      deleted: !!entity.deleted_at,
    })),
    ...data.feis.map((fei) => ({
      key: `fei-${fei.numero}`,
      group: 'Fiches',
      icon: 'fr-icon-survey-line',
      label: fei.numero,
      detail: [
        fei.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : null,
        fei.commune_mise_a_mort,
      ]
        .filter(Boolean)
        .join(' · '),
      to: `/app/admin/fei/${fei.numero}`,
      deleted: !!fei.deleted_at,
    })),
    ...data.carcasses.map((carcasse) => ({
      key: `carcasse-${carcasse.zacharie_carcasse_id}`,
      group: 'Carcasses',
      icon: 'fr-icon-file-text-line',
      label: carcasse.numero_bracelet,
      detail: [carcasse.espece, carcasse.fei_numero].filter(Boolean).join(' · '),
      to: `/app/admin/carcasse/${carcasse.zacharie_carcasse_id}`,
      deleted: !!carcasse.deleted_at,
    })),
  ];
}

export default function AdminSearch({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<SearchResult>>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timeout = setTimeout(() => {
      API.get({ path: 'admin/search', query: { q } })
        .then((res) => res as AdminSearchResponse)
        .then((res) => {
          if (cancelled) return;
          setResults(res.ok ? toResults(res.data) : []);
          setActiveIndex(0);
          setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function select(result: SearchResult) {
    close();
    navigate(result.to);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? 'Rechercher (⌘K)' : undefined}
        className={`text-title-grey flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
          collapsed ? 'md:justify-center md:px-0' : ''
        }`}
      >
        <span
          className={`fr-icon-search-line fr-icon--sm shrink-0 ${collapsed ? 'md:mr-0' : 'mr-1'}`}
          aria-hidden="true"
        />
        <span className={`flex-1 ${collapsed ? 'md:hidden' : ''}`}>Rechercher</span>
        <kbd
          className={`rounded border border-gray-300 px-1 text-xs text-gray-500 ${collapsed ? 'md:hidden' : ''}`}
        >
          ⌘K
        </kbd>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/40 px-4 pt-[10vh]"
            onClick={close}
          >
            <div
              role="dialog"
              aria-label="Recherche globale"
              className="w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-gray-200 px-4">
                <span
                  className="fr-icon-search-line text-gray-500"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Utilisateur, entité, fiche, carcasse…"
                  className="w-full py-4 text-base outline-none"
                />
                <kbd className="shrink-0 rounded border border-gray-300 px-1.5 text-xs text-gray-500">
                  Échap
                </kbd>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {query.trim().length < 2 ? (
                  <p className="m-0 px-4 py-6 text-center text-sm text-gray-500">
                    Tapez au moins 2 caractères
                  </p>
                ) : loading ? (
                  <p className="m-0 px-4 py-6 text-center text-sm text-gray-500">Recherche…</p>
                ) : results.length === 0 ? (
                  <p className="m-0 px-4 py-6 text-center text-sm text-gray-500">Aucun résultat</p>
                ) : (
                  <ul className="m-0 list-none p-0 py-2">
                    {results.map((result, index) => (
                      <li key={result.key}>
                        {(index === 0 || results[index - 1].group !== result.group) && (
                          <p className="m-0 px-4 pt-2 pb-1 text-xs font-bold text-gray-500 uppercase">
                            {result.group}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => select(result)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                            index === activeIndex ? 'bg-open-blue-975' : ''
                          }`}
                        >
                          <span
                            className={`${result.icon} fr-icon--sm shrink-0 text-gray-500`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{result.label}</span>
                            {result.detail && (
                              <span className="block truncate text-xs text-gray-500">{result.detail}</span>
                            )}
                          </span>
                          {result.deleted && (
                            <span className="fr-badge fr-badge--sm fr-badge--error shrink-0">Supprimé</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
