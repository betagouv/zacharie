import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CarcasseStatus, CarcasseType } from '@prisma/client';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import DateRangeFilterSection from '@app/components/DateRangeFilterSection';
import type { AdminCarcassesResponse, AdminCarcassesFilterOptionsResponse } from '@api/src/types/responses';
import dayjs from 'dayjs';

type CarcasseRow = AdminCarcassesResponse['data']['carcasses'][number];
type FilterOptions = AdminCarcassesFilterOptionsResponse['data'];

const emptyFilterOptions: FilterOptions = {
  especes: [],
  svis: [],
  etgs: [],
  collecteurs: [],
  premiersDetenteurs: [],
  examinateurs: [],
};

// Libellés repris de `mapCarcasseStatusLabelToValue` (@app/utils/filter-carcasse).
const statusLabels: Record<CarcasseStatus, string> = {
  [CarcasseStatus.REFUS_ETG_COLLECTEUR]: 'Refusée par l’ETG ou le collecteur',
  [CarcasseStatus.MANQUANTE_ETG_COLLECTEUR]: 'Manquante pour l’ETG ou le collecteur',
  [CarcasseStatus.MANQUANTE_SVI]: 'Manquante',
  [CarcasseStatus.TRAITEMENT_ASSAINISSANT]: 'En traitement assainissant',
  [CarcasseStatus.SAISIE_TOTALE]: 'Saisie totale',
  [CarcasseStatus.SAISIE_PARTIELLE]: 'Saisie partielle',
  [CarcasseStatus.LEVEE_DE_CONSIGNE]: 'Levée de consigne',
  [CarcasseStatus.CONSIGNE]: 'Consigné(e)',
  [CarcasseStatus.ACCEPTE]: 'Accepté(e)',
  [CarcasseStatus.SANS_DECISION]: 'Sans décision',
};

const statusColors: Record<CarcasseStatus, string> = {
  [CarcasseStatus.REFUS_ETG_COLLECTEUR]: 'bg-red-100 text-red-800',
  [CarcasseStatus.MANQUANTE_ETG_COLLECTEUR]: 'bg-orange-100 text-orange-800',
  [CarcasseStatus.MANQUANTE_SVI]: 'bg-orange-100 text-orange-800',
  [CarcasseStatus.TRAITEMENT_ASSAINISSANT]: 'bg-blue-100 text-blue-800',
  [CarcasseStatus.SAISIE_TOTALE]: 'bg-red-200 text-red-900',
  [CarcasseStatus.SAISIE_PARTIELLE]: 'bg-red-100 text-red-800',
  [CarcasseStatus.LEVEE_DE_CONSIGNE]: 'bg-blue-100 text-blue-800',
  [CarcasseStatus.CONSIGNE]: 'bg-yellow-100 text-yellow-800',
  [CarcasseStatus.ACCEPTE]: 'bg-green-100 text-green-800',
  [CarcasseStatus.SANS_DECISION]: 'bg-gray-100 text-gray-800',
};

