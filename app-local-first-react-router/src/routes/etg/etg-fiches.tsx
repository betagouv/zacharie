import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import dayjs from 'dayjs';
import { CarcasseType, DepotType, FeiOwnerRole } from '@prisma/client';
import type { Carcasse } from '@prisma/client';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { UserConnexionResponse } from '@api/src/types/responses';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { abbreviations } from '@app/utils/count-carcasses';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { getSaisonStartYear, getSaisonLabel, isDateInSaison } from '@app/utils/get-saison';
import ExportFeisModal from '@app/components/ExportFeisModal';
import { filterCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { filterCarcassesForFei, useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CardFiche from '@app/components/CardFiche';
import CarcassesEspeceSummary from '@app/components/CarcassesEspeceSummary';
import { getPreviousDetenteur } from '@app/utils/get-previous-detenteur';
import CollapsibleSection from '@app/components/CollapsibleSection';

import { useFeiSteps, computeFeiSteps } from '@app/utils/fei-steps';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { useLoaderEffect, loadData } from '@app/utils/load-data';
import Chargement from '@app/components/Chargement';

type ViewType = 'grid' | 'table';

const statusColors: Record<FeiStepSimpleStatus, { bg: string; text: string }> = {
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
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const { feisOngoing, feisToTake, feisUnderMyResponsability, feisDone } = getFeisSorted();
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasses = useZustandStore((state) => state.carcasses);
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

  const [selectedFeis, setSelectedFeis] = useState<string[]>([]);
  const handleCheckboxClick = (id: string) => {
    setSelectedFeis((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fei) => fei !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = (visibleFeis?: string[]) => {
    const feisToToggle = visibleFeis || [];
    const allSelected = feisToToggle.every((numero) => selectedFeis.includes(numero));
    if (allSelected) {
      // Désélectionner toutes les fiches visibles
      setSelectedFeis((prev) => prev.filter((numero) => !feisToToggle.includes(numero)));
    } else {
      // Sélectionner toutes les fiches visibles
      setSelectedFeis((prev) => {
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

  const [filterStatuses, setFilterStatuses] = useState<FeiStepSimpleStatus[]>(() => {
    try {
      const saved = localStorage.getItem('etg-fiches-filter-statuses');
      if (saved) return JSON.parse(saved) as FeiStepSimpleStatus[];
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
  const isFirstFiltersRender = useRef(true);
  useEffect(() => {
    if (isFirstFiltersRender.current) {
      isFirstFiltersRender.current = false;
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        return next;
      },
      { replace: true }
    );
  }, [filtersKey, setSearchParams]);

  const allFeis = useMemo(() => {
    return [...feisAssigned, ...feisOngoing, ...feisDone];
  }, [feisAssigned, feisOngoing, feisDone]);

  const premierDetenteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const fei of allFeis) {
      const id = fei.premier_detenteur_entity_id || fei.premier_detenteur_user_id;
      const name = fei.premier_detenteur_name_cache;
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allFeis]);

  const ccgOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const fei of allFeis) {
      if (fei.premier_detenteur_depot_type === DepotType.CCG && fei.premier_detenteur_depot_entity_id) {
        const id = fei.premier_detenteur_depot_entity_id;
        const name = fei.premier_detenteur_depot_entity_name_cache || id;
        if (!map.has(id)) {
          map.set(id, name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allFeis]);

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

  const carcassesByFei = useMemo(() => {
    const result: Record<string, Carcasse[]> = {};
    for (const c of Object.values(carcasses)) {
      if (c.deleted_at) continue;
      if (!result[c.fei_numero]) result[c.fei_numero] = [];
      result[c.fei_numero].push(c);
    }
    return result;
  }, [carcasses]);

  const feiCollecteurIdsByNumero = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const fei of allFeis) {
      const intermediaires = intermediairesByFei[fei.numero] ?? [];
      const ids: string[] = [];
      for (const inter of intermediaires) {
        if (inter.intermediaire_role !== FeiOwnerRole.COLLECTEUR_PRO) continue;
        const id = inter.intermediaire_entity_id || inter.intermediaire_user_id;
        if (id && !ids.includes(id)) ids.push(id);
      }
      result[fei.numero] = ids;
    }
    return result;
  }, [allFeis, intermediairesByFei]);

  const collecteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ids of Object.values(feiCollecteurIdsByNumero)) {
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
  }, [feiCollecteurIdsByNumero, entities, usersById]);

  const saisonOptions = useMemo(() => {
    const years = new Set<number>();
    for (const fei of allFeis) {
      if (fei.date_mise_a_mort) years.add(getSaisonStartYear(fei.date_mise_a_mort));
    }
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ year, label: getSaisonLabel(year) }));
  }, [allFeis]);

  const filteredFeis = useMemo(() => {
    let feis = allFeis;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      feis = feis.filter(
        (fei) =>
          fei.numero.toLowerCase().includes(q) ||
          (fei.commune_mise_a_mort && fei.commune_mise_a_mort.toLowerCase().includes(q)) ||
          (fei.premier_detenteur_name_cache && fei.premier_detenteur_name_cache.toLowerCase().includes(q))
      );
    }
    if (filterStatuses.length > 0) {
      feis = feis.filter((fei) => {
        const intermediaires = intermediairesByFei[fei.numero] ?? [];
        const feiCarcasses = carcassesByFei[fei.numero] ?? [];
        const { simpleStatus } = computeFeiSteps({
          fei,
          intermediaires,
          entitiesIdsWorkingDirectlyFor,
          user,
          carcasses: feiCarcasses,
        });
        return filterStatuses.includes(simpleStatus);
      });
    }
    if (filterPremierDetenteurs.length > 0) {
      feis = feis.filter(
        (fei) =>
          filterPremierDetenteurs.includes(fei.premier_detenteur_user_id ?? '') ||
          filterPremierDetenteurs.includes(fei.premier_detenteur_entity_id ?? '')
      );
    }
    if (filterCCGs.length > 0) {
      feis = feis.filter((fei) => filterCCGs.includes(fei.premier_detenteur_depot_entity_id ?? ''));
    }
    if (filterCollecteurs.length > 0) {
      feis = feis.filter((fei) => {
        const ids = feiCollecteurIdsByNumero[fei.numero] ?? [];
        return ids.some((id) => filterCollecteurs.includes(id));
      });
    }
    if (filterSaisons.length > 0) {
      feis = feis.filter(
        (fei) =>
          !!fei.date_mise_a_mort && filterSaisons.some((year) => isDateInSaison(fei.date_mise_a_mort!, year))
      );
    }
    if (filterDateFrom || filterDateTo) {
      feis = feis.filter((fei) => {
        if (!fei.date_mise_a_mort) return false;
        const d = dayjs(fei.date_mise_a_mort).format('YYYY-MM-DD');
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
        return true;
      });
    }
    return feis;
  }, [
    allFeis,
    searchQuery,
    filterStatuses,
    filterPremierDetenteurs,
    filterCCGs,
    filterCollecteurs,
    filterSaisons,
    filterDateFrom,
    filterDateTo,
    feiCollecteurIdsByNumero,
    intermediairesByFei,
    carcassesByFei,
    entitiesIdsWorkingDirectlyFor,
    user,
  ]);

  const filteredCarcasses = useMemo(() => {
    return filteredFeis.flatMap((fei) => filterCarcassesForFei(carcasses, fei.numero));
  }, [filteredFeis, carcasses]);

  const totalPages = Math.ceil(filteredFeis.length / ITEMS_PER_PAGE);
  const paginatedFeis = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredFeis.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredFeis, page]);

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
          {filteredFeis.length} fiche{filteredFeis.length > 1 ? 's' : ''}
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
          {(['À compléter', 'En cours', 'Clôturée'] as FeiStepSimpleStatus[]).map((status) => (
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
          {filteredFeis.length} fiche{filteredFeis.length > 1 ? 's' : ''}
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
          {filteredFeis.length > 0 && (
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
                <ExportFeisModal
                  feiNumbers={selectedFeis}
                  storageKey="etg-fiches-export-columns"
                />
              </div>
            </div>
          )}
          {filteredFeis.length > 0 && (
            <CarcassesEspeceSummary
              carcasses={filteredCarcasses}
              storageKey="etg-fiches-espece-summary-open"
            />
          )}
          <FeisWrapper
            viewType={viewType}
            handleSelectAll={handleSelectAll}
            selectedFeis={selectedFeis}
            filter={'Toutes les fiches'}
          >
            {paginatedFeis.map((fei) => {
              if (!fei) return null;
              const detenteurPrecedent = getPreviousDetenteur(fei);
              return (
                <CardFiche
                  key={fei.numero}
                  fei={fei}
                  filter={'Toutes les fiches'}
                  onPrintSelect={handleCheckboxClick}
                  isPrintSelected={selectedFeis.includes(fei.numero)}
                  linkTo={`/app/etg/fei/${fei.numero}`}
                  detenteurName={detenteurPrecedent.name}
                  detenteurIcon={detenteurPrecedent.icon}
                />
              );
            })}
          </FeisWrapper>
          {filteredFeis.length > 0 && totalPages > 1 && (
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
  children,
  viewType,
  handleSelectAll,
  selectedFeis,
  filter,
}: {
  children: React.ReactNode;
  viewType: 'grid' | 'table';
  handleSelectAll?: (visibleFeis?: string[]) => void;
  selectedFeis?: string[];
  filter?: FeiStepSimpleStatus | 'Toutes les fiches';
}) {
  const nothingToShow = !children || React.Children.toArray(children).length === 0;

  if (nothingToShow) {
    return (
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center bg-white p-4 md:p-8">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <div className="flex flex-col bg-white">
              <h2 className="fr-h4 mb-3 font-bold text-gray-800">Pas encore de fiches cette saison</h2>
              <p className="fr-text--regular mb-6 max-w-md">
                Vos fiches apparaîtront ici dès qu'une fiche vous sera attribuée.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewType === 'table') {
    return (
      <FeisTable
        handleSelectAll={handleSelectAll}
        selectedFeis={selectedFeis}
        filter={filter as FeiStepSimpleStatus | 'Toutes les fiches'}
      >
        {children}
      </FeisTable>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 justify-self-end sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

function FeisTableRow({
  fei,
  isSelected,
  onPrintSelect,
  navigate,
  filter,
  onVisibilityChange,
}: {
  fei: FeiWithIntermediaires;
  isSelected: boolean;
  onPrintSelect?: (feiNumber: string, selected: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  filter?: FeiStepSimpleStatus | 'Toutes les fiches';
  onVisibilityChange?: (feiNumero: string, isVisible: boolean) => void;
}) {
  const { simpleStatus, currentStepLabelShort } = useFeiSteps(fei);
  const myCarcasses = useMyCarcassesForFei(fei.numero);
  const feiCarcasses = useCarcassesForFei(fei.numero);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  // Notifier le parent de la visibilité de cette ligne
  useEffect(() => {
    const isVisible = !filter || filter === 'Toutes les fiches' || filter === simpleStatus;
    onVisibilityChange?.(fei.numero, isVisible);
  }, [filter, simpleStatus, fei.numero, onVisibilityChange]);

  const [formattedCarcassesAcceptées, _carcassesOuLotsRefusés] = useMemo(() => {
    const formatted = formatCountCarcasseByEspece(myCarcasses) as string[];
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
            const carcasse = feiCarcasses.find(
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
  }, [myCarcasses, feiCarcasses, carcassesIntermediaireById]);

  // Filtrer selon le statut si un filtre est défini - APRÈS tous les hooks
  if (filter && filter !== 'Toutes les fiches' && filter !== simpleStatus) {
    return null;
  }

  return (
    <tr
      key={fei.numero}
      className={`cursor-pointer border-b border-gray-200 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
      onClick={() => navigate(`/app/etg/fei/${fei.numero}`)}
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
            onChange={() => onPrintSelect?.(fei.numero, !isSelected)}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-action-high-blue-france text-lg font-semibold">
            {dayjs(fei.date_mise_a_mort || fei.created_at).format('DD/MM/YYYY')}
          </span>
          <span className="text-sm">{fei.numero}</span>
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
            {fei.commune_mise_a_mort
              ?.split(' ')
              .slice(1)
              .map((w: string) => w.toLocaleLowerCase())
              .join(' ') || 'À renseigner'}
          </span>
          <span className="text-gray-600">{fei.premier_detenteur_name_cache || 'À renseigner'}</span>
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
  children,
  handleSelectAll,
  selectedFeis,
  filter,
}: {
  children: React.ReactNode;
  handleSelectAll?: (visibleFeis?: string[]) => void;
  selectedFeis?: string[];
  filter?: FeiStepSimpleStatus | 'Toutes les fiches';
}) {
  const navigate = useNavigate();
  const [visibleFeisNumbers, setVisibleFeisNumbers] = useState<string[]>([]);

  // Extract CardFiche components from children to get fei data
  const feis = React.Children.toArray(children).filter(
    (child): child is React.ReactElement => React.isValidElement(child) && child.type === CardFiche
  );

  if (feis.length === 0) {
    return null;
  }

  const allSelected =
    visibleFeisNumbers.length > 0
      ? visibleFeisNumbers.every((numero) => selectedFeis?.includes(numero))
      : false;

  const handleSelectAllInTable = () => {
    if (handleSelectAll) {
      handleSelectAll(visibleFeisNumbers);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-center text-sm font-semibold">
              <div className="flex h-full items-center justify-center">
                {handleSelectAll && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    className="checked:accent-action-high-blue-france h-4 w-4 border-2"
                    onChange={handleSelectAllInTable}
                    aria-label={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  />
                )}
              </div>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Fiche</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Localisation</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Carcasses</th>
          </tr>
        </thead>
        <tbody>
          {feis.map((feiElement) => {
            const fei = feiElement.props.fei;
            const isSelected = feiElement.props.isPrintSelected;
            const onPrintSelect = feiElement.props.onPrintSelect;
            return (
              <FeisTableRow
                key={fei.numero}
                fei={fei}
                isSelected={isSelected}
                onPrintSelect={onPrintSelect}
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
