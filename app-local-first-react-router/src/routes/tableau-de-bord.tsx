import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { CarcasseType, UserRoles } from '@prisma/client';
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
import { filterCarcassesIntermediairesForCarcasse, filterFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CardFiche from '@app/components/CardFiche';
import DropDownMenu from '@app/components/DropDownMenu';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
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
import { useEtgIds, useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';

async function loadData() {
  // FIXME: await syncData is useless, as syncData queues stuff - so there will be bugs
  await syncData('tableau-de-bord');
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
  const isChasseur = user.roles.includes(UserRoles.CHASSEUR);

  // Ne pas afficher si l'utilisateur n'est pas chasseur ou a déjà répondu
  if (!isChasseur || user.onboarding_chasse_info_done_at !== null) {
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
          to="/app/tableau-de-bord/onboarding/mes-informations-de-chasse"
          className="fr-btn fr-btn--primary"
        >
          Compléter mon profil
        </Link>
        <Button priority="secondary" onClick={handleSkip}>
          Ne plus afficher
        </Button>
      </div>
    </div>
  );
}

export default function TableauDeBordIndex() {
  const navigate = useNavigate();
  const user = useMostFreshUser('tableau de bord index')!;
  const entities = useZustandStore((state) => state.entities);
  const allEtgIds = useEtgIds();
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const { feisOngoing, feisToTake, feisUnderMyResponsability, feisDone } = getFeisSorted();
  const { onExportToXlsx, onExportSimplifiedToXlsx, isExporting } = useExportFeis();
  const feisAssigned = [...feisUnderMyResponsability, ...feisToTake].sort((a, b) => {
    return b.updated_at < a.updated_at ? -1 : 1;
  });
  const [loading, setLoading] = useState(false);
  const isOnline = useIsOnline();
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('tableau-de-bord-items-per-page', 20);

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

  const isOnlySvi =
    user.roles.includes(UserRoles.SVI) && user.roles.filter((r) => r !== UserRoles.ADMIN).length === 1;

  const { feiActivesForSvi, feisDoneForSvi } = feisDone.reduce(
    (acc, fei) => {
      if (fei.automatic_closed_at) {
        acc.feisDoneForSvi.push(fei);
      } else if (fei.svi_closed_at) {
        acc.feisDoneForSvi.push(fei);
      } else if (dayjs(fei.svi_assigned_at).isBefore(dayjs().subtract(10, 'days'))) {
        acc.feisDoneForSvi.push(fei);
      } else {
        acc.feiActivesForSvi.push(fei);
      }
      return acc;
    },
    {
      feiActivesForSvi: [] as Array<FeiWithIntermediaires>,
      feisDoneForSvi: [] as Array<FeiWithIntermediaires>,
    },
  );

  const hackForCounterDoubleEffectInDevMode = useRef(false);
  useEffect(() => {
    if (hackForCounterDoubleEffectInDevMode.current) {
      return;
    }
    hackForCounterDoubleEffectInDevMode.current = true;
    refreshUser('tableau-de-bord').then(loadData);
  }, []);

  useSaveScroll('tableau-de-bord-scrollY');

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

  const [filter, setFilter] = useState<FeiStepSimpleStatus | 'Toutes les fiches'>(() => {
    const savedFilter = localStorage.getItem('tableau-de-bord-filter');
    if (
      savedFilter &&
      ['Toutes les fiches', 'À compléter', 'En cours', 'Clôturée'].includes(
        savedFilter as FeiStepSimpleStatus | 'Toutes les fiches',
      )
    ) {
      return savedFilter as FeiStepSimpleStatus | 'Toutes les fiches';
    }
    return 'Toutes les fiches';
  });

  useEffect(() => {
    localStorage.setItem('tableau-de-bord-filter', filter);
  }, [filter]);

  const [viewType, setViewType] = useState<ViewType>(() => {
    const savedViewType = localStorage.getItem('tableau-de-bord-view-type');
    if (savedViewType === 'grid' || savedViewType === 'table') {
      return savedViewType as ViewType;
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('tableau-de-bord-view-type', viewType);
  }, [viewType]);

  const dropDownMenuFilterText = useMemo(() => {
    switch (filter) {
      case 'À compléter':
        return 'Fiches à compléter';
      case 'En cours':
        return 'Fiches en cours';
      case 'Clôturée':
        return 'Fiches clôturées';
      case 'Toutes les fiches':
      default:
        return 'Filtrer';
    }
  }, [filter]);
  const [filterETG, setFilterETG] = useState<string>('');
  const [sviWorkingForEtgIds, dropDownMenuFilterTextSvi] = useMemo(() => {
    const _sviWorkingForEtgIds = !isOnlySvi
      ? []
      : allEtgIds.filter((id) => {
        const etgLinkedToSviId = entities[id]?.etg_linked_to_svi_id;
        if (!etgLinkedToSviId) return false;
        return entitiesIdsWorkingDirectlyFor.includes(etgLinkedToSviId);
      });
    if (_sviWorkingForEtgIds.includes(filterETG)) {
      return [_sviWorkingForEtgIds, `Fiches de ${entities[filterETG]?.nom_d_usage}`];
    }
    return [_sviWorkingForEtgIds, 'Filtrer par ETG'];
  }, [filterETG, entities, entitiesIdsWorkingDirectlyFor, allEtgIds, isOnlySvi]);

  const allFeis = useMemo(() => {
    if (isOnlySvi) {
      let feis = [...feiActivesForSvi, ...feisDoneForSvi];
      if (filterETG) {
        feis = feis.filter((fei) => fei.latest_intermediaire_entity_id === filterETG);
      }
      return feis;
    }
    return [...feisAssigned, ...feisOngoing, ...feisDone];
  }, [isOnlySvi, feisAssigned, feisOngoing, feisDone, feiActivesForSvi, feisDoneForSvi, filterETG]);

  const filteredFeis = useMemo(() => {
    if (filter === 'Toutes les fiches') return allFeis;
    return allFeis.filter((fei) => {
      const intermediaires = filterFeiIntermediaires(carcassesIntermediaireById, fei.numero);
      const { simpleStatus } = computeFeiSteps({
        fei,
        intermediaires,
        entitiesIdsWorkingDirectlyFor,
        user,
      });
      return simpleStatus === filter;
    });
  }, [allFeis, filter, carcassesIntermediaireById, entitiesIdsWorkingDirectlyFor, user]);

  const totalPages = Math.ceil(filteredFeis.length / (itemsPerPage ?? 20));
  const paginatedFeis = useMemo(() => {
    const perPage = itemsPerPage ?? 20;
    const start = (page - 1) * perPage;
    return filteredFeis.slice(start, start + perPage);
  }, [filteredFeis, page, itemsPerPage]);

  function Actions() {
    return (
      <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
        <div className="flex flex-col justify-between gap-1.5 md:flex-row md:gap-2">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <DropDownMenu
              text={dropDownMenuFilterText}
              isActive={filter !== 'Toutes les fiches'}
              className="w-full md:w-auto"
              menuLinks={[
                {
                  linkProps: {
                    href: '#',
                    title: 'Toutes les fiches',
                    onClick: (e) => {
                      e.preventDefault();
                      setFilter('Toutes les fiches');
                    },
                  },
                  text: 'Toutes les fiches',
                  isActive: filter === 'Toutes les fiches',
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches à compléter',
                    onClick: (e) => {
                      e.preventDefault();
                      setFilter('À compléter');
                    },
                  },
                  text: 'Fiches à compléter',
                  isActive: filter === 'À compléter',
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches en cours',
                    onClick: (e) => {
                      e.preventDefault();
                      setFilter('En cours');
                    },
                  },
                  text: 'Fiches en cours',
                  isActive: filter === 'En cours',
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches à compléter',
                    onClick: (e) => {
                      e.preventDefault();
                      setFilter('Clôturée');
                    },
                  },
                  text: 'Fiches clôturées',
                  isActive: filter === 'Clôturée',
                },
              ]}
            />
            {isOnlySvi && sviWorkingForEtgIds.length > 1 && (
              <DropDownMenu
                text={dropDownMenuFilterTextSvi}
                isActive={filterETG !== 'Toutes les fiches'}
                className="w-full md:w-auto"
                menuLinks={[
                  {
                    linkProps: {
                      href: '#',
                      title: 'Toutes les fiches',
                      onClick: (e) => {
                        e.preventDefault();
                        setFilterETG('');
                      },
                    },
                    text: 'Toutes les fiches',
                    isActive: !filterETG,
                  },
                  ...[...sviWorkingForEtgIds].map((etgId) => ({
                    linkProps: {
                      href: '#',
                      title: `Fiches de ${entities[etgId]?.nom_d_usage}`,
                      onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                        e.preventDefault();
                        setFilterETG(etgId);
                      },
                    },
                    text: `Fiches de ${entities[etgId]?.nom_d_usage}`,
                    isActive: filterETG === etgId,
                  })),
                ]}
              />
            )}
            <DropDownMenu
              text="Actions"
              className="max-w-[321px]"
              isActive={selectedFeis.length > 0}
              menuLinks={[
                {
                  linkProps: {
                    href: '#',
                    'aria-disabled': selectedFeis.length === 0,
                    className: isExporting || !selectedFeis.length ? 'cursor-not-allowed opacity-50' : '',
                    title:
                      selectedFeis.length === 0
                        ? 'Sélectionnez des fiches avec la case à cocher en haut à droite de chaque carte'
                        : '',
                    onClick: (e) => {
                      e.preventDefault();
                      if (selectedFeis.length === 0) return;
                      if (isExporting) return;
                      onExportToXlsx(selectedFeis);
                    },
                  },
                  text: 'Télécharger un fichier Excel avec les fiches sélectionnées (complètes)',
                },
                {
                  linkProps: {
                    href: '#',
                    'aria-disabled': selectedFeis.length === 0,
                    className: isExporting || !selectedFeis.length ? 'cursor-not-allowed opacity-50' : '',
                    title:
                      selectedFeis.length === 0
                        ? 'Sélectionnez des fiches avec la case à cocher en haut à droite de chaque carte'
                        : '',
                    onClick: (e) => {
                      e.preventDefault();
                      if (selectedFeis.length === 0) return;
                      if (isExporting) return;
                      onExportSimplifiedToXlsx(selectedFeis);
                    },
                  },
                  text: 'Télécharger un fichier Excel avec les fiches sélectionnées (simplifiées)',
                },
              ]}
            />
            <Button
              priority="tertiary"
              className="w-full shrink-0 bg-white md:w-auto"
              iconId="ri-refresh-line"
              disabled={!isOnline || loading}
              onClick={async () => {
                setLoading(true);
                await loadData();
                setLoading(false);
              }}
              title="Mettre à jour"
            >
              <span>Mettre à jour</span>
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SegmentedControl
              hideLegend
              className="hidden md:block"
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
            {user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei && (
              <Button
                iconId="fr-icon-add-circle-line"
                priority="primary"
                className="w-full shrink-0 md:w-auto"
                onClick={async () => {
                  const newFei = await createNewFei();
                  navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                }}
                title="Nouvelle fiche"
              >
                <span>Nouvelle fiche</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm opacity-50">Fiches par page:</span>
            {[20, 50, 100].map((option) => (
              <button
                key={option}
                className={[
                  'px-2 py-1 text-sm',
                  (itemsPerPage ?? 20) === option ? 'font-semibold underline' : '',
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
          <span className="text-sm opacity-50">
            {filteredFeis.length} fiche{filteredFeis.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="fr-background-alt--blue-france top-0 z-30 block w-full md:sticky">
        <div className="fr-container">
          <div className="fr-grid-row fr-grid-row--center fr-grid-row-gutters">
            <div className="fr-col-12 fr-col-md-10 px-3 py-2 md:p-0">
              <Actions />
            </div>
          </div>
        </div>
      </div>
      <div className="fr-container fr-container--fluid">
        <title>Mes fiches | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
        <div className="fr-grid-row fr-grid-row--center fr-grid-row-gutters pt-4">
          <div className="fr-col-12 fr-col-md-10 min-h-96 p-4 md:p-0">
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
                  />
                );
              })}
            </FeisWrapper>
            {totalPages > 1 && (
              <div className="flex justify-center py-6">
                <Pagination
                  count={totalPages}
                  defaultPage={page}
                  getPageLinkProps={(pageNumber) => ({
                    to: `/app/tableau-de-bord?page=${pageNumber}`,
                  })}
                />
              </div>
            )}
            <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
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
  const user = useMostFreshUser('tableau de bord index')!;
  const navigate = useNavigate();
  const nothingToShow = !children || React.Children.toArray(children).length === 0;

  if (nothingToShow) {
    return (
      <div className="fr-container">
        <div className="fr-my-7w fr-mt-md-12w fr-mb-md-10w fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-grid-row--center bg-white p-4 md:p-8">
          <div className="fr-py-0 fr-col-12 fr-col-md-6">
            <h1 className="fr-h4">Vous n'avez pas encore de fiche</h1>
            {user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei ? (
              <>
                <p className="fr-text--regular fr-mb-3w">
                  Vous pouvez créer une nouvelle fiche en cliquant sur le bouton ci-dessous.
                </p>
                <Button
                  priority="primary"
                  iconId="fr-icon-add-circle-line"
                  onClick={async () => {
                    const newFei = await createNewFei();
                    navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                  }}
                >
                  Créer une fiche
                </Button>
              </>
            ) : (
              <p className="fr-text--lead fr-mb-3w">Veuillez patienter, Zach'arrive&nbsp;!</p>
            )}
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
              (c) => c?.type === CarcasseType.PETIT_GIBIER && c.espece === espece,
            );
            if (carcasse) {
              const nombreDAnimaux = carcasse.nombre_d_animaux ?? 0;
              const intermediaires = filterCarcassesIntermediairesForCarcasse(carcassesIntermediaireById, carcasse.zacharie_carcasse_id!);
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
      onClick={() => navigate(`/app/tableau-de-bord/fei/${fei.numero}`)}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
            <Tag small className="items-center rounded-[4px] font-semibold uppercase">
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
                <p className="m-0 text-sm" key={carcasse + index}>
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
    (child): child is React.ReactElement => React.isValidElement(child) && child.type === CardFiche,
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
