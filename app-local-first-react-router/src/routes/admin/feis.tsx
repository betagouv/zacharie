import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminFeisResponse, AdminFeisFilterOptionsResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';

type FeiRow = AdminFeisResponse['data']['feis'][number];
type FilterOptions = AdminFeisFilterOptionsResponse['data'];

const emptyFilterOptions: FilterOptions = { examinateurs: [], premiersDetenteurs: [] };

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
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);
  const [examinateurs, setExaminateurs] = useState<string[]>([]);
  const [premiersDetenteurs, setPremiersDetenteurs] = useState<string[]>([]);
  const [creationContexts, setCreationContexts] = useState<string[]>([]);
  const [avecCarcasses, setAvecCarcasses] = useState<string[]>([]);
  const [dateMiseAMortFrom, setDateMiseAMortFrom] = useState('');
  const [dateMiseAMortTo, setDateMiseAMortTo] = useState('');
  const [dateCreationFrom, setDateCreationFrom] = useState('');
  const [dateCreationTo, setDateCreationTo] = useState('');
  const limit = 100;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    API.get({ path: 'admin/feis/filter-options' })
      .then((res) => res as AdminFeisFilterOptionsResponse)
      .then((res) => {
        if (res.ok) setFilterOptions(res.data);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (debouncedSearch) query.search = debouncedSearch;
    if (examinateurs.length) query.examinateur_ids = examinateurs.join(',');
    if (premiersDetenteurs.length) query.premier_detenteur_ids = premiersDetenteurs.join(',');
    if (creationContexts.length) query.creation_context = creationContexts.join(',');
    if (avecCarcasses.length) query.avec_carcasses = avecCarcasses.join(',');
    if (dateMiseAMortFrom) query.date_mise_a_mort_from = dateMiseAMortFrom;
    if (dateMiseAMortTo) query.date_mise_a_mort_to = dateMiseAMortTo;
    if (dateCreationFrom) query.created_at_from = dateCreationFrom;
    if (dateCreationTo) query.created_at_to = dateCreationTo;
    API.get({ path: 'admin/feis', query })
      .then((res) => res as AdminFeisResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.feis);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [
    offset,
    debouncedSearch,
    examinateurs,
    premiersDetenteurs,
    creationContexts,
    avecCarcasses,
    dateMiseAMortFrom,
    dateMiseAMortTo,
    dateCreationFrom,
    dateCreationTo,
  ]);

  const activeFilterCount =
    (search ? 1 : 0) +
    examinateurs.length +
    premiersDetenteurs.length +
    creationContexts.length +
    avecCarcasses.length +
    (dateMiseAMortFrom ? 1 : 0) +
    (dateMiseAMortTo ? 1 : 0) +
    (dateCreationFrom ? 1 : 0) +
    (dateCreationTo ? 1 : 0);

  if (loading && rows.length === 0) {
    return <Chargement />;
  }

  return (
    <div className="md:-ml-4 md:flex">
      <FiltersSidebar
        storageKey="admin-feis-filters"
        activeFilterCount={activeFilterCount}
        onReset={() => {
          setSearch('');
          setExaminateurs([]);
          setPremiersDetenteurs([]);
          setCreationContexts([]);
          setAvecCarcasses([]);
          setDateMiseAMortFrom('');
          setDateMiseAMortTo('');
          setDateCreationFrom('');
          setDateCreationTo('');
          setOffset(0);
        }}
      >
        <div className="relative">
          <span
            className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Recherche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <DateRangeFilterSection
          title="Date de mise à mort"
          from={dateMiseAMortFrom}
          to={dateMiseAMortTo}
          onChange={(from, to) => {
            setDateMiseAMortFrom(from);
            setDateMiseAMortTo(to);
            setOffset(0);
          }}
        />
        <DateRangeFilterSection
          title="Date de création"
          defaultOpen={false}
          from={dateCreationFrom}
          to={dateCreationTo}
          onChange={(from, to) => {
            setDateCreationFrom(from);
            setDateCreationTo(to);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Examinateur"
          scroll
          options={filterOptions.examinateurs.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          selected={examinateurs}
          onChange={(next) => {
            setExaminateurs(next);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Premier détenteur"
          scroll
          options={filterOptions.premiersDetenteurs.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          selected={premiersDetenteurs}
          onChange={(next) => {
            setPremiersDetenteurs(next);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Origine"
          defaultOpen={false}
          options={[
            { value: 'zacharie', label: 'Zacharie' },
            { value: 'api', label: 'API' },
          ]}
          selected={creationContexts}
          onChange={(next) => {
            setCreationContexts(next);
            setOffset(0);
          }}
        />
        <CheckboxFilterSection
          title="Contenu"
          defaultOpen={false}
          options={[
            { value: 'avec', label: 'Avec carcasses' },
            { value: 'sans', label: 'Sans carcasse' },
          ]}
          selected={avecCarcasses}
          onChange={(next) => {
            setAvecCarcasses(next);
            setOffset(0);
          }}
        />
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <div className="mb-4 flex items-center justify-between">
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
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-1">numéro</th>
              <th className="p-1">date mise à mort</th>
              <th className="p-1">commune</th>
              <th className="p-1">examinateur</th>
              <th className="p-1">premier détenteur</th>
              <th className="p-1">nb carcasses</th>
              {/* <th className="p-1">SVI</th> */}
              <th className="p-1">created_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.numero}
                className={`border-b hover:bg-blue-50 ${row.deleted_at ? 'text-gray-400 line-through' : ''}`}
              >
                <td className="p-1">
                  <Link
                    to={`/app/admin/fei/${encodeURIComponent(row.numero)}`}
                    className={row.deleted_at ? 'text-gray-400 underline' : 'text-blue-600 underline'}
                  >
                    {row.numero}
                  </Link>
                  {row.deleted_at && (
                    <span
                      className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700 no-underline"
                      title={`Supprimée le ${formatDate(row.deleted_at)}`}
                    >
                      Supprimée
                    </span>
                  )}
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
                  title={
                    row.FeiPremierDetenteurEntity?.nom_d_usage ?? row.FeiPremierDetenteurUser?.email ?? ''
                  }
                >
                  {row.FeiPremierDetenteurEntity?.nom_d_usage ?? row.FeiPremierDetenteurUser?.email ?? '—'}
                </td>
                <td className="p-1">{row._count.Carcasses}</td>
                {/* <td
                  className="max-w-[160px] truncate p-1"
                  title={row.FeiSviEntity?.nom_d_usage ?? ''}
                >
                  {row.FeiSviEntity?.nom_d_usage ?? '—'}
                </td> */}
                <td className="p-1">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
