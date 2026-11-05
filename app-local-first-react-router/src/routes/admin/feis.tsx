import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminFeisResponse, AdminFeisFilterOptionsResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';
import { formatDestinataire } from '@app/utils/admin-fei-destinataire';
import AdminViews, { type AdminView } from './admin-views';
import { toApiQuery, useDebouncedUrlText, usePageOffset, useUrlFilters, useUrlList } from './use-url-filters';

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

const LIMIT = 100;

// Calculées au rendu : « 7 derniers jours » part de la date du jour.
function getFeiViews(): Array<AdminView> {
  return [
    { label: 'Toutes', params: {} },
    {
      label: '7 derniers jours',
      params: { created_at_from: dayjs().subtract(7, 'day').format('YYYY-MM-DD') },
    },
    { label: 'Sans carcasse', params: { avec_carcasses: 'sans' } },
    { label: 'Créées via l’API', params: { creation_context: 'api' } },
  ];
}

export default function AdminFeis() {
  const [rows, setRows] = useState<FeiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);
  const { searchParams, setFilters, replaceFilters } = useUrlFilters();
  const offset = usePageOffset(searchParams, LIMIT);
  const urlSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useDebouncedUrlText(urlSearch, (value) =>
    setFilters({ search: value }, { replace: true })
  );
  const examinateurs = useUrlList(searchParams, 'examinateur_ids');
  const premiersDetenteurs = useUrlList(searchParams, 'premier_detenteur_ids');
  const creationContexts = useUrlList(searchParams, 'creation_context');
  const avecCarcasses = useUrlList(searchParams, 'avec_carcasses');
  const dateMiseAMortFrom = searchParams.get('date_mise_a_mort_from') ?? '';
  const dateMiseAMortTo = searchParams.get('date_mise_a_mort_to') ?? '';
  const dateCreationFrom = searchParams.get('created_at_from') ?? '';
  const dateCreationTo = searchParams.get('created_at_to') ?? '';
  const queryString = searchParams.toString();

  useEffect(() => {
    API.get({ path: 'admin/feis/filter-options' })
      .then((res) => res as AdminFeisFilterOptionsResponse)
      .then((res) => {
        if (res.ok) setFilterOptions(res.data);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = toApiQuery(new URLSearchParams(queryString), LIMIT, offset);
    API.get({ path: 'admin/feis', query })
      .then((res) => res as AdminFeisResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.feis);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [queryString, offset]);

  const activeFilterCount =
    (urlSearch ? 1 : 0) +
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
      <title>Fiches | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <FiltersSidebar
        storageKey="admin-feis-filters"
        activeFilterCount={activeFilterCount}
        onReset={() => replaceFilters({})}
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
          onChange={(from, to) => setFilters({ date_mise_a_mort_from: from, date_mise_a_mort_to: to })}
        />
        <DateRangeFilterSection
          title="Date de création"
          defaultOpen={false}
          from={dateCreationFrom}
          to={dateCreationTo}
          onChange={(from, to) => setFilters({ created_at_from: from, created_at_to: to })}
        />
        <CheckboxFilterSection
          title="Examinateur"
          scroll
          options={filterOptions.examinateurs.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          selected={examinateurs}
          onChange={(next) => setFilters({ examinateur_ids: next })}
        />
        <CheckboxFilterSection
          title="Premier détenteur"
          scroll
          options={filterOptions.premiersDetenteurs.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          selected={premiersDetenteurs}
          onChange={(next) => setFilters({ premier_detenteur_ids: next })}
        />
        <CheckboxFilterSection
          title="Origine"
          defaultOpen={false}
          options={[
            { value: 'zacharie', label: 'Zacharie' },
            { value: 'api', label: 'API' },
          ]}
          selected={creationContexts}
          onChange={(next) => setFilters({ creation_context: next })}
        />
        <CheckboxFilterSection
          title="Contenu"
          defaultOpen={false}
          options={[
            { value: 'avec', label: 'Avec carcasses' },
            { value: 'sans', label: 'Sans carcasse' },
          ]}
          selected={avecCarcasses}
          onChange={(next) => setFilters({ avec_carcasses: next })}
        />
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <AdminViews views={getFeiViews()} />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Fiches ({total})</h3>
          <div className="flex items-center gap-2">
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset === 0}
              onClick={() => setFilters({ page: offset - LIMIT > 0 ? String(offset / LIMIT) : null })}
            >
              Précédent
            </button>
            <span className="text-sm tabular-nums">
              {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
            </span>
            <button
              className="fr-btn fr-btn--sm fr-btn--secondary"
              disabled={offset + LIMIT >= total}
              onClick={() => setFilters({ page: String(offset / LIMIT + 2) })}
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
              <th className="p-1">destinataire</th>
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
                <td className="max-w-[240px] p-1">
                  {row.destinataires.length === 0
                    ? '—'
                    : row.destinataires.map((destinataire, index) => {
                        const label = formatDestinataire(destinataire);
                        const text =
                          row.destinataires.length > 1 ? `${label} (${destinataire.nb_carcasses})` : label;
                        return (
                          <div
                            key={index}
                            className="truncate"
                            title={text}
                          >
                            {text}
                          </div>
                        );
                      })}
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
