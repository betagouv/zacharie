import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import dayjs from 'dayjs';
import { DepotType, FeiOwnerRole } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import TableFilterable from '@app/components/TableFilterable';
import CollapsibleSection from '@app/components/CollapsibleSection';
import CarcassesEspeceSummary from '@app/components/CarcassesEspeceSummary';
import { useSaveScroll } from '@app/services/useSaveScroll';
import { CarcasseStatusLabel, getCarcasseStatusLabel } from '@app/utils/get-carcasse-status';
import Filters from '@app/components/Filters';
import {
  CarcasseFilter,
  carcasseFilterableFields,
  filterCarcassesInRegistre,
} from '@app/utils/filter-carcasse';
import { useLocalStorage } from '@uidotdev/usehooks';
import Chargement from '@app/components/Chargement';
import DropDownMenu from '@app/components/DropDownMenu';
import useExportCarcasses from '@app/utils/export-carcasses';
import { isCarcasseSviArchived } from '@app/utils/carcasse-svi-archived';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { useTransmissions } from '@app/utils/get-transmissions-sorted';
import { getSaisonStartYear, getSaisonLabel, isDateInSaison } from '@app/utils/get-saison';
import { trackFeature, trackSearch } from '@app/services/matomo';
import type { Carcasse } from '@prisma/client';
import type { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import { getTransmissionId, getTransmissionLinkFromCarcasse } from '@app/utils/get-transmission-id';

const advancedFiltersModal = createModal({
  id: 'svi-carcasses-advanced-filters',
  isOpenedByDefault: false,
});

const columnsModal = createModal({
  id: 'svi-carcasses-columns',
  isOpenedByDefault: false,
});

const FEI_STATUS_OPTIONS: Array<TransmissionSimpleStatus> = ['À compléter', 'Clôturée'];

const feiStatusColors: Record<TransmissionSimpleStatus, { bg: string; text: string }> = {
  'À compléter': { bg: 'bg-[#FEE7FC]', text: 'text-[#6E445A]' },
  Clôturée: { bg: 'bg-[#E8EDFF]', text: 'text-[#01008B]' },
};

const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'numero_bracelet',
  'premier_detenteur_name_cache',
  'svi_assigned_at',
  'svi_carcasse_status',
  'svi_carcasse_archived',
  'svi_carcasse_status_set_at',
  'fei_numero',
];
const itemsPerPageOptions = [20, 50, 100, 200, 1000];

type CatalogColumn = {
  key: string;
  label: string;
  alwaysVisible?: boolean;
  dataKey: keyof Carcasse | string;
  title: string;
  type?: 'date' | 'datetime' | 'number' | 'string';
  sortable?: boolean;
  small?: boolean;
  render?: (item: Carcasse, index: number) => React.ReactNode;
};

// Métadonnées dérivées d'une transmission, mises en cache par transmissionId pour filtrer les carcasses.
type TransmissionMeta = {
  simpleStatus: TransmissionSimpleStatus;
  premierDetenteurId: string;
  ccgId: string;
  ccgName: string;
  collecteurIds: Array<string>;
  etgIds: Array<string>;
};

