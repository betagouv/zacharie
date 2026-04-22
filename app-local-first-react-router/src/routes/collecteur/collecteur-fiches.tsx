import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import dayjs from 'dayjs';
import { CarcasseType, DepotType } from '@prisma/client';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { SegmentedControl } from '@codegouvfr/react-dsfr/SegmentedControl';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { UserConnexionResponse } from '@api/src/types/responses';
import { FeiStepSimpleStatus } from '@app/types/fei-steps';
import useZustandStore, { syncData } from '@app/zustand/store';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { abbreviations } from '@app/utils/count-carcasses';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { useMostFreshUser, refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getFeisSorted } from '@app/utils/get-fei-sorted';
import { loadFeis } from '@app/utils/load-feis';
import { loadMyRelations } from '@app/utils/load-my-relations';
import useExportFeis from '@app/utils/export-feis';
import {
  filterCarcassesIntermediairesForCarcasse,
  filterFeiIntermediaires,
} from '@app/utils/get-carcasses-intermediaires';
import { filterCarcassesForFei, useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useSaveScroll } from '@app/services/useSaveScroll';
import CardFiche from '@app/components/CardFiche';
import DropDownMenu from '@app/components/DropDownMenu';

import { useFeiSteps, computeFeiSteps } from '@app/utils/fei-steps';
import { useLocalStorage } from '@uidotdev/usehooks';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';

