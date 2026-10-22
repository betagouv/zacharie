import { useEffect, useState } from 'react';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminHistoryPageResponse } from '@api/src/types/admin-history';
import { AdminHistoryEvents } from './history-timeline';
import { HISTORY_SUBJECT_TYPES } from './history-labels';

type HistoryPageData = NonNullable<AdminHistoryPageResponse['data']>;

const inputClassName =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

// Qui a modifié quoi : dernières modifications lues dans les tables d'historique, toutes tables confondues
export default function AdminHistory() {
  const [data, setData] = useState<HistoryPageData | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [authorEmail, setAuthorEmail] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [debounced, setDebounced] = useState({ authorEmail: '', subjectId: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 100;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced({ authorEmail, subjectId });
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [authorEmail, subjectId]);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (types.length) query.types = types.join(',');
    if (debounced.authorEmail) query.author_email = debounced.authorEmail;
    if (debounced.subjectId) query.subject_id = debounced.subjectId;
    if (dateFrom) query.created_at_from = dateFrom;
    if (dateTo) query.created_at_to = dateTo;
    API.get({ path: 'admin/history', query })
      .then((res) => res as AdminHistoryPageResponse)
      .then((res) => {
        if (res.ok && res.data) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, [offset, types, debounced, dateFrom, dateTo]);

  const activeFilterCount =
    types.length + (authorEmail ? 1 : 0) + (subjectId ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  if (loading && !data) {
    return <Chargement />;
  }

  const total = data?.total ?? 0;

  return (
    <div className="md:-ml-4 md:flex">
      <title>
        Historique | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <FiltersSidebar
        storageKey="admin-history-filters"
        activeFilterCount={activeFilterCount}
        onReset={() => {
          setTypes([]);
          setAuthorEmail('');
          setSubjectId('');
          setDateFrom('');
          setDateTo('');
          setOffset(0);
        }}
      >
        <input
          type="search"
          placeholder="Email de l'auteur..."
          aria-label="Email de l'auteur"
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          className={inputClassName}
        />
        <p className="m-0 text-xs text-gray-500">
          L'auteur n'est connu que pour les fiches, carcasses et lignes intermédiaires.
        </p>
        <input
          type="search"
          placeholder="Identifiant (numéro de fiche, carcasse, utilisateur…)"
          aria-label="Identifiant"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className={inputClassName}
        />
        <DateRangeFilterSection
          title="Date"
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Type"
          options={HISTORY_SUBJECT_TYPES}
          selected={types}
          onChange={(next) => {
            setTypes(next);
            setOffset(0);
          }}
        />
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Historique ({total})</h3>
          <div className="flex items-center gap-2">
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Précédent
            </button>
            <span className="text-sm tabular-nums">
              {total ? offset + 1 : 0}–{Math.min(offset + limit, total)} / {total}
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
        <AdminHistoryEvents events={data?.events ?? []} />
      </div>
    </div>
  );
}