export default function SviCarcasses() {
  const user = useMostFreshUser('svi-carcasses')!;
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const transmissions = useTransmissions();
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const usersById = useZustandStore((state) => state.users);
  const [selectedCarcassesIds, setSelectedCarcassesIds] = useState<Array<string>>([]);
  const [loading, setLoading] = useState(true);

  const { onExportToXlsx, isExporting } = useExportCarcasses();

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');

  const [sortBy, setSortBy] = useLocalStorage<keyof (typeof carcassesRegistry)[number]>(
    'svi-carcasses-sort-by',
    'numero_bracelet'
  );
  const [sortOrder, setSortOrder] = useLocalStorage<'ASC' | 'DESC'>('svi-carcasses-sort-order', 'ASC');

  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('svi-carcasses-items-per-page', 50);
  const [filters, setFilters] = useLocalStorage<Array<CarcasseFilter>>('svi-carcasses-filters-preset', []);

  const handleSortBy: typeof setSortBy = (value) => {
    trackFeature('registre-svi-carcasses', 'tri');
    setSortBy(value);
  };
  const handleFiltersChange: typeof setFilters = (value) => {
    trackFeature('registre-svi-carcasses', 'filtre', 'avance');
    setFilters(value);
  };

  const [quickFilterBracelet, setQuickFilterBracelet] = useState('');
  const [filterStatuses, setFilterStatuses] = useLocalStorage<Array<TransmissionSimpleStatus>>(
    'svi-carcasses-filter-statuses',
    []
  );
  const [filterSaisons, setFilterSaisons] = useLocalStorage<Array<number>>(
    'svi-carcasses-filter-saisons',
    []
  );
  const [filterDateFrom, setFilterDateFrom] = useLocalStorage<string>('svi-carcasses-filter-date-from', '');
  const [filterDateTo, setFilterDateTo] = useLocalStorage<string>('svi-carcasses-filter-date-to', '');
  const [filterPremierDetenteurs, setFilterPremierDetenteurs] = useLocalStorage<Array<string>>(
    'svi-carcasses-filter-premier-detenteurs',
    []
  );
  const [filterEtgs, setFilterEtgs] = useLocalStorage<Array<string>>('svi-carcasses-filter-etgs', []);
  const [filterCCGs, setFilterCCGs] = useLocalStorage<Array<string>>('svi-carcasses-filter-ccgs', []);
  const [filterCollecteurs, setFilterCollecteurs] = useLocalStorage<Array<string>>(
    'svi-carcasses-filter-collecteurs',
    []
  );
  const [filterEspeces, setFilterEspeces] = useLocalStorage<Array<string>>(
    'svi-carcasses-filter-especes',
    []
  );
  const [filterStatutsCarcasse, setFilterStatutsCarcasse] = useLocalStorage<Array<CarcasseStatusLabel>>(
    'svi-carcasses-filter-statuts-carcasse',
    []
  );

  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorage<Array<string>>(
    'svi-carcasses-visible-columns',
    DEFAULT_VISIBLE_COLUMN_KEYS
  );

  const filtersKey = [
    quickFilterBracelet,
    filterStatuses.join(','),
    filterSaisons.join(','),
    filterDateFrom,
    filterDateTo,
    filterPremierDetenteurs.join(','),
    filterEtgs.join(','),
    filterCCGs.join(','),
    filterCollecteurs.join(','),
    filterEspeces.join(','),
    filterStatutsCarcasse.join(','),
    JSON.stringify(filters),
    itemsPerPage,
  ].join('|');

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

  const {
    filterableFields,
    collecteursNamesByFeiNumero,
    premierDetenteurOptions,
    etgOptions,
    ccgOptions,
    collecteurOptions,
    especeOptions,
    statusOptions,
    saisonOptions,
    filteredData,
  } = useMemo(() => {
    // métadonnées de transmission mises en cache par transmissionId
    const metaByTransmissionId: Record<string, TransmissionMeta> = {};
    const getMeta = (carcasse: Carcasse): TransmissionMeta => {
      const transmissionId = getTransmissionId(carcasse);
      const cached = metaByTransmissionId[transmissionId];
      if (cached) return cached;
      const transmission = transmissions[transmissionId];
      const collecteurIds: Array<string> = [];
      const etgIds: Array<string> = [];
      for (const intermediaire of transmission?.intermediaires ?? []) {
        const id = intermediaire.intermediaire_entity_id || intermediaire.intermediaire_user_id;
        if (!id) continue;
        if (intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO && !collecteurIds.includes(id)) {
          collecteurIds.push(id);
        }
        if (intermediaire.intermediaire_role === FeiOwnerRole.ETG && !etgIds.includes(id)) {
          etgIds.push(id);
        }
      }
      const content = transmission?.content;
      const ccgId =
        content?.premier_detenteur_depot_type === DepotType.CCG
          ? content?.premier_detenteur_depot_entity_id || ''
          : '';
      const meta: TransmissionMeta = {
        simpleStatus: transmission?.labels.simpleStatus ?? '',
        premierDetenteurId: content?.premier_detenteur_entity_id || content?.premier_detenteur_user_id || '',
        ccgId,
        ccgName: content?.premier_detenteur_depot_entity_name_cache || ccgId,
        collecteurIds,
        etgIds,
      };
      metaByTransmissionId[transmissionId] = meta;
      return meta;
    };

    const collecteurNameById = (id: string): string => {
      const entity = entities[id];
      const userOnly = usersById[id];
      return (
        entity?.nom_d_usage ||
        entity?.raison_sociale ||
        (userOnly ? `${userOnly.prenom ?? ''} ${userOnly.nom_de_famille ?? ''}`.trim() : '') ||
        id
      );
    };
    const etgNameById = (id: string): string => {
      const entity = entities[id];
      return entity?.nom_d_usage || entity?.raison_sociale || id;
    };

    const _premierDetenteurOptions = new Map<string, string>();
    const _etgOptions = new Map<string, string>();
    const _ccgOptions = new Map<string, string>();
    const _collecteurOptions = new Map<string, string>();
    const _especeOptions = new Set<string>();
    // @ts-expect-error Type '{}' is missing the following properties
    const _statusOptions: Record<CarcasseStatusLabel, boolean> = {};
    const _saisonYears = new Set<number>();
    const _motifs = new Set<string>();
    const _ccgNames = new Set<string>();
    const _collecteursNamesByFeiNumero: Record<Carcasse['fei_numero'], string> = {};

    // 1re passe : on construit la liste des options de filtres à partir de toutes les carcasses
    for (const carcasse of carcassesRegistry) {
      const meta = getMeta(carcasse);
      if (!_collecteursNamesByFeiNumero[carcasse.fei_numero]) {
        _collecteursNamesByFeiNumero[carcasse.fei_numero] =
          meta.collecteurIds.map(collecteurNameById).join(', ') || ' - ';
        if (meta.premierDetenteurId && carcasse.premier_detenteur_name_cache) {
          _premierDetenteurOptions.set(meta.premierDetenteurId, carcasse.premier_detenteur_name_cache);
        }
        if (meta.ccgId) {
          _ccgOptions.set(meta.ccgId, meta.ccgName);
          _ccgNames.add(meta.ccgName);
        }
        for (const id of meta.collecteurIds) _collecteurOptions.set(id, collecteurNameById(id));
        for (const id of meta.etgIds) _etgOptions.set(id, etgNameById(id));
      }
      if (carcasse.espece) _especeOptions.add(carcasse.espece);
      for (const motif of carcasse.svi_ipm2_lesions_ou_motifs) {
        if (motif) _motifs.add(motif);
      }
      _statusOptions[getCarcasseStatusLabel(carcasse)] = true;
      if (carcasse.date_mise_a_mort) _saisonYears.add(getSaisonStartYear(carcasse.date_mise_a_mort));
    }

    const braceletQuery = quickFilterBracelet.trim().toLowerCase();
    const withStatuses = filterStatuses.length > 0;
    const withSaisons = filterSaisons.length > 0;
    const withPremierDetenteurs = filterPremierDetenteurs.length > 0;
    const withEtgs = filterEtgs.length > 0;
    const withCCGs = filterCCGs.length > 0;
    const withCollecteurs = filterCollecteurs.length > 0;
    const withEspeces = filterEspeces.length > 0;
    const withStatutsCarcasse = filterStatutsCarcasse.length > 0;
    const withDate = Boolean(filterDateFrom || filterDateTo);

    // 2e passe : on filtre
    const _filteredData: Array<Carcasse> = [];
    for (const carcasse of carcassesRegistry) {
      if (braceletQuery && !carcasse.numero_bracelet?.toLowerCase().includes(braceletQuery)) continue;
      const meta = getMeta(carcasse);
      if (withStatuses && !filterStatuses.includes(meta.simpleStatus)) continue;
      if (withPremierDetenteurs && !filterPremierDetenteurs.includes(meta.premierDetenteurId)) continue;
      if (withEtgs && !meta.etgIds.some((id) => filterEtgs.includes(id))) continue;
      if (withCCGs && !filterCCGs.includes(meta.ccgId)) continue;
      if (withCollecteurs && !meta.collecteurIds.some((id) => filterCollecteurs.includes(id))) continue;
      if (withSaisons) {
        if (!carcasse.date_mise_a_mort) continue;
        if (!filterSaisons.some((saison) => isDateInSaison(carcasse.date_mise_a_mort!, saison))) continue;
      }
      if (withDate) {
        if (!carcasse.date_mise_a_mort) continue;
        const d = dayjs(carcasse.date_mise_a_mort).format('YYYY-MM-DD');
        if (filterDateFrom && d < filterDateFrom) continue;
        if (filterDateTo && d > filterDateTo) continue;
      }
      if (!filterCarcassesInRegistre(filters)(carcasse, feis[carcasse.fei_numero]!)) continue;
      if (withEspeces && carcasse.espece && !filterEspeces.includes(carcasse.espece)) continue;
      if (withStatutsCarcasse && !filterStatutsCarcasse.includes(getCarcasseStatusLabel(carcasse))) continue;
      _filteredData.push(carcasse);
    }

    _filteredData.sort((a, b) => {
      const aValue =
        // @ts-expect-error: svi_carcasse_archived is isCarcasseSviArchived
        sortBy === 'svi_carcasse_archived'
          ? isCarcasseSviArchived(a)
          : // @ts-expect-error: we know that the field is in the carcasse or the fei
            a[sortBy] || feis[a.fei_numero]![sortBy];
      const bValue =
        // @ts-expect-error: svi_carcasse_archived is isCarcasseSviArchived
        sortBy === 'svi_carcasse_archived'
          ? isCarcasseSviArchived(b)
          : // @ts-expect-error: svi_carcasse_archived is isCarcasseSviArchived
            b[sortBy] || feis[b.fei_numero]![sortBy];
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

    const toOptions = (map: Map<string, string>) =>
      Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
      filterableFields: carcasseFilterableFields(
        Array.from(_motifs).sort(),
        Array.from(_etgOptions.values()).sort(),
        Array.from(_ccgNames).sort()
      ),
      collecteursNamesByFeiNumero: _collecteursNamesByFeiNumero,
      premierDetenteurOptions: toOptions(_premierDetenteurOptions),
      etgOptions: toOptions(_etgOptions),
      ccgOptions: toOptions(_ccgOptions),
      collecteurOptions: toOptions(_collecteurOptions),
      especeOptions: Array.from(_especeOptions).sort(),
      statusOptions: _statusOptions,
      saisonOptions: Array.from(_saisonYears)
        .sort((a, b) => b - a)
        .map((year) => ({ year, label: getSaisonLabel(year) })),
      filteredData: _filteredData,
    };
  }, [
    quickFilterBracelet,
    filterStatuses,
    filterSaisons,
    filterDateFrom,
    filterDateTo,
    filterPremierDetenteurs,
    filterEtgs,
    filterCCGs,
    filterCollecteurs,
    filterEspeces,
    filterStatutsCarcasse,
    carcassesRegistry,
    filters,
    feis,
    transmissions,
    entities,
    usersById,
    sortBy,
    sortOrder,
  ]);

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

  useLoaderEffect(() => {
    setLoading(true);
    loadData('svi-carcasses').then(() => setLoading(false));
  }, []);

  useSaveScroll('svi-carcasses-scrollY');

  const allColumns: Array<CatalogColumn> = [
    {
      key: 'row_index',
      label: 'Numéro de ligne',
      alwaysVisible: true,
      dataKey: 'zacharie_carcasse_id',
      title: '',
      small: true,
      render: (_carcasse, index) => <>{(page - 1) * itemsPerPage + index + 1}</>,
    },
    {
      key: 'numero_bracelet',
      label: 'Identification (marquage + espèce)',
      alwaysVisible: true,
      dataKey: 'numero_bracelet',
      title: 'Identification',
      sortable: true,
      render: (carcasse) => (
        <div className="flex flex-col items-start">
          <Link
            to={`/app/svi/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
            className="mr-auto block"
          >
            {carcasse.numero_bracelet}
          </Link>
          <small className="text-xs text-gray-400">{carcasse.espece}</small>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Catégorie de gibier',
      dataKey: 'type',
      title: 'Catégorie',
      sortable: true,
      render: (carcasse) => (carcasse.type === 'GROS_GIBIER' ? 'Grand gibier' : 'Petit gibier'),
    },
    {
      key: 'nombre_d_animaux',
      label: 'Nombre d’animaux',
      dataKey: 'nombre_d_animaux',
      title: 'Nb animaux',
      type: 'number',
      sortable: true,
    },
    {
      key: 'date_mise_a_mort',
      label: 'Date de mise à mort',
      dataKey: 'date_mise_a_mort',
      title: 'Date mise à mort',
      type: 'date',
      sortable: true,
    },
    {
      key: 'commune_mise_a_mort',
      label: 'Commune de mise à mort',
      dataKey: 'commune_mise_a_mort',
      title: 'Commune',
      sortable: true,
    },
    {
      key: 'heure_mise_a_mort',
      label: 'Heure de mise à mort',
      dataKey: 'heure_mise_a_mort',
      title: 'Heure mise à mort',
    },
    {
      key: 'heure_evisceration',
      label: 'Heure d’éviscération',
      dataKey: 'heure_evisceration',
      title: 'Heure éviscération',
    },
    {
      key: 'premier_detenteur_name_cache',
      label: 'Premier détenteur',
      dataKey: 'premier_detenteur_name_cache',
      title: 'Premier détenteur',
      sortable: true,
    },
    {
      key: 'premier_detenteur_depot_entity_name_cache',
      label: 'Centre de collecte (CCG)',
      dataKey: 'premier_detenteur_depot_entity_name_cache',
      title: 'CCG',
      sortable: true,
    },
    {
      key: 'collecteur',
      label: 'Collecteur',
      dataKey: 'collecteur',
      title: 'Collecteur',
      render: (carcasse) => collecteursNamesByFeiNumero[carcasse.fei_numero] ?? '-',
    },
    {
      key: 'examinateur_initial_date_approbation_mise_sur_le_marche',
      label: 'Date d’approbation de la mise sur le marché',
      dataKey: 'examinateur_initial_date_approbation_mise_sur_le_marche',
      title: 'Date approbation marché',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'svi_assigned_at',
      label: 'Date de transmission au SVI',
      dataKey: 'svi_assigned_at',
      title: 'Date transmission SVI',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'latest_intermediaire_signed_at',
      label: 'Date dernière décision destinataire',
      dataKey: 'latest_intermediaire_signed_at',
      title: 'Date dernière décision dest.',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'intermediaire_carcasse_refus_motif',
      label: 'Motif de refus d’un destinataire',
      dataKey: 'intermediaire_carcasse_refus_motif',
      title: 'Motif de refus dest.',
    },
    {
      key: 'svi_carcasse_status',
      label: 'Statut SVI',
      dataKey: 'svi_carcasse_status',
      title: 'Statut',
      sortable: true,
      render: (carcasse) => getCarcasseStatusLabel(carcasse),
    },
    {
      key: 'svi_carcasse_status_set_at',
      label: 'Date de décision SVI',
      dataKey: 'svi_carcasse_status_set_at',
      title: 'Date décision SVI',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'svi_carcasse_archived',
      label: 'Carcasse archivée',
      dataKey: 'svi_carcasse_archived',
      title: 'Archivé(e)',
      sortable: true,
      render: (carcasse) => (isCarcasseSviArchived(carcasse) ? 'Oui' : 'Non'),
    },
    {
      key: 'svi_carcasse_commentaire',
      label: 'Commentaire SVI',
      dataKey: 'svi_carcasse_commentaire',
      title: 'Commentaire SVI',
    },
    {
      key: 'svi_ipm1_decision',
      label: 'Décision IPM1',
      dataKey: 'svi_ipm1_decision',
      title: 'Décision IPM1',
    },
    {
      key: 'svi_ipm1_lesions_ou_motifs',
      label: 'Lésions / motifs IPM1',
      dataKey: 'svi_ipm1_lesions_ou_motifs',
      title: 'Motifs IPM1',
      render: (carcasse) => (carcasse.svi_ipm1_lesions_ou_motifs ?? []).filter(Boolean).join(', ') || '-',
    },
    {
      key: 'svi_ipm2_decision',
      label: 'Décision IPM2',
      dataKey: 'svi_ipm2_decision',
      title: 'Décision IPM2',
    },
    {
      key: 'svi_ipm2_lesions_ou_motifs',
      label: 'Lésions / motifs IPM2',
      dataKey: 'svi_ipm2_lesions_ou_motifs',
      title: 'Motifs IPM2',
      render: (carcasse) => (carcasse.svi_ipm2_lesions_ou_motifs ?? []).filter(Boolean).join(', ') || '-',
    },
    {
      key: 'svi_closed_at',
      label: 'Date de clôture de la fiche',
      dataKey: 'svi_closed_at',
      title: 'Date clôture fiche',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'fei_numero',
      label: 'Numéro de fiche',
      dataKey: 'fei_numero',
      title: 'Numéro de fiche',
      sortable: true,
      render: (carcasse) => (
        <Link to={`/app/svi/fei/${getTransmissionLinkFromCarcasse(carcasse)}`}>{carcasse.fei_numero}</Link>
      ),
    },
  ];

  const columnsByKey: Record<string, CatalogColumn> = {};
  for (const c of allColumns) {
    columnsByKey[c.key] = c;
  }

  const alwaysVisibleColumns = allColumns.filter((c) => c.alwaysVisible);
  const toggleableColumns = allColumns.filter((c) => !c.alwaysVisible);

  const orderedVisibleToggleableColumns = visibleColumnKeys
    .map((k) => columnsByKey[k])
    .filter((c): c is CatalogColumn => Boolean(c) && !c.alwaysVisible);

  const hiddenColumns = toggleableColumns.filter((c) => !visibleColumnKeys.includes(c.key));

  const visibleColumns = [...alwaysVisibleColumns, ...orderedVisibleToggleableColumns];

  const moveVisibleColumn = (key: string, direction: -1 | 1) => {
    const idx = visibleColumnKeys.indexOf(key);
    if (idx === -1) return;
    const next = idx + direction;
    if (next < 0 || next >= visibleColumnKeys.length) return;
    const newKeys = [...visibleColumnKeys];
    [newKeys[idx], newKeys[next]] = [newKeys[next], newKeys[idx]];
    setVisibleColumnKeys(newKeys);
  };

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isAdvancedFiltersModalOpen, setIsAdvancedFiltersModalOpen] = useState(false);
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  useIsModalOpen(advancedFiltersModal, {
    onDisclose: () => setIsAdvancedFiltersModalOpen(true),
    onConceal: () => setIsAdvancedFiltersModalOpen(false),
  });
  useIsModalOpen(columnsModal, {
    onDisclose: () => setIsColumnsModalOpen(true),
    onConceal: () => setIsColumnsModalOpen(false),
  });

  const openAdvancedFiltersModal = () => {
    setIsAdvancedFiltersModalOpen(true);
    advancedFiltersModal.open();
  };
  const openColumnsModal = () => {
    setIsColumnsModalOpen(true);
    columnsModal.open();
  };

  const activeFilterCount =
    (quickFilterBracelet.trim() ? 1 : 0) +
    filterStatuses.length +
    filterSaisons.length +
    (filterDateFrom || filterDateTo ? 1 : 0) +
    filterPremierDetenteurs.length +
    filterEtgs.length +
    filterCCGs.length +
    filterCollecteurs.length +
    filterEspeces.length +
    filterStatutsCarcasse.length +
    filters.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    trackFeature('registre-svi-carcasses', 'filtre-reset');
    setQuickFilterBracelet('');
    setFilterStatuses([]);
    setFilterSaisons([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterPremierDetenteurs([]);
    setFilterEtgs([]);
    setFilterCCGs([]);
    setFilterCollecteurs([]);
    setFilterEspeces([]);
    setFilterStatutsCarcasse([]);
    setFilters([]);
  };

  const toggleInArray = <T,>(array: Array<T>, value: T): Array<T> =>
    array.includes(value) ? array.filter((v) => v !== value) : [...array, value];

  const sidebarContent = (
    <>
      <div className="relative">
        <span
          className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher un marquage..."
          value={quickFilterBracelet}
          onChange={(e) => {
            setQuickFilterBracelet(e.target.value);
            trackSearch('registre-svi-carcasses');
          }}
          className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mt-2 flex items-center justify-between border-b border-gray-200 pb-3">
        <span className="text-sm font-medium text-gray-600">
          {filteredData.length} carcasse{filteredData.length > 1 ? 's' : ''}
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
      {/* Filtre Espèce */}
      {especeOptions.length > 1 && (
        <CollapsibleSection
          title="Espèce"
          defaultOpen={false}
          badge={
            filterEspeces.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterEspeces.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {especeOptions.map((espece) => (
              <label
                key={espece}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterEspeces.includes(espece)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    trackFeature('registre-svi-carcasses', 'filtre', 'espece');
                    setFilterEspeces(toggleInArray(filterEspeces, espece));
                  }}
                />
                <span className="truncate text-sm">{espece}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}
      {/* Filtre Statut carcasse */}
      <CollapsibleSection
        title="Statut carcasse"
        defaultOpen={false}
        badge={
          filterStatutsCarcasse.length > 0 ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              {filterStatutsCarcasse.length}
            </span>
          ) : undefined
        }
      >
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {/* @ts-expect-error Type '{}' is missing the following properties */}
          {Object.keys(statusOptions).map((status: CarcasseStatusLabel) => (
            <label
              key={status}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={filterStatutsCarcasse.includes(status)}
                className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                onChange={() => {
                  trackFeature('registre-svi-carcasses', 'filtre', 'statut-carcasse');
                  setFilterStatutsCarcasse(toggleInArray(filterStatutsCarcasse, status));
                }}
              />
              <span className="truncate text-sm">{status}</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Filtre Statut fiche */}
      <CollapsibleSection
        title="Statut fiche"
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
          {FEI_STATUS_OPTIONS.map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={filterStatuses.includes(status)}
                className="checked:accent-action-high-blue-france h-4 w-4"
                onChange={() => {
                  trackFeature('registre-svi-carcasses', 'filtre', 'statut');
                  setFilterStatuses(toggleInArray(filterStatuses, status));
                }}
              />
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${feiStatusColors[status].bg} ${feiStatusColors[status].text}`}
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
                    trackFeature('registre-svi-carcasses', 'filtre', 'saison');
                    setFilterSaisons(toggleInArray(filterSaisons, option.year));
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
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                trackFeature('registre-svi-carcasses', 'filtre', 'date-mise-a-mort');
              }}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700">Au</span>
            <input
              type="date"
              value={filterDateTo}
              min={filterDateFrom || undefined}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                trackFeature('registre-svi-carcasses', 'filtre', 'date-mise-a-mort');
              }}
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
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
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
                    trackFeature('registre-svi-carcasses', 'filtre', 'premier-detenteur');
                    setFilterPremierDetenteurs(toggleInArray(filterPremierDetenteurs, option.id));
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Filtre ETG */}
      {etgOptions.length > 1 && (
        <CollapsibleSection
          title="ETG"
          defaultOpen={false}
          badge={
            filterEtgs.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterEtgs.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {etgOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterEtgs.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    trackFeature('registre-svi-carcasses', 'filtre', 'etg');
                    setFilterEtgs(toggleInArray(filterEtgs, option.id));
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
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
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
                    trackFeature('registre-svi-carcasses', 'filtre', 'ccg');
                    setFilterCCGs(toggleInArray(filterCCGs, option.id));
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
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
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
                    trackFeature('registre-svi-carcasses', 'filtre', 'collecteur');
                    setFilterCollecteurs(toggleInArray(filterCollecteurs, option.id));
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Filtres avancés */}
      <div className="border-b border-gray-200 py-2">
        <div className="flex w-full items-center justify-between py-1 text-sm font-bold text-gray-800">
          <span className="flex items-center gap-2">
            Filtres avancés
            {filters.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filters.length}
              </span>
            )}
          </span>
        </div>
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {filters.map((f, idx) => {
              const fieldDef = filterableFields.find((ff) => ff.name === f.field);
              const fieldLabel = fieldDef?.label || f.label || f.field || 'Filtre incomplet';
              return (
                <span
                  key={`${f.field}-${idx}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                >
                  <span className="truncate">{fieldLabel}</span>
                  <button
                    type="button"
                    aria-label={`Retirer le filtre ${fieldLabel}`}
                    className="leading-none text-gray-500 hover:text-gray-800"
                    onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50"
          onClick={openAdvancedFiltersModal}
        >
          <span
            className="fr-icon--sm fr-icon-add-line"
            aria-hidden="true"
          />
          {filters.length === 0 ? 'Ajouter un filtre avancé' : 'Modifier les filtres avancés'}
        </button>
      </div>
    </>
  );

  const renderMobileCarcasse = (carcasse: (typeof carcassesRegistry)[number]) => {
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
                      selectedCarcassesIds.filter((id) => id !== carcasse.zacharie_carcasse_id)
                    );
                  }
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1">
                  <Link
                    to={`/app/svi/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
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
                <span>{feis[carcasse.fei_numero]?.premier_detenteur_name_cache || '-'}</span>
              </div>
              <div>
                <span className="font-semibold">Statut: </span>
                <span>{getCarcasseStatusLabel(carcasse)}</span>
              </div>
              <div>
                <span className="font-semibold">Date transmission SVI: </span>
                <span>
                  {carcasse.svi_assigned_at
                    ? new Date(carcasse.svi_assigned_at).toLocaleDateString('fr-FR', {
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
                <span>{isCarcasseSviArchived(carcasse) ? 'Oui' : 'Non'}</span>
              </div>
              <div>
                <span className="font-semibold">Fiche: </span>
                <Link
                  to={`/app/svi/fei/${getTransmissionLinkFromCarcasse(carcasse)}`}
                  className="text-blue-600 hover:underline"
                >
                  {carcasse.fei_numero}
                </Link>
              </div>
              {collecteursNamesByFeiNumero[carcasse.fei_numero] && (
                <div>
                  <span className="font-semibold">Collecteur: </span>
                  <span>{collecteursNamesByFeiNumero[carcasse.fei_numero]}</span>
                </div>
              )}
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
    <div className="relative">
      <title>
        Registre de carcasses | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>

      <div className="fr-background-alt--blue-france sticky top-0 z-30 flex items-center justify-between px-4 py-2 md:hidden">
        <span className="text-sm font-medium">
          {filteredData.length} carcasse{filteredData.length > 1 ? 's' : ''}
        </span>
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
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

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

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 md:block">
          {sidebarContent}
        </aside>

        <div className="min-w-0 flex-1 px-4 pt-4 md:px-6">
          <section className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-2 text-sm opacity-50">Par page:</span>
              {itemsPerPageOptions.map((option) => (
                <button
                  className={[
                    'px-2 py-1 text-sm sm:px-3 sm:py-1.5',
                    itemsPerPage === option ? 'font-semibold underline' : '',
                  ].join(' ')}
                  onClick={() => setItemsPerPage(option)}
                  key={option}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                onClick={openColumnsModal}
              >
                <span
                  className="fr-icon--sm ri-layout-column-line"
                  aria-hidden="true"
                />
                Colonnes ({visibleColumns.length}/{allColumns.length})
              </button>
              <DropDownMenu
                text="Actions"
                isActive={selectedCarcassesIds.length > 0}
                menuLinks={[
                  {
                    linkProps: {
                      href: '#',
                      'aria-disabled': selectedCarcassesIds.length === 0,
                      className:
                        isExporting || !selectedCarcassesIds.length ? 'cursor-not-allowed opacity-50' : '',
                      title:
                        selectedCarcassesIds.length === 0
                          ? 'Sélectionnez des carcasses avec la case à cocher'
                          : '',
                      onClick: (e) => {
                        e.preventDefault();
                        if (selectedCarcassesIds.length === 0) return;
                        if (isExporting) return;
                        trackFeature('registre-svi-carcasses', 'export', 'xlsx', selectedCarcassesIds.length);
                        const selectedSet = new Set(selectedCarcassesIds);
                        onExportToXlsx(filteredData.filter((c) => selectedSet.has(c.zacharie_carcasse_id)));
                      },
                    },
                    text: `Export Excel (${selectedCarcassesIds.length})`,
                  },
                ]}
              />
            </div>
          </section>

          <CarcassesEspeceSummary
            carcasses={filteredData}
            storageKey="svi-carcasses-espece-summary-open"
          />

          <section className="mb-4 overflow-x-auto bg-white sm:mb-6 md:shadow-sm">
            <TableFilterable
              data={paginatedData}
              rowKey="zacharie_carcasse_id"
              withCheckbox
              onCheck={setSelectedCarcassesIds}
              checked={selectedCarcassesIds}
              renderCellSmallDevices={renderMobileCarcasse}
              columns={visibleColumns.map((c) => ({
                dataKey: c.dataKey as keyof Carcasse,
                title: c.title,
                type: c.type,
                small: c.small,
                render: c.render,
                ...(c.sortable
                  ? {
                      onSortBy: handleSortBy,
                      onSortOrder: setSortOrder,
                      sortBy,
                      sortOrder,
                    }
                  : {}),
              }))}
            />
            <div className="flex justify-center overflow-x-auto py-4 sm:justify-start sm:py-6">
              <Pagination
                className="mt-4 flex justify-center sm:mt-6 sm:justify-start"
                count={Math.ceil(filteredData.length / itemsPerPage)}
                defaultPage={page}
                getPageLinkProps={(pageNumber) => ({
                  to: `/app/svi/carcasses?page=${pageNumber}`,
                })}
              />
            </div>
          </section>
        </div>
      </div>

      <advancedFiltersModal.Component
        size="large"
        title="Filtres avancés"
        buttons={[
          {
            children: 'Fermer',
            doClosesModal: true,
          },
        ]}
      >
        {isAdvancedFiltersModalOpen && (
          <Filters
            onChange={handleFiltersChange}
            base={filterableFields}
            filters={filters}
            saveInURLParams={false}
          />
        )}
      </advancedFiltersModal.Component>

      <columnsModal.Component
        size="large"
        title="Colonnes affichées"
        buttons={[
          {
            children: 'Fermer',
            doClosesModal: true,
          },
        ]}
      >
        {isColumnsModalOpen && (
          <>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setVisibleColumnKeys(toggleableColumns.map((c) => c.key))}
              >
                Tout afficher
              </button>
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setVisibleColumnKeys([])}
              >
                Tout masquer
              </button>
              <button
                type="button"
                className="text-action-high-blue-france underline"
                onClick={() => setVisibleColumnKeys(DEFAULT_VISIBLE_COLUMN_KEYS)}
              >
                Réinitialiser (vue par défaut)
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-800">
                  Affichées ({orderedVisibleToggleableColumns.length})
                </h3>
                {orderedVisibleToggleableColumns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Aucune colonne affichée.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {orderedVisibleToggleableColumns.map((c, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === orderedVisibleToggleableColumns.length - 1;
                      return (
                        <li
                          key={c.key}
                          className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
                        >
                          <span className="flex-1 truncate text-sm">{c.label}</span>
                          <button
                            type="button"
                            aria-label={`Monter ${c.label}`}
                            title="Monter"
                            disabled={isFirst}
                            className="rounded px-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            onClick={() => moveVisibleColumn(c.key, -1)}
                          >
                            <span
                              className="fr-icon--sm fr-icon-arrow-up-line"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            aria-label={`Descendre ${c.label}`}
                            title="Descendre"
                            disabled={isLast}
                            className="rounded px-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            onClick={() => moveVisibleColumn(c.key, 1)}
                          >
                            <span
                              className="fr-icon--sm fr-icon-arrow-down-line"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            aria-label={`Masquer ${c.label}`}
                            title="Masquer"
                            className="rounded px-1 text-gray-600 hover:bg-gray-100"
                            onClick={() => setVisibleColumnKeys(visibleColumnKeys.filter((k) => k !== c.key))}
                          >
                            <span
                              className="fr-icon--sm fr-icon-close-line"
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-800">Masquées ({hiddenColumns.length})</h3>
                {hiddenColumns.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Toutes les colonnes sont affichées.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {hiddenColumns.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center gap-2 rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-1.5"
                      >
                        <span className="flex-1 truncate text-sm text-gray-700">{c.label}</span>
                        <button
                          type="button"
                          aria-label={`Afficher ${c.label}`}
                          title="Afficher"
                          className="text-action-high-blue-france inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs underline"
                          onClick={() => setVisibleColumnKeys([...visibleColumnKeys, c.key])}
                        >
                          <span
                            className="fr-icon--sm fr-icon-add-line"
                            aria-hidden="true"
                          />
                          Afficher
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </columnsModal.Component>
    </div>
  );
}