const typeLabels: Record<CarcasseType, string> = {
  [CarcasseType.GROS_GIBIER]: 'Grand gibier',
  [CarcasseType.PETIT_GIBIER]: 'Petit gibier',
};

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
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [especes, setEspeces] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [svis, setSvis] = useState<string[]>([]);
  const [etgs, setEtgs] = useState<string[]>([]);
  const [collecteurs, setCollecteurs] = useState<string[]>([]);
  const [premiersDetenteurs, setPremiersDetenteurs] = useState<string[]>([]);
  const [examinateurs, setExaminateurs] = useState<string[]>([]);
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
    API.get({ path: 'admin/carcasses/filter-options' })
      .then((res) => res as AdminCarcassesFilterOptionsResponse)
      .then((res) => {
        if (res.ok) setFilterOptions(res.data);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const query: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (debouncedSearch) query.search = debouncedSearch;
    if (statuts.length) query.statuts = statuts.join(',');
    if (especes.length) query.especes = especes.join(',');
    if (types.length) query.types = types.join(',');
    if (svis.length) query.svi_ids = svis.join(',');
    if (etgs.length) query.etg_ids = etgs.join(',');
    if (collecteurs.length) query.collecteur_ids = collecteurs.join(',');
    if (premiersDetenteurs.length) query.premier_detenteur_ids = premiersDetenteurs.join(',');
    if (examinateurs.length) query.examinateur_ids = examinateurs.join(',');
    if (dateMiseAMortFrom) query.date_mise_a_mort_from = dateMiseAMortFrom;
    if (dateMiseAMortTo) query.date_mise_a_mort_to = dateMiseAMortTo;
    if (dateCreationFrom) query.created_at_from = dateCreationFrom;
    if (dateCreationTo) query.created_at_to = dateCreationTo;
    API.get({ path: 'admin/carcasses', query })
      .then((res) => res as AdminCarcassesResponse)
      .then((res) => {
        if (res.ok) {
          setRows(res.data.carcasses);
          setTotal(res.data.total);
        }
      })
      .finally(() => setLoading(false));
  }, [
    offset,
    debouncedSearch,
    statuts,
    especes,
    types,
    svis,
    etgs,
    collecteurs,
    premiersDetenteurs,
    examinateurs,
    dateMiseAMortFrom,
    dateMiseAMortTo,
    dateCreationFrom,
    dateCreationTo,
  ]);

  const activeFilterCount =
    (search ? 1 : 0) +
    statuts.length +
    especes.length +
    types.length +
    svis.length +
    etgs.length +
    collecteurs.length +
    premiersDetenteurs.length +
    examinateurs.length +
    (dateMiseAMortFrom ? 1 : 0) +
    (dateMiseAMortTo ? 1 : 0) +
    (dateCreationFrom ? 1 : 0) +
    (dateCreationTo ? 1 : 0);

  // Chaque section remet la pagination à zéro : sinon on reste sur un offset qui
  // n'existe plus dans le nouveau jeu de résultats.
  const onFilterChange = (setter: (next: string[]) => void) => (next: string[]) => {
    setter(next);
    setOffset(0);
  };

  if (loading && rows.length === 0) {
    return <Chargement />;
  }

  return (
    <div className="md:-ml-4 md:flex">
      <FiltersSidebar
        storageKey="admin-carcasses-filters"
        activeFilterCount={activeFilterCount}
        onReset={() => {
          setSearch('');
          setStatuts([]);
          setEspeces([]);
          setTypes([]);
          setSvis([]);
          setEtgs([]);
          setCollecteurs([]);
          setPremiersDetenteurs([]);
          setExaminateurs([]);
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
        <CheckboxFilterSection
          title="Statut"
          scroll
          options={Object.values(CarcasseStatus).map((status) => ({
            value: status,
            label: statusLabels[status],
          }))}
          selected={statuts}
          onChange={onFilterChange(setStatuts)}
        />
        <CheckboxFilterSection
          title="Espèce"
          scroll
          options={filterOptions.especes.map((option) => ({ value: option.id, label: option.label }))}
          selected={especes}
          onChange={onFilterChange(setEspeces)}
        />
        <CheckboxFilterSection
          title="Type"
          options={Object.values(CarcasseType).map((type) => ({
            value: type,
            label: typeLabels[type],
          }))}
          selected={types}
          onChange={onFilterChange(setTypes)}
        />
        <CheckboxFilterSection
          title="SVI"
          scroll
          defaultOpen={false}
          options={filterOptions.svis.map((option) => ({ value: option.id, label: option.label }))}
          selected={svis}
          onChange={onFilterChange(setSvis)}
        />
        <CheckboxFilterSection
          title="ETG"
          scroll
          defaultOpen={false}
          options={filterOptions.etgs.map((option) => ({ value: option.id, label: option.label }))}
          selected={etgs}
          onChange={onFilterChange(setEtgs)}
        />
        <CheckboxFilterSection
          title="Collecteur"
          scroll
          defaultOpen={false}
          options={filterOptions.collecteurs.map((option) => ({ value: option.id, label: option.label }))}
          selected={collecteurs}
          onChange={onFilterChange(setCollecteurs)}
        />
        <CheckboxFilterSection
          title="Premier détenteur"
          scroll
          defaultOpen={false}
          options={filterOptions.premiersDetenteurs.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          selected={premiersDetenteurs}
          onChange={onFilterChange(setPremiersDetenteurs)}
        />
        <CheckboxFilterSection
          title="Examinateur"
          scroll
          defaultOpen={false}
          options={filterOptions.examinateurs.map((option) => ({ value: option.id, label: option.label }))}
          selected={examinateurs}
          onChange={onFilterChange(setExaminateurs)}
        />
        <DateRangeFilterSection
          title="Date de mise à mort"
          defaultOpen={false}
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
      </FiltersSidebar>
      <div className="min-w-0 flex-1 py-4 md:px-4">
        <div className="mb-4 flex items-center justify-between">
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
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-1">marquage</th>
              <th className="p-1">espèce</th>
              <th className="p-1">type</th>
              <th className="p-1">statut</th>
              <th className="p-1">fei_numero</th>
              <th className="p-1">nb intermédiaires</th>
              <th className="p-1">created_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.zacharie_carcasse_id}
                className={`border-b hover:bg-blue-50 ${row.deleted_at ? 'text-gray-400 line-through' : ''}`}
              >
                <td className="p-1">
                  <Link
                    to={`/app/admin/carcasse/${encodeURIComponent(row.zacharie_carcasse_id)}`}
                    className={row.deleted_at ? 'text-gray-400 underline' : 'text-blue-600 underline'}
                  >
                    {row.numero_bracelet}
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
                <td className="p-1">{row.espece}</td>
                <td className="p-1">{row.type ? typeLabels[row.type] : '—'}</td>
                <td className="p-1">
                  {row.svi_carcasse_status ? (
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColors[row.svi_carcasse_status]}`}
                    >
                      {statusLabels[row.svi_carcasse_status]}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td
                  className="max-w-[120px] truncate p-1"
                  title={row.fei_numero}
                >
                  {row.fei_numero}
                </td>
                <td className="p-1">{row._count.CarcasseIntermediaire}</td>
                <td className="p-1">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