async function loadData() {
  // FIXME: await syncData is useless, as syncData queues stuff - so there will be bugs
  await syncData('collecteur-fiches');
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

export default function CollecteurFiches() {
  const user = useMostFreshUser('collecteur-fiches')!;
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
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('collecteur-fiches-items-per-page', 20);

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
    refreshUser('collecteur-fiches').then(loadData);
  }, []);

  useSaveScroll('collecteur-fiches-scrollY');

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

  const [filter, setFilter] = useState<FeiStepSimpleStatus[]>(() => {
    const savedFilter = localStorage.getItem('collecteur-fiches-filter');
    if (savedFilter) {
      try {
        const parsed = JSON.parse(savedFilter);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  const toggleFilter = (status: FeiStepSimpleStatus) => {
    setFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  useEffect(() => {
    localStorage.setItem('collecteur-fiches-filter', JSON.stringify(filter));
  }, [filter]);

  const [viewType, setViewType] = useState<ViewType>(() => {
    const savedViewType = localStorage.getItem('collecteur-fiches-view-type');
    if (savedViewType === 'grid' || savedViewType === 'table') {
      return savedViewType as ViewType;
    }
    return 'grid';
  });

  useEffect(() => {
    localStorage.setItem('collecteur-fiches-view-type', viewType);
  }, [viewType]);

  const dropDownMenuFilterText = useMemo(() => {
    if (filter.length === 0) return 'Filtrer par statut';
    if (filter.length === 1) {
      const labels: Record<FeiStepSimpleStatus, string> = {
        'À compléter': 'Fiches à compléter',
        'En cours': 'Fiches en cours',
        Clôturée: 'Fiches clôturées',
      };
      return labels[filter[0]];
    }
    return `${filter.length} statuts sélectionnés`;
  }, [filter]);

  const [filterPremierDetenteur, setFilterPremierDetenteur] = useLocalStorage<string>(
    'collecteur-fiches-filter-premier-detenteur',
    ''
  );
  const [filterCCG, setFilterCCG] = useLocalStorage<string>('collecteur-fiches-filter-ccg', '');

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

  const dropDownMenuFilterTextPremierDetenteur = useMemo(() => {
    if (filterPremierDetenteur) {
      const option = premierDetenteurOptions.find((o) => o.id === filterPremierDetenteur);
      if (option) return option.name;
    }
    return 'Filtrer par premier détenteur';
  }, [filterPremierDetenteur, premierDetenteurOptions]);

  const dropDownMenuFilterTextCCG = useMemo(() => {
    if (filterCCG) {
      const option = ccgOptions.find((o) => o.id === filterCCG);
      if (option) return option.name;
    }
    return 'Filtrer par CCG';
  }, [filterCCG, ccgOptions]);

  const filteredFeis = useMemo(() => {
    let feis = allFeis;
    if (filter.length > 0) {
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
        return filter.includes(simpleStatus);
      });
    }
    if (filterPremierDetenteur) {
      feis = feis.filter(
        (fei) =>
          fei.premier_detenteur_user_id === filterPremierDetenteur ||
          fei.premier_detenteur_entity_id === filterPremierDetenteur
      );
    }
    if (filterCCG) {
      feis = feis.filter((fei) => fei.premier_detenteur_depot_entity_id === filterCCG);
    }
    return feis;
  }, [
    allFeis,
    filter,
    filterPremierDetenteur,
    filterCCG,
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

  function Actions() {
    return (
      <div className="flex flex-col gap-2 py-2 md:gap-3 md:py-3">
        <div className="flex flex-col justify-between gap-1.5 md:flex-row md:gap-2">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <DropDownMenu
              text={dropDownMenuFilterText}
              isActive={filter.length > 0}
              className="w-full md:w-auto"
              menuLinks={[
                {
                  linkProps: {
                    href: '#',
                    title: 'Toutes les fiches',
                    onClick: (e) => {
                      e.preventDefault();
                      setFilter([]);
                    },
                  },
                  text: 'Toutes les fiches',
                  isActive: filter.length === 0,
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches à compléter',
                    onClick: (e) => {
                      e.preventDefault();
                      toggleFilter('À compléter');
                    },
                  },
                  text: 'Fiches à compléter',
                  isActive: filter.includes('À compléter'),
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches en cours',
                    onClick: (e) => {
                      e.preventDefault();
                      toggleFilter('En cours');
                    },
                  },
                  text: 'Fiches en cours',
                  isActive: filter.includes('En cours'),
                },
                {
                  linkProps: {
                    href: '#',
                    title: 'Fiches clôturées',
                    onClick: (e) => {
                      e.preventDefault();
                      toggleFilter('Clôturée');
                    },
                  },
                  text: 'Fiches clôturées',
                  isActive: filter.includes('Clôturée'),
                },
              ]}
            />
            {premierDetenteurOptions.length > 1 && (
              <DropDownMenu
                text={dropDownMenuFilterTextPremierDetenteur}
                isActive={!!filterPremierDetenteur}
                className="w-full md:w-auto"
                menuLinks={[
                  {
                    linkProps: {
                      href: '#',
                      title: 'Tous les premiers détenteurs',
                      onClick: (e) => {
                        e.preventDefault();
                        setFilterPremierDetenteur('');
                      },
                    },
                    text: 'Tous les premiers détenteurs',
                    isActive: !filterPremierDetenteur,
                  },
                  ...premierDetenteurOptions.map((option) => ({
                    linkProps: {
                      href: '#',
                      title: option.name,
                      onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                        e.preventDefault();
                        setFilterPremierDetenteur(option.id);
                      },
                    },
                    text: option.name,
                    isActive: filterPremierDetenteur === option.id,
                  })),
                ]}
              />
            )}
            {ccgOptions.length > 1 && (
              <DropDownMenu
                text={dropDownMenuFilterTextCCG}
                isActive={!!filterCCG}
                className="w-full md:w-auto"
                menuLinks={[
                  {
                    linkProps: {
                      href: '#',
                      title: 'Tous les CCG',
                      onClick: (e) => {
                        e.preventDefault();
                        setFilterCCG('');
                      },
                    },
                    text: 'Tous les CCG',
                    isActive: !filterCCG,
                  },
                  ...ccgOptions.map((option) => ({
                    linkProps: {
                      href: '#',
                      title: option.name,
                      onClick: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                        e.preventDefault();
                        setFilterCCG(option.id);
                      },
                    },
                    text: option.name,
                    isActive: filterCCG === option.id,
                  })),
                ]}
              />
            )}

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
                    linkTo={`/app/collecteur/fei/${fei.numero}`}
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
                    to: `/app/collecteur/fei?page=${pageNumber}`,
                  })}
                />
              </div>
            )}
            <div className="my-4 flex flex-col items-start justify-between gap-4 px-8">
              <a
                className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4"
                href="#top"
              >
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
      onClick={() => navigate(`/app/collecteur/fei/${fei.numero}`)}
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
