import { useEffect, useMemo, useRef, useState } from 'react';
import useZustandStore from '@app/zustand/store';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import TableFilterable from '@app/components/TableFilterable';
import { useSaveScroll } from '@app/services/useSaveScroll';
import { getCarcasseStatusLabel } from '@app/utils/get-carcasse-status';
import { Link, useSearchParams } from 'react-router';
import { loadCarcasses } from '@app/utils/load-carcasses';
import { UserRoles } from '@prisma/client';
import Filters from '@app/components/Filters';
import {
  CarcasseFilter,
  carcasseFilterableFields,
  filterCarcassesInRegistre,
} from '@app/utils/filter-carcasse';
import { useLocalStorage } from '@uidotdev/usehooks';
import Chargement from '@app/components/Chargement';
import Button from '@codegouvfr/react-dsfr/Button';
import useExportCarcasses from '@app/utils/export-carcasses';
const itemsPerPageOptions = [20, 50, 100, 200, 1000];

export default function RegistreCarcasses() {
  const user = useMostFreshUser('registre-carcasses')!;
  const isSvi = user.roles.includes(UserRoles.SVI);
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const [selectedCarcassesIds, setSelectedCarcassesIds] = useState<Array<string>>([]);
  const [loading, setLoading] = useState(true);

  const { onExportToXlsx, isExporting } = useExportCarcasses();

  const [searchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');

  const [sortBy, setSortBy] = useLocalStorage<keyof (typeof carcassesRegistry)[number]>(
    'registre-carcasses-sort-by',
    'numero_bracelet',
  );
  const [sortOrder, setSortOrder] = useLocalStorage<'ASC' | 'DESC'>('registre-carcasses-sort-order', 'ASC');

  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('registre-carcasses-items-per-page', 50);
  const [filters, setFilters] = useLocalStorage<Array<CarcasseFilter>>(
    'registre-carcasses-filters-preset',
    [],
  );

  const filterableFields = useMemo(() => {
    const motifs = new Set<string>();
    const etgNames = new Set<string>();
    const ccgNames = new Set<string>();
    for (const carcasse of carcassesRegistry) {
      for (const motif of carcasse.svi_ipm2_lesions_ou_motifs) {
        if (motif) {
          motifs.add(motif);
        }
      }
      if (carcasse.premier_detenteur_depot_entity_name_cache) {
        ccgNames.add(carcasse.premier_detenteur_depot_entity_name_cache);
      }
      if (isSvi) {
        if (carcasse.latest_intermediaire_name_cache) {
          etgNames.add(carcasse.latest_intermediaire_name_cache);
        }
      }
    }
    const sortedMotifs = Array.from(motifs).sort();
    const sortedEtgNames = Array.from(etgNames).sort();
    const sortedCcgNames = Array.from(ccgNames).sort();
    return carcasseFilterableFields(sortedMotifs, sortedEtgNames, sortedCcgNames);
  }, [carcassesRegistry, isSvi]);

  const filteredData = useMemo(() => {
    return carcassesRegistry
      .filter((carcasse) => filterCarcassesInRegistre(filters)(carcasse))
      .sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        if (!aValue) {
          if (bValue) return sortOrder === 'ASC' ? 1 : -1;
          return 0;
        }
        if (!bValue) {
          if (aValue) return sortOrder === 'ASC' ? -1 : 1;
          return 0;
        }
        if (aValue === bValue) return 0;
        if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
        return 0;
      });
  }, [carcassesRegistry, filters, sortBy, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredData.slice(start, end);
  }, [filteredData, page, itemsPerPage]);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'REGISTRE_CARCASSES_OPEN' });
    }
  }, [user]);

  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    let role = null;
    if (user.roles.includes(UserRoles.SVI)) role = UserRoles.SVI;
    else if (user.roles.includes(UserRoles.ETG)) role = UserRoles.ETG;
    else if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) role = UserRoles.COLLECTEUR_PRO;

    if (!role) {
      throw new Error('User has no role');
    }
    refreshUser('registre-carcasses')
      .then(() => setLoading(true))
      .then(() => loadCarcasses(role))
      .then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSaveScroll('registre-carcasses-scrollY');

  const renderMobileCarcasse = (carcasse: (typeof carcassesRegistry)[number], _index: number) => {
    const isChecked = selectedCarcassesIds.includes(carcasse.zacharie_carcasse_id);
    return (
      <tr
        key={carcasse.zacharie_carcasse_id}
        className={`border-b border-gray-200 ${isChecked ? 'bg-blue-50' : ''}`}
      >
        <td className="p-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="checked:accent-action-high-blue-france mt-1 border-2"
                checked={isChecked}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCarcassesIds([...selectedCarcassesIds, carcasse.zacharie_carcasse_id]);
                  } else {
                    setSelectedCarcassesIds(
                      selectedCarcassesIds.filter((id) => id !== carcasse.zacharie_carcasse_id),
                    );
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1">
                  <Link
                    to={`/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
                    className="font-semibold break-words text-blue-600 hover:underline"
                  >
                    {carcasse.numero_bracelet}
                  </Link>
                  <span className="text-xs text-gray-500">{carcasse.espece}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 pl-7 text-sm">
              <div>
                <span className="font-semibold">Premier détenteur: </span>
                <span>{carcasse.fei_premier_detenteur_name_cache || '-'}</span>
              </div>
              <div>
                <span className="font-semibold">Statut: </span>
                <span>{getCarcasseStatusLabel(carcasse)}</span>
              </div>
              <div>
                <span className="font-semibold">Date transmission SVI: </span>
                <span>
                  {carcasse.fei_svi_assigned_at
                    ? new Date(carcasse.fei_svi_assigned_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </span>
              </div>
              <div>
                <span className="font-semibold">Date décision: </span>
                <span>
                  {carcasse.svi_carcasse_status_set_at
                    ? new Date(carcasse.svi_carcasse_status_set_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </span>
              </div>
              <div>
                <span className="font-semibold">Archivé: </span>
                <span>{carcasse.svi_carcasse_archived ? 'Oui' : 'Non'}</span>
              </div>
              <div>
                <span className="font-semibold">Fiche: </span>
                <Link
                  to={`/app/tableau-de-bord/fei/${carcasse.fei_numero}`}
                  className="text-blue-600 hover:underline"
                >
                  {carcasse.fei_numero}
                </Link>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return <Chargement />;
  }

  return (
    <div className="fr-container--fluid fr-my-4 sm:fr-my-md-14v">
      <title>
        Registre de carcasses | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>

      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 p-2 sm:p-4">
          <h1 className="fr-h2 fr-container mx-auto mb-4 flex flex-col sm:mb-8">Registre des carcasses</h1>
          <section className="fr-container mb-4 overflow-x-auto bg-white p-2 sm:mb-6 sm:p-4">
            <Filters
              onChange={setFilters}
              base={filterableFields}
              filters={filters}
              saveInURLParams={false}
            />
          </section>
          <section className="mb-4 flex flex-col gap-4 sm:mb-0 sm:flex-row sm:justify-between">
            <div className="flex flex-col">
              <p className="mb-2 text-sm opacity-50 sm:mb-6">
                {filteredData.length !== carcassesRegistry.length ? (
                  <>
                    Nombre d'éléments filtrés: {filteredData.length}
                    <br />
                    (total: {carcassesRegistry.length})
                  </>
                ) : (
                  <>Total: {carcassesRegistry.length}</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-1 sm:gap-0">
                <span className="mr-2 text-sm opacity-50">Nombre d'éléments par page:</span>
                {itemsPerPageOptions.map((option) => {
                  return (
                    <button
                      className={[
                        'px-2 py-1 text-sm sm:px-4 sm:py-2',
                        itemsPerPage === option ? 'font-semibold underline' : '',
                      ].join(' ')}
                      onClick={() => setItemsPerPage(option)}
                      key={option}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-start gap-2 sm:justify-end">
              <Button
                onClick={() => {
                  const selectedCarcassesObject: Record<string, boolean> = {};
                  for (const carcasseId of selectedCarcassesIds) {
                    selectedCarcassesObject[carcasseId] = true;
                  }
                  onExportToXlsx(
                    filteredData.filter((carcasse) => selectedCarcassesObject[carcasse.zacharie_carcasse_id]),
                  );
                }}
                disabled={selectedCarcassesIds.length === 0 || isExporting}
                className="w-full sm:w-auto"
              >
                <span className="hidden sm:inline">
                  Télécharger un fichier Excel avec les carcasses sélectionnées ({selectedCarcassesIds.length}
                  )
                </span>
                <span className="sm:hidden">Exporter ({selectedCarcassesIds.length})</span>
              </Button>
            </div>
          </section>
          <section className="mb-4 overflow-x-auto bg-white sm:mb-6 md:shadow-sm">
            <TableFilterable
              data={paginatedData}
              rowKey="zacharie_carcasse_id"
              withCheckbox
              onCheck={setSelectedCarcassesIds}
              checked={selectedCarcassesIds}
              renderCellSmallDevices={renderMobileCarcasse}
              columns={[
                {
                  dataKey: 'zacharie_carcasse_id',
                  title: '',
                  small: true,
                  render: (_carcasse, index) => <>{(page - 1) * itemsPerPage + index + 1}</>,
                },
                {
                  dataKey: 'numero_bracelet',
                  title: 'Identification',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                  render: (carcasse) => {
                    return (
                      <div className="flex flex-col items-start">
                        <Link
                          to={`/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
                          className="mr-auto block"
                        >
                          {carcasse.numero_bracelet}
                        </Link>
                        <small className="text-xs text-gray-400">{carcasse.espece}</small>
                        {/* <span className="opacity-30 no-underline! text-xs italic">
                          ID Zacharie: {carcasse.zacharie_carcasse_id}
                        </span> */}
                      </div>
                    );
                  },
                },
                {
                  dataKey: 'fei_premier_detenteur_name_cache',
                  title: 'Premier détenteur',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                },
                {
                  dataKey: 'fei_svi_assigned_at',
                  title: 'Date de transmission au SVI',
                  type: 'datetime',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                },
                {
                  dataKey: 'svi_carcasse_status',
                  title: 'Statut',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                  render: (carcasse) => getCarcasseStatusLabel(carcasse),
                },
                {
                  dataKey: 'svi_carcasse_archived',
                  title: 'Archivé(e)',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                  render: (carcasse) => (carcasse.svi_carcasse_archived ? 'Oui' : 'Non'),
                },
                {
                  dataKey: 'svi_carcasse_status_set_at',
                  title: 'Date de décision',
                  type: 'datetime',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                },
                {
                  dataKey: 'fei_numero',
                  title: 'Numéro de fiche',
                  onSortOrder: setSortOrder,
                  onSortBy: setSortBy,
                  sortBy: sortBy,
                  sortOrder: sortOrder,
                  render: (carcasse) => (
                    <Link to={`/app/tableau-de-bord/fei/${carcasse.fei_numero}`}>{carcasse.fei_numero}</Link>
                  ),
                },
              ]}
              // onSort={() => {}}
              // onCheck={() => {}}
            />
            <div className="flex justify-center overflow-x-auto py-4 sm:justify-start sm:py-6">
              <Pagination
                className="mt-4 flex justify-center sm:mt-6 sm:justify-start"
                count={Math.ceil(filteredData.length / itemsPerPage)}
                defaultPage={page}
                getPageLinkProps={(pageNumber) => {
                  return {
                    to: `/app/tableau-de-bord/registre-carcasses?page=${pageNumber}`,
                  };
                }}
              />
              {/* <Select
                label="Nombre d'éléments par page"
                nativeSelectProps={{
                  onChange: (event) => setItemsPerPage(parseInt(event.target.value)),
                  value: itemsPerPage,
                }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="1000">1000</option>
              </Select> */}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
