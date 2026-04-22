import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { CarcasseType, DepotType } from '@prisma/client';
import { abbreviations } from '@app/utils/count-carcasses';
import dayjs from 'dayjs';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import useZustandStore, { syncData } from '@app/zustand/store';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { loadFeis } from '@app/utils/load-feis';
import { loadMyRelations } from '@app/utils/load-my-relations';
import useExportFeis from '@app/utils/export-feis';
import {
  filterCarcassesIntermediairesForCarcasse,
  filterFeiIntermediaires,
} from '@app/utils/get-carcasses-intermediaires';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CardFiche from '@app/components/CardFiche';
import { filterCarcassesForFei, useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import useUser from '@app/zustand/user';
import { UserConnexionResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { useFeiSteps, computeFeiSteps } from '@app/utils/fei-steps';
import { useIsCircuitCourt } from '@app/utils/circuit-court';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between py-1 text-left text-sm font-bold text-gray-800"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <span
          className={`fr-icon--sm transition-transform ${open ? 'fr-icon-arrow-up-s-line' : 'fr-icon-arrow-down-s-line'}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}

async function loadData() {
  // FIXME: await syncData is useless, as syncData queues stuff - so there will be bugs
  await syncData('chasseur-fiches');
  await loadMyRelations();
  await loadFeis();
}

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

function OnboardingChasseInfoBanner() {
  const user = useUser((state) => state.user)!;

  // Ne pas afficher si l'utilisateur n'est pas chasseur ou a déjà répondu
  if (user.onboarding_chasse_info_done_at !== null) {
    return null;
  }

  const handleSkip = async () => {
    const response = await API.post({
      path: `/user/${user.id}`,
      body: { onboarding_chasse_info_done_at: new Date().toISOString() },
    }).then((data) => data as UserConnexionResponse);
    if (response.ok && response.data?.user?.id) {
      useUser.setState({ user: response.data.user });
    }
  };

  return (
    <div className="fr-mb-4w flex flex-col gap-4 rounded border border-[var(--border-default-grey)] bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="m-0 text-lg font-medium">Complétez vos informations de chasse</p>
        <p className="m-0 mt-1 text-sm text-[var(--text-mention-grey)]">
          Ces informations seront reportées automatiquement sur vos fiches.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 md:flex-row">
        <Link
          to="/app/chasseur/onboarding/mes-informations-de-chasse"
          className="fr-btn fr-btn--primary"
        >
          Compléter mon profil
        </Link>
        <Button
          priority="secondary"
          onClick={handleSkip}
        >
          Ne plus afficher
        </Button>
      </div>
    </div>
  );
}

export default function ChasseurFiches() {
  const navigate = useNavigate();
  const user = useMostFreshUser('chasseur fiches')!;
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const { feisOngoing, feisToTake, feisUnderMyResponsability, feisDone } = getFeisSorted();
  const { onExportToXlsx, onExportSimplifiedToXlsx, isExporting } = useExportFeis();
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const [loading, setLoading] = useState(false);
  const isOnline = useIsOnline();
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasses = useZustandStore((state) => state.carcasses);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('chasseur-fiches-items-per-page', 20);

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

  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    refreshUser('chasseur-fiches').then(loadData);
  }, []);

  useSaveScroll('chasseur-fiches-scrollY');

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
      const saved = localStorage.getItem('chasseur-fiches-filter-statuses');
      if (saved) return JSON.parse(saved) as FeiStepSimpleStatus[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-statuses', JSON.stringify(filterStatuses));
  }, [filterStatuses]);

  const [viewType, setViewType] = useState<ViewType>(() => {
    const savedViewType = localStorage.getItem('chasseur-fiches-view-type');
    if (savedViewType === 'grid' || savedViewType === 'table') {
      return savedViewType as ViewType;
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-view-type', viewType);
  }, [viewType]);

  const dropDownMenuFilterText = useMemo(() => {
    if (filterStatuses.length === 0) return 'Filtrer par statut';
    const names: Record<FeiStepSimpleStatus, string> = {
      'À compléter': 'Fiches à compléter',
      'En cours': 'Fiches en cours',
      Clôturée: 'Fiches clôturées',
    };
    if (filterStatuses.length === 1) return names[filterStatuses[0]];
    return `${filterStatuses.length} statuts`;
  }, [filterStatuses]);
  const [filterPremierDetenteurs, setFilterPremierDetenteurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chasseur-fiches-filter-premier-detenteurs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(
      'chasseur-fiches-filter-premier-detenteurs',
      JSON.stringify(filterPremierDetenteurs)
    );
  }, [filterPremierDetenteurs]);

  const [filterCCGs, setFilterCCGs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chasseur-fiches-filter-ccgs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-ccgs', JSON.stringify(filterCCGs));
  }, [filterCCGs]);

  const [filterCollecteurs, setFilterCollecteurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chasseur-fiches-filter-collecteurs');
      if (saved) return JSON.parse(saved) as string[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-collecteurs', JSON.stringify(filterCollecteurs));
  }, [filterCollecteurs]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const allFeis = useMemo(() => {
    return [...feisAssigned, ...feisOngoing, ...feisDone];
  }, [feisAssigned, feisOngoing, feisDone]);

  const premierDetenteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const fei of allFeis) {
      const id = fei.premier_detenteur_user_id || fei.premier_detenteur_entity_id;
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

  const collecteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const fei of allFeis) {
      const id = fei.latest_intermediaire_user_id || fei.latest_intermediaire_entity_id;
      const name = fei.latest_intermediaire_name_cache;
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allFeis]);

  const dropDownMenuFilterTextPremierDetenteur = useMemo(() => {
    if (filterPremierDetenteurs.length === 0) return 'Filtrer par premier détenteur';
    if (filterPremierDetenteurs.length === 1) {
      const option = premierDetenteurOptions.find((o) => o.id === filterPremierDetenteurs[0]);
      if (option) return option.name;
    }
    return `${filterPremierDetenteurs.length} premiers détenteurs`;
  }, [filterPremierDetenteurs, premierDetenteurOptions]);

  const dropDownMenuFilterTextCCG = useMemo(() => {
    if (filterCCGs.length === 0) return 'Filtrer par CCG';
    if (filterCCGs.length === 1) {
      const option = ccgOptions.find((o) => o.id === filterCCGs[0]);
      if (option) return option.name;
    }
    return `${filterCCGs.length} CCG`;
  }, [filterCCGs, ccgOptions]);

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
        const intermediaires = filterFeiIntermediaires(carcassesIntermediaireById, fei.numero);
        const feiCarcasses = filterCarcassesForFei(carcasses, fei.numero);
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
      feis = feis.filter(
        (fei) =>
          filterCollecteurs.includes(fei.latest_intermediaire_user_id ?? '') ||
          filterCollecteurs.includes(fei.latest_intermediaire_entity_id ?? '')
      );
    }
    return feis;
  }, [
    allFeis,
    searchQuery,
    filterStatuses,
    filterPremierDetenteurs,
    filterCCGs,
    filterCollecteurs,
    carcassesIntermediaireById,
    carcasses,
    entitiesIdsWorkingDirectlyFor,
    user,
  ]);

  const totalPages = Math.ceil(filteredFeis.length / (itemsPerPage ?? 20));
  const paginatedFeis = useMemo(() => {
    const perPage = itemsPerPage ?? 20;
    const start = (page - 1) * perPage;
    return filteredFeis.slice(start, start + perPage);
  }, [filteredFeis, page, itemsPerPage]);

  const hasActiveFilters =
    filterStatuses.length > 0 ||
    filterPremierDetenteurs.length > 0 ||
    filterCCGs.length > 0 ||
    filterCollecteurs.length > 0 ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setFilterStatuses([]);
    setFilterPremierDetenteurs([]);
    setFilterCCGs([]);
    setFilterCollecteurs([]);
    setSearchQuery('');
  };

  const sidebarContent = (
    <>
      {/* Nouvelle fiche */}
      {user.numero_cfei && (
        <Button
          iconId="fr-icon-add-circle-line"
          priority="primary"
          className="w-full"
          onClick={async () => {
            const newFei = await createNewFei();
            navigate(`/app/chasseur/fei/${newFei.numero}`);
          }}
        >
          Nouvelle fiche
        </Button>
      )}

      {/* Recherche */}
      <div className="mt-2">
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
                className={`inline-block rounded px-2 py-0.5 text-xs uppercase font-semibold ${statusColors[status].bg} ${statusColors[status].text}`}
              >
                {status}
              </span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Filtre Premier détenteur */}
      {premierDetenteurOptions.length > 1 && (
        <CollapsibleSection
          title="Premier détenteur"
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

      {/* Actions export */}
      <CollapsibleSection
        title="Actions"
        defaultOpen={false}
      >
        <Button
          size="small"
          disabled={selectedFeis.length === 0}
          priority="secondary"
          className="w-full"
          iconId="ri-download-line"
          onClick={(e) => {
            e.preventDefault();
            if (selectedFeis.length === 0) return;
            if (isExporting) return;
            onExportToXlsx(selectedFeis);
          }}
        >
          Exporter (complet)
        </Button>

        <Button
          size="small"
          disabled={selectedFeis.length === 0}
          priority="secondary"
          className="mt-2 w-full"
          iconId="ri-download-line"
          onClick={(e) => {
            e.preventDefault();
            if (selectedFeis.length === 0) return;
            if (isExporting) return;
            onExportSimplifiedToXlsx(selectedFeis);
          }}
        >
          Exporter (simplifié)
        </Button>
      </CollapsibleSection>

      {/* Mettre à jour */}
      <Button
        priority="tertiary"
        size="small"
        className="mt-2 w-full"
        iconId="ri-refresh-line"
        disabled={!isOnline || loading}
        onClick={async () => {
          setLoading(true);
          await loadData();
          setLoading(false);
        }}
      >
        Mettre à jour
      </Button>
    </>
  );

  return (
    <div className="relative">
      <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>

      {/* Mobile : bouton filtres sticky */}
      <div className="fr-background-alt--blue-france sticky top-0 z-30 flex items-center justify-between px-4 py-2 md:hidden">
        <span className="text-sm font-medium">
          {filteredFeis.length} fiche{filteredFeis.length > 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          {user.numero_cfei && (
            <Button
              iconId="fr-icon-add-circle-line"
              priority="primary"
              size="small"
              onClick={async () => {
                const newFei = await createNewFei();
                navigate(`/app/chasseur/fei/${newFei.numero}`);
              }}
            >
              Nouvelle fiche
            </Button>
          )}
          <Button
            iconId={viewType === 'grid' ? 'ri-table-line' : 'ri-grid-line'}
            priority="secondary"
            size="small"
            title={viewType === 'grid' ? 'Afficher en table' : 'Afficher en grille'}
            onClick={() => setViewType(viewType === 'grid' ? 'table' : 'grid')}
          >
            {viewType === 'grid' ? 'Table' : 'Grille'}
          </Button>
          <Button
            iconId="ri-filter-3-line"
            priority="secondary"
            size="small"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            Filtres
            {hasActiveFilters
              ? ` (${filterStatuses.length + filterPremierDetenteurs.length + filterCCGs.length + filterCollecteurs.length})`
              : ''}
          </Button>
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
          <OnboardingChasseInfoBanner />
          <FeisWrapper
            viewType={viewType}
            handleSelectAll={handleSelectAll}
            selectedFeis={selectedFeis}
            filter={'Toutes les fiches'}
          >
            {paginatedFeis.map((fei) => {
              if (!fei) return null;
              return (
                <CardFiche
                  key={fei.numero}
                  fei={fei}
                  filter={'Toutes les fiches'}
                  onPrintSelect={handleCheckboxClick}
                  isPrintSelected={selectedFeis.includes(fei.numero)}
                  linkTo={`/app/chasseur/fei/${fei.numero}`}
                />
              );
            })}
          </FeisWrapper>
          {filteredFeis.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 py-6 md:justify-between">
              <div className="hidden md:block md:w-40">
                <SegmentedControl
                  hideLegend
                  small
                  legend="Affichage"
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
              </div>
              {totalPages > 1 && (
                <Pagination
                  count={totalPages}
                  defaultPage={page}
                  getPageLinkProps={(pageNumber) => ({
                    to: `/app/chasseur?page=${pageNumber}`,
                  })}
                />
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Par page</span>
                <div className="flex gap-1">
                  {[20, 50, 100].map((option) => (
                    <button
                      key={option}
                      className={[
                        'rounded px-3 py-1 text-sm transition-colors',
                        (itemsPerPage ?? 20) === option
                          ? 'bg-action-high-blue-france text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      ].join(' ')}
                      onClick={() => {
                        const firstItemIndex = (page - 1) * (itemsPerPage ?? 20);
                        const newPage = Math.floor(firstItemIndex / option) + 1;
                        setItemsPerPage(option);
                        setSearchParams(newPage > 1 ? { page: String(newPage) } : {});
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
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
  const user = useMostFreshUser('chasseur fiches')!;
  const navigate = useNavigate();
  const nothingToShow = !children || React.Children.toArray(children).length === 0;

  if (nothingToShow) {
    return (
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center bg-white p-4 md:p-8">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <div className="flex flex-col bg-white">
              <h2 className="fr-h4 mb-3 font-bold text-gray-800">Pas encore de fiches cette saison</h2>
              {user.numero_cfei ? (
                <>
                  <p className="fr-text--regular mb-6 max-w-md">
                    Vos fiches apparaîtront ici dès que vous aurez créé votre première fiche d'examen initial.
                  </p>
                  <Button
                    priority="primary"
                    iconId="fr-icon-add-circle-line"
                    onClick={async () => {
                      const newFei = await createNewFei();
                      navigate(`/app/chasseur/fei/${newFei.numero}`);
                    }}
                  >
                    Créer une fiche
                  </Button>
                </>
              ) : (
                <p className="fr-text--regular mb-6 max-w-md">
                  Vos fiches apparaîtront ici dès qu'une fiche vous sera attribuée.
                </p>
              )}
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
  const isCircuitCourt = useIsCircuitCourt();
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
      onClick={() => navigate(`/app/chasseur/fei/${fei.numero}`)}
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
          {!isCircuitCourt && (
            <Tag
              small
              className={`items-center rounded-[4px] font-semibold uppercase ${statusColors[simpleStatus].bg} ${statusColors[simpleStatus].text}`}
            >
              {simpleStatus}
            </Tag>
          )}
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
