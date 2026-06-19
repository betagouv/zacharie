import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import { CarcasseType, DepotType } from '@prisma/client';
import { abbreviations } from '@app/utils/count-carcasses';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { useTransmissionsSorted } from '@app/utils/get-transmissions-sorted';
import { createNewFei } from '@app/utils/create-new-fei';
import { useNavigate, useSearchParams, Link } from 'react-router';
import ExportFeisModal from '@app/components/ExportFeisModal';
import { filterCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CardTransmission from '@app/components/CardTransmission';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import useUser from '@app/zustand/user';
import { UserConnexionResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import type { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { getSaisonStartYear, getSaisonLabel, isDateInSaison } from '@app/utils/get-saison';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import PendingModifRequestsAlertModal from '@app/components/PendingModifRequestsAlertModal';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import Chargement from '@app/components/Chargement';
import { CompteEnAttenteValidationAlert } from '@app/components/CompteEnAttenteValidation';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';

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

type ViewType = 'grid' | 'table';
type FeiNumberSelection = Array<NonNullable<CarcasseTransmissionWihMetadata['fei']['numero']>>;

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

const ITEMS_PER_PAGE = 100;

export default function ChasseurFiches() {
  const navigate = useNavigate();
  const user = useMostFreshUser('chasseur fiches')!;
  const { transmissionsEnCours, transmissionsACompleter, transmissionsCloturees } = useTransmissionsSorted();
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams] = useSearchParams();
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
    loadData('chasseur-fiches').then(() => setIsLoading(false));
  });

  useSaveScroll('chasseur-fiches-scrollY');

  const [selectedFeis, setSelectedFeis] = useState<FeiNumberSelection>([]);
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

  const [filterStatuses, setFilterStatuses] = useState<TransmissionSimpleStatus[]>(() => {
    try {
      const saved = localStorage.getItem('chasseur-fiches-filter-statuses');
      if (saved) return JSON.parse(saved) as TransmissionSimpleStatus[];
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

  const [filterSaisons, setFilterSaisons] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('chasseur-fiches-filter-saisons');
      if (saved) return JSON.parse(saved) as number[];
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-saisons', JSON.stringify(filterSaisons));
  }, [filterSaisons]);

  const [filterDateFrom, setFilterDateFrom] = useState<string>(
    () => localStorage.getItem('chasseur-fiches-filter-date-from') || ''
  );
  const [filterDateTo, setFilterDateTo] = useState<string>(
    () => localStorage.getItem('chasseur-fiches-filter-date-to') || ''
  );

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-date-from', filterDateFrom);
  }, [filterDateFrom]);

  useEffect(() => {
    localStorage.setItem('chasseur-fiches-filter-date-to', filterDateTo);
  }, [filterDateTo]);

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

  const collecteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const transmission of allTransmissions) {
      const id =
        transmission.content.latest_intermediaire_entity_id ||
        transmission.content.latest_intermediaire_user_id;
      const name = transmission.content.latest_intermediaire_name_cache;
      if (id && name && !map.has(id)) {
        map.set(id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTransmissions]);

  const saisonOptions = useMemo(() => {
    const years = new Set<number>();
    for (const transmission of allTransmissions) {
      if (transmission.fei.date_mise_a_mort)
        years.add(getSaisonStartYear(transmission.fei.date_mise_a_mort));
    }
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ year, label: getSaisonLabel(year) }));
  }, [allTransmissions]);

  const filteredTransmissions = useMemo(() => {
    const result: CarcasseTransmissionWihMetadata[] = [];
    const q = searchQuery.trim() ? searchQuery.trim().toLowerCase() : undefined;
    for (const transmission of allTransmissions) {
      if (q) {
        let isIncluded = false;
        if (transmission.fei.numero!.toLowerCase().includes(q)) isIncluded = true;
        if (transmission.fei.commune_mise_a_mort?.toLowerCase().includes(q)) isIncluded = true;
        if (transmission.content.premier_detenteur_name_cache?.toLowerCase().includes(q)) isIncluded = true;
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
        if (
          !filterCollecteurs.includes(transmission.content.latest_intermediaire_user_id ?? '') &&
          !filterCollecteurs.includes(transmission.content.latest_intermediaire_entity_id ?? '')
        )
          continue;
      }
      if (filterSaisons.length > 0) {
        if (!transmission.fei.date_mise_a_mort) continue;
        if (!filterSaisons.some((year) => isDateInSaison(transmission.fei.date_mise_a_mort!, year))) continue;
      }
      if (filterDateFrom || filterDateTo) {
        if (!transmission.fei.date_mise_a_mort) continue;
        const d = dayjs(transmission.fei.date_mise_a_mort).format('YYYY-MM-DD');
        if (filterDateFrom && d < filterDateFrom) continue;
        if (filterDateTo && d > filterDateTo) continue;
      }
      result.push(transmission);
    }
    return result;
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
    </>
  );

  if (isLoading) {
    return <Chargement />;
  }

  return (
    <div className="relative">
      <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>

      <PendingModifRequestsAlertModal />

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
          {user.numero_cfei && user.activated && (
            <Button
              iconId="fr-icon-add-circle-line"
              priority="primary"
              onClick={async () => {
                const newFei = await createNewFei();
                navigate(`/app/chasseur/fei/${newFei.numero}`);
              }}
            >
              Nouvelle
            </Button>
          )}
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
          {!user.activated && <CompteEnAttenteValidationAlert className="fr-mb-4w" />}
          <OnboardingChasseInfoBanner />
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
                <ExportFeisModal
                  feiNumbers={selectedFeis}
                  storageKey="chasseur-fiches-export-columns"
                />
              </div>
              {user.numero_cfei && user.activated && (
                <Button
                  iconId="fr-icon-add-circle-line"
                  priority="primary"
                  onClick={async () => {
                    const newFei = await createNewFei();
                    navigate(`/app/chasseur/fei/${newFei.numero}`);
                  }}
                >
                  Nouvelle fiche
                </Button>
              )}
            </div>
          )}
          <FeisWrapper
            viewType={viewType}
            handleSelectAll={handleSelectAll}
            handleCheckboxClick={handleCheckboxClick}
            selectedFeis={selectedFeis}
            filter={'Toutes les fiches'}
            paginatedTransmissions={paginatedTransmissions}
          />
          {filteredTransmissions.length > 0 && totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                count={totalPages}
                defaultPage={page}
                getPageLinkProps={(pageNumber) => ({
                  to: `/app/chasseur?page=${pageNumber}`,
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
  selectedFeis,
  filter,
}: {
  paginatedTransmissions: Array<CarcasseTransmissionWihMetadata>;
  viewType: 'grid' | 'table';
  handleSelectAll: (visibleFeis?: string[]) => void;
  handleCheckboxClick: (feiNumber: string, selected: boolean) => void;
  selectedFeis: FeiNumberSelection;
  filter?: TransmissionSimpleStatus | 'Toutes les fiches';
}) {
  const user = useMostFreshUser('chasseur fiches')!;
  const navigate = useNavigate();
  const nothingToShow = paginatedTransmissions.length === 0;

  if (nothingToShow) {
    return (
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center bg-white p-4 md:p-8">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <div className="flex flex-col bg-white">
              <h2 className="fr-h4 mb-3 font-bold text-gray-800">Pas encore de fiches cette saison</h2>
              {user.numero_cfei && user.activated ? (
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
        return (
          <CardTransmission
            key={transmission.fei.numero}
            transmission={transmission}
            filter={'Toutes les fiches'}
            onPrintSelect={handleCheckboxClick}
            isPrintSelected={selectedFeis.includes(transmission.fei.numero!)}
            linkTo={`/app/chasseur/fei/${transmission.fei.numero}`}
            detenteurName={transmission.content.premier_detenteur_name_cache ?? null}
            detenteurIcon={<ChasseIcon />}
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
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  // Notifier le parent de la visibilité de cette ligne
  useEffect(() => {
    const isVisible = !filter || filter === 'Toutes les fiches' || filter === simpleStatus;
    onVisibilityChange?.(transmission.fei.numero!, isVisible);
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
      onClick={() => navigate(`/app/chasseur/fei/${transmission.fei.numero!}`)}
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
            onChange={() => onPrintSelect?.(transmission.fei.numero!, !isSelected)}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-action-high-blue-france text-lg font-semibold">
            {dayjs(transmission.fei.date_mise_a_mort || transmission.content.created_at).format('DD/MM/YYYY')}
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
  selectedFeis,
  filter,
  handleCheckboxClick,
}: {
  paginatedTransmissions: Array<CarcasseTransmissionWihMetadata>;
  handleSelectAll: (visibleFeis?: FeiNumberSelection) => void;
  selectedFeis: FeiNumberSelection;
  filter?: TransmissionSimpleStatus | 'Toutes les fiches';
  handleCheckboxClick: (feiNumber: string, selected: boolean) => void;
}) {
  const navigate = useNavigate();
  const [visibleFeisNumbers, setVisibleFeisNumbers] = useState<FeiNumberSelection>([]);

  if (paginatedTransmissions.length === 0) {
    return null;
  }

  const allSelected =
    visibleFeisNumbers.length > 0
      ? visibleFeisNumbers.every((numero) => selectedFeis?.includes(numero))
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
                key={transmission.fei.numero}
                transmission={transmission}
                isSelected={selectedFeis.includes(transmission.fei.numero!)}
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
