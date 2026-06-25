import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import dayjs from 'dayjs';
import { CarcasseType, DepotType, FeiOwnerRole } from '@prisma/client';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import FichesEmptyState from '@app/components/FichesEmptyState';
import { UserConnexionResponse } from '@api/src/types/responses';
import { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { abbreviations } from '@app/utils/count-carcasses';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getSaisonStartYear, getSaisonLabel, isDateInSaison } from '@app/utils/get-saison';
import ExportTransmissionsModal from '@app/components/ExportTransmissionsModal';
import { filterCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CarcassesEspeceSummary from '@app/components/CarcassesEspeceSummary';
import { getPreviousDetenteur } from '@app/utils/get-previous-detenteur-from-transmission';
import CollapsibleSection from '@app/components/CollapsibleSection';
import { useLoaderEffect, loadData } from '@app/utils/load-data';
import Chargement from '@app/components/Chargement';
import { useTransmissionsSorted } from '@app/utils/get-transmissions-sorted';
import { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import CardTransmission from '@app/components/CardTransmission';
import { useEntitiesIdsWorkingDirectlyForObj } from '@app/utils/get-entity-relations';
import { getTransmissionLink, getTransmissionIdFromMetadata } from '@app/utils/get-transmission-id';

type ViewType = 'grid' | 'table';

type TransmissionIdSelection = Array<string>;

const statusColors: Record<TransmissionSimpleStatus, { bg: string; text: string }> = {
  'À compléter': {
    bg: 'bg-[#FEE7FC]',
    text: 'text-[#6E445A]',
  },
  'En cours': {
    bg: 'bg-[#FFECBD]',
    text: 'text-[#73603F]',
  },
  Clôturée: {
    bg: 'bg-[#E8EDFF]',
    text: 'text-[#01008B]',
  },
};

const ITEMS_PER_PAGE = 100;

export default function EtgFiches() {
  const user = useMostFreshUser('etg-fiches')!;
  const { transmissionsEnCours, transmissionsACompleter, transmissionsCloturees } = useTransmissionsSorted();
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);
  const usersById = useZustandStore((state) => state.users);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    window.onNativePushToken = async function handleNativePushToken(token) {
      const response = await API.post({
        path: `/user/${user.id}`,
        body: { native_push_token: token },
      }).then((response) => response as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    };
    let timeoutId = setTimeout(() => {
      // if user is activated already, either we just take the latest token,
      // either it's a web user that just installed the app so we need to ask for permission for notifications
      if (user.activated_at) {
        window.ReactNativeWebView?.postMessage('request-native-expo-push-permission');
      }
      clearTimeout(timeoutId);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TABLEAU_DE_BORD_OPEN' });
    }
  }, [user]);

  useLoaderEffect(() => {
    loadData('etg-fiches').then(() => setIsLoading(false));
  });

  useSaveScroll('etg-fiches-scrollY');

  const [selectedTransmissions, setSelectedTransmissions] = useState<TransmissionIdSelection>([]);
  const handleCheckboxClick = (id: string) => {
    setSelectedTransmissions((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fei) => fei !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = (visibleFeis?: string[]) => {
    const feisToToggle = visibleFeis || [];
    const allSelected = feisToToggle.every((numero) => selectedTransmissions.includes(numero));
    if (allSelected) {
      // Désélectionner toutes les fiches visibles
      setSelectedTransmissions((prev) => prev.filter((numero) => !feisToToggle.includes(numero)));
    } else {
      // Sélectionner toutes les fiches visibles
      setSelectedTransmissions((prev) => {
        const newSelection = [...prev];
        feisToToggle.forEach((numero) => {
          if (!newSelection.includes(numero)) {
            newSelection.push(numero);
          }
        });
        return newSelection;
      });
    }
  };

  const [filterStatuses, setFilterStatuses] = useState<TransmissionSimpleStatus[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-statuses');
      if (saved) return JSON.parse(saved) as TransmissionSimpleStatus[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-statuses', JSON.stringify(filterStatuses));
  }, [filterStatuses]);

  const [viewType, setViewType] = useState<ViewType>(() => {
    const savedViewType = localStorage.getItem('etg-fiches-view-type');
    if (savedViewType === 'grid' || savedViewType === 'table') {
      return savedViewType as ViewType;
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-view-type', viewType);
  }, [viewType]);

  const [filterPremierDetenteurs, setFilterPremierDetenteurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-premier-detenteurs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-premier-detenteurs', JSON.stringify(filterPremierDetenteurs));
  }, [filterPremierDetenteurs]);

  const [filterSaisons, setFilterSaisons] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-saisons');
      if (saved) return JSON.parse(saved) as number[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-saisons', JSON.stringify(filterSaisons));
  }, [filterSaisons]);

  const [filterDateFrom, setFilterDateFrom] = useState<string>(
    () => localStorage.getItem('etg-fiches-filter-date-from') || ''
  );
  const [filterDateTo, setFilterDateTo] = useState<string>(
    () => localStorage.getItem('etg-fiches-filter-date-to') || ''
  );

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-date-from', filterDateFrom);
  }, [filterDateFrom]);

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-date-to', filterDateTo);
  }, [filterDateTo]);

  const [filterCCGs, setFilterCCGs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-ccgs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-ccgs', JSON.stringify(filterCCGs));
  }, [filterCCGs]);

  const [filterCollecteurs, setFilterCollecteurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-collecteurs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('etg-fiches-filter-collecteurs', JSON.stringify(filterCollecteurs));
  }, [filterCollecteurs]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtersKey = `${filterStatuses.join(',')}|${filterPremierDetenteurs.join(',')}|${filterCCGs.join(',')}|${filterCollecteurs.join(',')}|${filterSaisons.join(',')}|${filterDateFrom}|${filterDateTo}|${searchQuery}`;
  // on réinitialise la page seulement quand les filtres changent vraiment :
  // setSearchParams change d'identité à chaque navigation (react-router), donc on
  // compare la valeur précédente de filtersKey plutôt que de garder le 1er render.
  const prevFiltersKey = useRef(filtersKey);
  useEffect(() => {
    if (prevFiltersKey.current === filtersKey) return;
    prevFiltersKey.current = filtersKey;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [filtersKey, setSearchParams]);

  const allTransmissions = useMemo(() => {
    return [...transmissionsACompleter, ...transmissionsEnCours, ...transmissionsCloturees];
  }, [transmissionsACompleter, transmissionsEnCours, transmissionsCloturees]);

  const premierDetenteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const transmission of allTransmissions) {
      const id =
        transmission.content.premier_detenteur_entity_id || transmission.content.premier_detenteur_user_id;
      const name = transmission.content.premier_detenteur_name_cache;
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTransmissions]);

  const ccgOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const transmission of allTransmissions) {
      if (
        transmission.content.premier_detenteur_depot_type === DepotType.CCG &&
        transmission.content.premier_detenteur_depot_entity_id
      ) {
        const id = transmission.content.premier_detenteur_depot_entity_id;
        const name = transmission.content.premier_detenteur_depot_entity_name_cache || id;
        if (!map.has(id)) {
          map.set(id, name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTransmissions]);

  const intermediairesByFei = useMemo(() => {
    const seen: Record<string, Record<string, CarcassesIntermediaire>> = {};
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at) continue;
      if (!seen[ci.fei_numero]) seen[ci.fei_numero] = {};
      if (seen[ci.fei_numero][ci.intermediaire_id]) continue;
      seen[ci.fei_numero][ci.intermediaire_id] = {
        id: ci.intermediaire_id,
        fei_numero: ci.fei_numero,
        intermediaire_user_id: ci.intermediaire_user_id,
        intermediaire_entity_id: ci.intermediaire_entity_id,
        intermediaire_role: ci.intermediaire_role,
        created_at: ci.created_at,
        prise_en_charge_at: ci.prise_en_charge_at,
        intermediaire_depot_type: ci.intermediaire_depot_type,
        intermediaire_depot_entity_id: ci.intermediaire_depot_entity_id,
        intermediaire_prochain_detenteur_role_cache: ci.intermediaire_prochain_detenteur_role_cache,
        intermediaire_prochain_detenteur_id_cache: ci.intermediaire_prochain_detenteur_id_cache,
      };
    }
    const result: Record<string, CarcassesIntermediaire[]> = {};
    for (const fei_numero of Object.keys(seen)) {
      result[fei_numero] = Object.values(seen[fei_numero]).sort((a, b) =>
        dayjs(a.created_at).diff(b.created_at) < 0 ? 1 : -1
      );
    }
    return result;
  }, [carcassesIntermediaireById]);

  const feiCollecteurIdsByFeiNumero = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const transmission of allTransmissions) {
      const intermediaires = intermediairesByFei[transmission.fei.numero!] ?? [];
      const ids: string[] = [];
      for (const inter of intermediaires) {
        if (inter.intermediaire_role !== FeiOwnerRole.COLLECTEUR_PRO) continue;
        const id = inter.intermediaire_entity_id || inter.intermediaire_user_id;
        if (id && !ids.includes(id)) ids.push(id);
      }
      result[transmission.fei.numero!] = ids;
    }
    return result;
  }, [allTransmissions, intermediairesByFei]);

  const collecteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ids of Object.values(feiCollecteurIdsByFeiNumero)) {
      for (const id of ids) {
        if (map.has(id)) continue;
        const entity = entities[id];
        const userOnly = usersById[id];
        const name =
          entity?.nom_d_usage ||
          entity?.raison_sociale ||
          (userOnly ? `${userOnly.prenom ?? ''} ${userOnly.nom_de_famille ?? ''}`.trim() : '') ||
          id;
        map.set(id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [feiCollecteurIdsByFeiNumero, entities, usersById]);

  const saisonOptions = useMemo(() => {
    const years = new Set<number>();
    for (const transmission of allTransmissions) {
      if (transmission.content.date_mise_a_mort)
        years.add(getSaisonStartYear(transmission.content.date_mise_a_mort));
    }
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ year, label: getSaisonLabel(year) }));
  }, [allTransmissions]);

  const [filteredTransmissions, filteredCarcasses] = useMemo(() => {
    let transmissions = [];
    let carcasses: CarcasseTransmissionWihMetadata['carcasses'] = [];
    let q = searchQuery.trim() ? searchQuery.trim().toLowerCase() : undefined;
    for (const transmission of allTransmissions) {
      if (q) {
        let isIncluded = false;
        if (transmission.fei.numero!.toLowerCase().includes(q)) isIncluded = true;
        if (transmission.fei.commune_mise_a_mort) {
          if (transmission.fei.commune_mise_a_mort.toLowerCase().includes(q)) isIncluded = true;
        }
        if (transmission.content.premier_detenteur_name_cache) {
          if (transmission.content.premier_detenteur_name_cache.toLowerCase().includes(q)) isIncluded = true;
        }
        if (!isIncluded) continue;
      }
      if (filterStatuses.length > 0) {
        if (!filterStatuses.includes(transmission.labels.simpleStatus)) continue;
      }
      if (filterPremierDetenteurs.length > 0) {
        if (
          !filterPremierDetenteurs.includes(transmission.content.premier_detenteur_user_id ?? '') &&
          !filterPremierDetenteurs.includes(transmission.content.premier_detenteur_entity_id ?? '')
        )
          continue;
      }
      if (filterCCGs.length > 0) {
        if (!filterCCGs.includes(transmission.content.premier_detenteur_depot_entity_id ?? '')) continue;
      }
      if (filterCollecteurs.length > 0) {
        let isIncluded = false;
        for (const collecteurId of feiCollecteurIdsByFeiNumero[transmission.fei.numero]) {
          if (filterCollecteurs.includes(collecteurId)) {
            isIncluded = true;
            break;
          }
        }
        if (!isIncluded) continue;
      }
      if (filterSaisons.length > 0) {
        if (!transmission.fei.date_mise_a_mort) continue;
        let isIncluded = false;
        for (const saison of filterSaisons) {
          if (isDateInSaison(transmission.content.date_mise_a_mort!, saison)) {
            isIncluded = true;
            break;
          }
        }
        if (!isIncluded) continue;
      }
      if (filterDateFrom || filterDateTo) {
        if (!transmission.fei.date_mise_a_mort) continue;
        const d = dayjs(transmission.fei.date_mise_a_mort).format('YYYY-MM-DD');
        if (filterDateFrom && d < filterDateFrom) continue;
        if (filterDateTo && d > filterDateTo) continue;
      }
      transmissions.push(transmission);
      carcasses.push(...transmission.carcasses);
    }
    return [transmissions, carcasses];
  }, [
    allTransmissions,
    searchQuery,
    filterStatuses,
    filterPremierDetenteurs,
    filterCCGs,
    filterCollecteurs,
    filterSaisons,
    filterDateFrom,
    filterDateTo,
    feiCollecteurIdsByFeiNumero,
  ]);

  const totalPages = Math.ceil(filteredTransmissions.length / ITEMS_PER_PAGE);
  const paginatedTransmissions = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredTransmissions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransmissions, page]);

  const hasActiveFilters =
    filterStatuses.length > 0 ||
    filterPremierDetenteurs.length > 0 ||
    filterCCGs.length > 0 ||
    filterCollecteurs.length > 0 ||
    filterSaisons.length > 0 ||
    filterDateFrom.length > 0 ||
    filterDateTo.length > 0 ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setFilterStatuses([]);
    setFilterPremierDetenteurs([]);
    setFilterCCGs([]);
    setFilterCollecteurs([]);
    setFilterSaisons([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
  };

  const sidebarContent = (
    <>
      {/* Recherche */}
      <div className="relative">
        <span
          className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher une fiche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Compteur */}
      <div className="mt-2 flex items-center justify-between border-b border-gray-200 pb-3">
        <span className="text-sm font-medium text-gray-600">
          {filteredTransmissions.length} fiche{filteredTransmissions.length > 1 ? 's' : ''}
        </span>
        {hasActiveFilters && (
          <button
            className="text-action-high-blue-france text-xs underline"
            onClick={clearAllFilters}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Filtre Statut */}
      <CollapsibleSection
        title="Statut"
        defaultOpen={false}
        badge={
          filterStatuses.length > 0 ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              {filterStatuses.length}
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-1.5">
          {(['À compléter', 'En cours', 'Clôturée'] as TransmissionSimpleStatus[]).map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={filterStatuses.includes(status)}
                className="checked:accent-action-high-blue-france h-4 w-4"
                onChange={() => {
                  if (filterStatuses.includes(status)) {
                    setFilterStatuses(filterStatuses.filter((s) => s !== status));
                  } else {
                    setFilterStatuses([...filterStatuses, status]);
                  }
                }}
              />
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusColors[status].bg} ${statusColors[status].text}`}
              >
                {status}
              </span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Filtre Saison */}
      {saisonOptions.length > 0 && (
        <CollapsibleSection
          title="Saison"
          defaultOpen={false}
          badge={
            filterSaisons.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterSaisons.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {saisonOptions.map((option) => (
              <label
                key={option.year}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterSaisons.includes(option.year)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (filterSaisons.includes(option.year)) {
                      setFilterSaisons(filterSaisons.filter((v) => v !== option.year));
                    } else {
                      setFilterSaisons([...filterSaisons, option.year]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Filtre Date de mise à mort */}
      <CollapsibleSection
        title="Date de mise à mort"
        defaultOpen={false}
        badge={
          filterDateFrom || filterDateTo ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">1</span>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700">Du</span>
            <input
              type="date"
              value={filterDateFrom}
              max={filterDateTo || undefined}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700">Au</span>
            <input
              type="date"
              value={filterDateTo}
              min={filterDateFrom || undefined}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
        </div>
      </CollapsibleSection>

      {/* Filtre Premier détenteur */}
      {premierDetenteurOptions.length > 1 && (
        <CollapsibleSection
          title="Premier détenteur"
          defaultOpen={false}
          badge={
            filterPremierDetenteurs.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterPremierDetenteurs.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {premierDetenteurOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterPremierDetenteurs.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (filterPremierDetenteurs.includes(option.id)) {
                      setFilterPremierDetenteurs(filterPremierDetenteurs.filter((v) => v !== option.id));
                    } else {
                      setFilterPremierDetenteurs([...filterPremierDetenteurs, option.id]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Filtre CCG */}
      {ccgOptions.length > 1 && (
        <CollapsibleSection
          title="Centre de collecte (CCG)"
          defaultOpen={false}
          badge={
            filterCCGs.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterCCGs.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {ccgOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterCCGs.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (filterCCGs.includes(option.id)) {
                      setFilterCCGs(filterCCGs.filter((v) => v !== option.id));
                    } else {
                      setFilterCCGs([...filterCCGs, option.id]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Filtre Collecteur */}
      {collecteurOptions.length > 1 && (
        <CollapsibleSection
          title="Collecteur"
          defaultOpen={false}
          badge={
            filterCollecteurs.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterCollecteurs.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {collecteurOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterCollecteurs.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (filterCollecteurs.includes(option.id)) {
                      setFilterCollecteurs(filterCollecteurs.filter((v) => v !== option.id));
                    } else {
                      setFilterCollecteurs([...filterCollecteurs, option.id]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </>
  );

  if (isLoading) {
    return <Chargement />;
  }

  return (
    <div className="relative">
      <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>

      {/* Mobile : bouton filtres sticky */}
      <div className="fr-background-alt--blue-france sticky top-0 z-30 flex items-center justify-between px-4 py-2 md:hidden">
        <span className="text-sm font-medium">
          {filteredTransmissions.length} fiche{filteredTransmissions.length > 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={viewType === 'grid' ? 'Afficher en table' : 'Afficher en grille'}
            title={viewType === 'grid' ? 'Afficher en table' : 'Afficher en grille'}
            className="h- flex w-10 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50"
            onClick={() => setViewType(viewType === 'grid' ? 'table' : 'grid')}
          >
            <span
              className={`fr-icon--sm ${viewType === 'grid' ? 'ri-table-line' : 'ri-grid-line'}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label="Filtres"
            className="relative flex h-10 items-center gap-1 rounded border border-gray-300 bg-white px-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <span
              className="fr-icon--sm ri-filter-3-line"
              aria-hidden="true"
            />
            <span>Filtres</span>
            {hasActiveFilters && (
              <span className="bg-action-high-blue-france ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
                {filterStatuses.length +
                  filterPremierDetenteurs.length +
                  filterCCGs.length +
                  filterCollecteurs.length +
                  filterSaisons.length +
                  (filterDateFrom || filterDateTo ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile : panneau filtres */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-[800] md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filtres</h2>
              <button
                className="text-action-high-blue-france text-sm underline"
                onClick={() => setShowMobileFilters(false)}
              >
                Fermer
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Layout principal */}
      <div className="flex">
        {/* Sidebar gauche - desktop, collée au bord */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 md:block">
          {sidebarContent}
        </aside>

        {/* Contenu principal */}
        <div className="mx-auto max-w-5xl min-w-0 flex-1 px-4 pt-4 md:px-6">
          {filteredTransmissions.length > 0 && (
            <div className="hidden w-full flex-wrap items-center justify-end gap-3 py-4 md:flex">
              <SegmentedControl
                hideLegend
                className="hidden bg-white md:block"
                segments={[
                  {
                    label: 'Grille',
                    iconId: 'ri-grid-line',
                    nativeInputProps: {
                      checked: viewType === 'grid',
                      onChange: () => setViewType('grid'),
                      name: 'view-type',
                      value: 'grid',
                    },
                  },
                  {
                    label: 'Table',
                    iconId: 'ri-table-line',
                    nativeInputProps: {
                      checked: viewType === 'table',
                      onChange: () => setViewType('table'),
                      name: 'view-type',
                      value: 'table',
                    },
                  },
                ]}
              />
              <div className="hidden md:block">
                <ExportTransmissionsModal
                  transmissionsIds={selectedTransmissions}
                  storageKey="etg-fiches-export-columns"
                />
              </div>
            </div>
          )}
          {filteredTransmissions.length > 0 && (
            <CarcassesEspeceSummary
              carcasses={filteredCarcasses}
              storageKey="etg-fiches-espece-summary-open"
            />
          )}
          <FeisWrapper
            viewType={viewType}
            handleSelectAll={handleSelectAll}
            selectedTransmissions={selectedTransmissions}
            filter={'Toutes les fiches'}
            paginatedTransmissions={paginatedTransmissions}
            handleCheckboxClick={handleCheckboxClick}
            hasActiveFilters={hasActiveFilters}
            clearAllFilters={clearAllFilters}
          />
          {filteredTransmissions.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                count={totalPages}
                defaultPage={page}
                getPageLinkProps={(pageNumber) => ({
                  to: `/app/etg?page=${pageNumber}`,
                })}
              />
            </div>
          )}
          <div className="my-4">
            <a
              className="fr-link fr-icon-arrow-up-fill fr-link--icon-left"
              href="#top"
            >
              Haut de page
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeisWrapper({
  paginatedTransmissions,
  viewType,
  handleSelectAll,
  handleCheckboxClick,
  selectedTransmissions,
  filter,
  hasActiveFilters,
  clearAllFilters,
}: {
  paginatedTransmissions: Array<CarcasseTransmissionWihMetadata>;
  viewType: 'grid' | 'table';
  handleSelectAll: (visibleFeis?: string[]) => void;
  handleCheckboxClick: (feiNumber: string, selected: boolean) => void;
  selectedTransmissions: TransmissionIdSelection;
  filter?: TransmissionSimpleStatus | 'Toutes les fiches';
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
}) {
  const nothingToShow = paginatedTransmissions.length === 0;
  const usersById = useZustandStore((state) => state.users);
  const entitiesWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyForObj();
  const myUserId = useUser((state) => state.user?.id);

  if (nothingToShow) {
    if (hasActiveFilters) {
      return (
        <FichesEmptyState
          iconId="fr-icon-search-line"
          title="Aucune fiche ne correspond à vos filtres"
          description="Modifiez ou réinitialisez vos filtres pour retrouver vos fiches."
          action={
            <Button
              priority="secondary"
              iconId="fr-icon-refresh-line"
              onClick={clearAllFilters}
            >
              Réinitialiser les filtres
            </Button>
          }
        />
      );
    }
    return (
      <FichesEmptyState
        title="Pas encore de fiches cette saison"
        description="Vos fiches apparaîtront ici dès qu'une fiche vous sera attribuée."
      />
    );
  }

  if (viewType === 'table') {
    return (
      <FeisTable
        handleSelectAll={handleSelectAll}
        selectedTransmissions={selectedTransmissions}
        filter={filter as TransmissionSimpleStatus | 'Toutes les fiches'}
        handleCheckboxClick={handleCheckboxClick}
        paginatedTransmissions={paginatedTransmissions}
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 justify-self-end sm:grid-cols-2 lg:grid-cols-3">
      {paginatedTransmissions.map((transmission) => {
        if (!transmission) return null;
        const detenteurPrecedent = getPreviousDetenteur(
          transmission,
          usersById,
          entitiesWorkingDirectlyFor,
          myUserId!
        );
        return (
          <CardTransmission
            key={getTransmissionIdFromMetadata(transmission)}
            transmission={transmission}
            filter={'Toutes les fiches'}
            onPrintSelect={handleCheckboxClick}
            isPrintSelected={selectedTransmissions.includes(getTransmissionIdFromMetadata(transmission))}
            linkTo={`/app/etg/fei/${getTransmissionLink(transmission)}`}
            detenteurName={detenteurPrecedent.name}
            detenteurIcon={detenteurPrecedent.icon}
          />
        );
      })}
    </div>
  );
}

function FeisTableRow({
  transmission,
  isSelected,
  onPrintSelect,
  navigate,
  filter,
  onVisibilityChange,
}: {
  transmission: CarcasseTransmissionWihMetadata;
  isSelected: boolean;
  onPrintSelect?: (feiNumber: string, selected: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  filter?: TransmissionSimpleStatus | 'Toutes les fiches';
  onVisibilityChange?: (feiNumero: string, isVisible: boolean) => void;
}) {
  const simpleStatus = transmission.labels.simpleStatus;
  const currentStepLabelShort = null;
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  // Notifier le parent de la visibilité de cette ligne
  useEffect(() => {
    const isVisible = !filter || filter === 'Toutes les fiches' || filter === simpleStatus;
    onVisibilityChange?.(getTransmissionIdFromMetadata(transmission), isVisible);
  }, [filter, simpleStatus, transmission.fei.numero, onVisibilityChange]);

  const [formattedCarcassesAcceptées, _carcassesOuLotsRefusés] = useMemo(() => {
    const formatted = formatCountCarcasseByEspece(transmission.carcasses) as string[];
    const _carcassesAcceptées: string[] = [];
    let _carcassesOuLotsRefusés = '';
    for (const line of formatted) {
      if (line.includes('refusé')) {
        _carcassesOuLotsRefusés = line.split(' (')[0];
      } else {
        // Enrichir les carcasses acceptées pour afficher le nombre accepté pour le petit gibier
        let enrichedLine = line;
        for (const [espece, abbreviation] of Object.entries(abbreviations)) {
          if (line.toLowerCase().includes(abbreviation.toLowerCase())) {
            const carcasse = transmission.carcasses.find(
              (c) => c?.type === CarcasseType.PETIT_GIBIER && c.espece === espece
            );
            if (carcasse) {
              const nombreDAnimaux = carcasse.nombre_d_animaux ?? 0;
              const intermediaires = filterCarcassesIntermediairesForCarcasse(
                carcassesIntermediaireById,
                carcasse.zacharie_carcasse_id!
              );
              const latestIntermediaire = intermediaires[0];
              const nombreDAnimauxAcceptes = latestIntermediaire?.nombre_d_animaux_acceptes ?? 0;
              if (nombreDAnimaux > 1 && nombreDAnimauxAcceptes > 0) {
                enrichedLine = `${nombreDAnimauxAcceptes} sur ${nombreDAnimaux} ${abbreviation}`;
              }
            }
            break;
          }
        }
        _carcassesAcceptées.push(enrichedLine);
      }
    }
    return [_carcassesAcceptées, _carcassesOuLotsRefusés];
  }, [transmission.carcasses, carcassesIntermediaireById]);

  // Filtrer selon le statut si un filtre est défini - APRÈS tous les hooks
  if (filter && filter !== 'Toutes les fiches' && filter !== simpleStatus) {
    return null;
  }

  return (
    <tr
      key={transmission.fei.numero!}
      className={`cursor-pointer border-b border-gray-200 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
      onClick={() => navigate(`/app/etg/fei/${getTransmissionLink(transmission)}`)}
    >
      <td
        className="px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            className="checked:accent-action-high-blue-france h-4 w-4 border-2"
            onChange={() => onPrintSelect?.(getTransmissionIdFromMetadata(transmission), !isSelected)}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-action-high-blue-france text-lg font-semibold">
            {dayjs(transmission.fei.date_mise_a_mort).format('DD/MM/YYYY')}
          </span>
          <span className="text-sm">{transmission.fei.numero!}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Tag
            small
            className={`items-center rounded-[4px] font-semibold uppercase ${statusColors[simpleStatus].bg} ${statusColors[simpleStatus].text}`}
          >
            {simpleStatus}
          </Tag>
          {currentStepLabelShort && (
            <Tag
              small
              className="items-center rounded-[4px] font-semibold uppercase"
            >
              {currentStepLabelShort}
            </Tag>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 text-sm">
          <span className="">
            {transmission.fei.commune_mise_a_mort
              ?.split(' ')
              .slice(1)
              .map((w: string) => w.toLocaleLowerCase())
              .join(' ') || 'À renseigner'}
          </span>
          <span className="text-gray-600">
            {transmission.content.premier_detenteur_name_cache || 'À renseigner'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 text-sm">
          {formattedCarcassesAcceptées.length > 0 ? (
            <div>
              {formattedCarcassesAcceptées.map((carcasse, index) => (
                <p
                  className="m-0 text-sm"
                  key={carcasse + index}
                >
                  {carcasse}
                </p>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">À renseigner</span>
          )}
          {_carcassesOuLotsRefusés && (
            <span className="text-warning-main-525 font-semibold">{_carcassesOuLotsRefusés}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function FeisTable({
  paginatedTransmissions,
  handleSelectAll,
  selectedTransmissions,
  filter,
  handleCheckboxClick,
}: {
  paginatedTransmissions: Array<CarcasseTransmissionWihMetadata>;
  handleSelectAll: (visibleFeis?: TransmissionIdSelection) => void;
  selectedTransmissions: TransmissionIdSelection;
  filter?: TransmissionSimpleStatus | 'Toutes les fiches';
  handleCheckboxClick: (feiNumber: string, selected: boolean) => void;
}) {
  const navigate = useNavigate();
  const [visibleFeisNumbers, setVisibleFeisNumbers] = useState<TransmissionIdSelection>([]);

  if (paginatedTransmissions.length === 0) {
    return null;
  }

  const allSelected =
    visibleFeisNumbers.length > 0
      ? visibleFeisNumbers.every((numero) => selectedTransmissions?.includes(numero))
      : false;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-center text-sm font-semibold">
              <div className="flex h-full items-center justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  className="checked:accent-action-high-blue-france h-4 w-4 border-2"
                  onChange={() => handleSelectAll(visibleFeisNumbers)}
                  aria-label={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                />
              </div>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Fiche</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Localisation</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Carcasses</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTransmissions.map((transmission) => {
            return (
              <FeisTableRow
                key={getTransmissionIdFromMetadata(transmission)}
                transmission={transmission}
                isSelected={selectedTransmissions.includes(getTransmissionIdFromMetadata(transmission))}
                onPrintSelect={handleCheckboxClick}
                navigate={navigate}
                filter={filter}
                onVisibilityChange={(feiNumero, isVisible) => {
                  setVisibleFeisNumbers((prev) => {
                    if (isVisible) {
                      return prev.includes(feiNumero) ? prev : [...prev, feiNumero];
                    }
                    return prev.filter((n) => n !== feiNumero);
                  });
                }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
