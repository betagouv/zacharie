import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FeiOwnerRole } from '@prisma/client';
import type { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import TableFilterable from '@app/components/TableFilterable';
import CollapsibleSection from '@app/components/CollapsibleSection';
import CarcassesEspeceSummary from '@app/components/CarcassesEspeceSummary';
import { useSaveScroll } from '@app/services/useSaveScroll';
import { getCarcasseStatusLabel } from '@app/utils/get-carcasse-status';
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
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from '@app/utils/get-carcasse-intermediaire-id';
import { computeFeiSteps } from '@app/utils/fei-steps';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { useEntitiesIdsWorkingDirectlyFor } from '@app/utils/get-entity-relations';
import { isCarcasseSviArchived } from '@app/utils/carcasse-svi-archived';
import { loadData, useLoaderEffect } from '@app/utils/load-data';

const advancedFiltersModal = createModal({
  id: 'etg-carcasses-advanced-filters',
  isOpenedByDefault: false,
});

const columnsModal = createModal({
  id: 'etg-carcasses-columns',
  isOpenedByDefault: false,
});

const FEI_STATUS_OPTIONS: Array<FeiStepSimpleStatus> = ['À compléter', 'En cours', 'Clôturée'];

const feiStatusColors: Record<FeiStepSimpleStatus, { bg: string; text: string }> = {
  'À compléter': { bg: 'bg-[#FEE7FC]', text: 'text-[#6E445A]' },
  'En cours': { bg: 'bg-[#FFECBD]', text: 'text-[#73603F]' },
  Clôturée: { bg: 'bg-[#E8EDFF]', text: 'text-[#01008B]' },
};

const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'numero_bracelet',
  'fei_premier_detenteur_name_cache',
  'fei_svi_assigned_at',
  'svi_carcasse_status',
  'svi_carcasse_archived',
  'svi_carcasse_status_set_at',
  'fei_numero',
  'collecteur',
];
const itemsPerPageOptions = [20, 50, 100, 200, 1000];

export default function EtgCarcasses() {
  const user = useMostFreshUser('etg-carcasses')!;
  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const feis = useZustandStore((state) => state.feis);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);
  const usersById = useZustandStore((state) => state.users);
  const carcasses = useZustandStore((state) => state.carcasses);
  const entitiesIdsWorkingDirectlyFor = useEntitiesIdsWorkingDirectlyFor();
  const [selectedCarcassesIds, setSelectedCarcassesIds] = useState<Array<string>>([]);
  const [loading, setLoading] = useState(true);

  const { onExportToXlsx, isExporting } = useExportCarcasses();

  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');

  const [sortBy, setSortBy] = useLocalStorage<keyof (typeof carcassesRegistry)[number]>(
    'etg-carcasses-sort-by',
    'numero_bracelet'
  );
  const [sortOrder, setSortOrder] = useLocalStorage<'ASC' | 'DESC'>('etg-carcasses-sort-order', 'ASC');

  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>('etg-carcasses-items-per-page', 50);
  const [filters, setFilters] = useLocalStorage<Array<CarcasseFilter>>('etg-carcasses-filters-preset', []);

  const [quickFilterFeiStatuses, setQuickFilterFeiStatuses] = useLocalStorage<Array<FeiStepSimpleStatus>>(
    'etg-carcasses-quick-filter-fei-statuses',
    []
  );
  const [quickFilterCollecteurIds, setQuickFilterCollecteurIds] = useLocalStorage<Array<string>>(
    'etg-carcasses-quick-filter-collecteurs',
    []
  );
  const [quickFilterEspeces, setQuickFilterEspeces] = useLocalStorage<Array<string>>(
    'etg-carcasses-quick-filter-especes',
    []
  );
  const [quickFilterStatuses, setQuickFilterStatuses] = useLocalStorage<Array<string>>(
    'etg-carcasses-quick-filter-statuses',
    []
  );
  const [quickFilterPremierDetenteurs, setQuickFilterPremierDetenteurs] = useLocalStorage<Array<string>>(
    'etg-carcasses-quick-filter-premier-detenteurs',
    []
  );
  const [quickFilterBracelet, setQuickFilterBracelet] = useState('');

  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorage<Array<string>>(
    'etg-carcasses-visible-columns',
    DEFAULT_VISIBLE_COLUMN_KEYS
  );

  const filtersKey = `${quickFilterBracelet}|${quickFilterFeiStatuses.join(',')}|${quickFilterCollecteurIds.join(',')}|${quickFilterEspeces.join(',')}|${quickFilterStatuses.join(',')}|${quickFilterPremierDetenteurs.join(',')}|${JSON.stringify(filters)}|${itemsPerPage}`;
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
    const result: Record<string, Array<(typeof carcasses)[string]>> = {};
    for (const c of Object.values(carcasses)) {
      if (c.deleted_at) continue;
      if (!result[c.fei_numero]) result[c.fei_numero] = [];
      result[c.fei_numero].push(c);
    }
    return result;
  }, [carcasses]);

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
    }
    const sortedMotifs = Array.from(motifs).sort();
    const sortedEtgNames = Array.from(etgNames).sort();
    const sortedCcgNames = Array.from(ccgNames).sort();
    return carcasseFilterableFields(sortedMotifs, sortedEtgNames, sortedCcgNames);
  }, [carcassesRegistry]);

  const carcasseCollecteurIds = useMemo(() => {
    const result: Record<string, Array<string>> = {};
    for (const carcasse of carcassesRegistry) {
      const intermediaires = intermediairesByFei[carcasse.fei_numero] ?? [];
      const ids: Array<string> = [];
      for (const intermediaire of intermediaires) {
        if (intermediaire.intermediaire_role !== FeiOwnerRole.COLLECTEUR_PRO) continue;
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(carcasse, intermediaire.id);
        if (!carcassesIntermediaireById[id]) continue;
        const collecteurId = intermediaire.intermediaire_entity_id || intermediaire.intermediaire_user_id;
        if (collecteurId && !ids.includes(collecteurId)) ids.push(collecteurId);
      }
      result[carcasse.zacharie_carcasse_id] = ids;
    }
    return result;
  }, [carcassesRegistry, intermediairesByFei, carcassesIntermediaireById]);

  const collecteurOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ids of Object.values(carcasseCollecteurIds)) {
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
  }, [carcasseCollecteurIds, entities, usersById]);

  const especeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const carcasse of carcassesRegistry) {
      if (carcasse.espece) set.add(carcasse.espece);
    }
    return Array.from(set).sort();
  }, [carcassesRegistry]);

  const statusOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const carcasse of carcassesRegistry) {
      const key = carcasse.svi_carcasse_status ?? '__none__';
      if (!map.has(key)) {
        map.set(key, getCarcasseStatusLabel(carcasse));
      }
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [carcassesRegistry]);

  const premierDetenteurOptions = useMemo(() => {
    const set = new Set<string>();
    for (const carcasse of carcassesRegistry) {
      if (feis[carcasse.fei_numero]?.premier_detenteur_name_cache) {
        set.add(feis[carcasse.fei_numero]!.premier_detenteur_name_cache!);
      }
    }
    return Array.from(set).sort();
  }, [carcassesRegistry, feis]);

  const feiSimpleStatusByNumero = useMemo(() => {
    if (quickFilterFeiStatuses.length === 0) return {};
    const result: Record<string, ReturnType<typeof computeFeiSteps>['simpleStatus']> = {};
    const uniqueFeiNumeros = new Set<string>();
    for (const carcasse of carcassesRegistry) {
      uniqueFeiNumeros.add(carcasse.fei_numero);
    }
    for (const feiNumero of uniqueFeiNumeros) {
      const fei = feis[feiNumero];
      if (!fei) continue;
      const intermediaires = intermediairesByFei[feiNumero] ?? [];
      const feiCarcasses = carcassesByFei[feiNumero] ?? [];
      const { simpleStatus } = computeFeiSteps({
        fei,
        intermediaires,
        entitiesIdsWorkingDirectlyFor,
        user,
        carcasses: feiCarcasses,
      });
      result[feiNumero] = simpleStatus;
    }
    return result;
  }, [
    quickFilterFeiStatuses,
    carcassesRegistry,
    feis,
    intermediairesByFei,
    carcassesByFei,
    entitiesIdsWorkingDirectlyFor,
    user,
  ]);

  const filteredData = useMemo(() => {
    const braceletQuery = quickFilterBracelet.trim().toLowerCase();
    return carcassesRegistry
      .filter((carcasse) => filterCarcassesInRegistre(filters)(carcasse, feis[carcasse.fei_numero]!))
      .filter((carcasse) => {
        if (braceletQuery && !carcasse.numero_bracelet?.toLowerCase().includes(braceletQuery)) {
          return false;
        }
        if (quickFilterCollecteurIds.length > 0) {
          const ids = carcasseCollecteurIds[carcasse.zacharie_carcasse_id] ?? [];
          if (!ids.some((id) => quickFilterCollecteurIds.includes(id))) return false;
        }
        if (quickFilterEspeces.length > 0) {
          if (!carcasse.espece || !quickFilterEspeces.includes(carcasse.espece)) return false;
        }
        if (quickFilterStatuses.length > 0) {
          const statusKey = carcasse.svi_carcasse_status ?? '__none__';
          if (!quickFilterStatuses.includes(statusKey)) return false;
        }
        if (quickFilterPremierDetenteurs.length > 0) {
          if (
            !feis[carcasse.fei_numero]?.premier_detenteur_name_cache ||
            !quickFilterPremierDetenteurs.includes(feis[carcasse.fei_numero]!.premier_detenteur_name_cache!)
          )
            return false;
        }
        if (quickFilterFeiStatuses.length > 0) {
          const feiStatus = feiSimpleStatusByNumero[carcasse.fei_numero];
          if (!feiStatus || !quickFilterFeiStatuses.includes(feiStatus)) return false;
        }
        return true;
      })
      .sort((a, b) => {
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
  }, [
    carcassesRegistry,
    filters,
    feis,
    sortBy,
    sortOrder,
    quickFilterBracelet,
    quickFilterCollecteurIds,
    quickFilterEspeces,
    quickFilterStatuses,
    quickFilterPremierDetenteurs,
    quickFilterFeiStatuses,
    carcasseCollecteurIds,
    feiSimpleStatusByNumero,
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
    loadData('etg-carcasses').then(() => setLoading(false));
  }, []);

  useSaveScroll('etg-carcasses-scrollY');

  const collecteurNameByCarcasseId = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const carcasse of carcassesRegistry) {
      const intermediaires = intermediairesByFei[carcasse.fei_numero] ?? [];
      const collecteursPro: string[] = [];
      for (const intermediaire of intermediaires) {
        if (intermediaire.intermediaire_role !== FeiOwnerRole.COLLECTEUR_PRO) continue;
        const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(carcasse, intermediaire.id);
        if (!carcassesIntermediaireById[id]) continue;
        const collecteurEntity = entities[intermediaire.intermediaire_entity_id];
        if (collecteurEntity?.nom_d_usage) {
          collecteursPro.push(collecteurEntity.nom_d_usage);
        }
      }
      result[carcasse.zacharie_carcasse_id] = collecteursPro.length === 0 ? null : collecteursPro.join(', ');
    }
    return result;
  }, [carcassesRegistry, intermediairesByFei, carcassesIntermediaireById, entities]);

  const getCollecteurName = (carcasse: (typeof carcassesRegistry)[number]): string | null => {
    return collecteurNameByCarcasseId[carcasse.zacharie_carcasse_id] ?? null;
  };

  type Carcasse = (typeof carcassesRegistry)[number];
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
            to={`/app/etg/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
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
      render: (carcasse) => getCollecteurName(carcasse) || '-',
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
      render: (carcasse) => <Link to={`/app/etg/fei/${carcasse.fei_numero}`}>{carcasse.fei_numero}</Link>,
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
    quickFilterFeiStatuses.length +
    quickFilterCollecteurIds.length +
    quickFilterEspeces.length +
    quickFilterStatuses.length +
    quickFilterPremierDetenteurs.length +
    filters.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setQuickFilterBracelet('');
    setQuickFilterFeiStatuses([]);
    setQuickFilterCollecteurIds([]);
    setQuickFilterEspeces([]);
    setQuickFilterStatuses([]);
    setQuickFilterPremierDetenteurs([]);
    setFilters([]);
  };

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
          onChange={(e) => setQuickFilterBracelet(e.target.value)}
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

      <CollapsibleSection
        title="Statut fiche"
        defaultOpen={false}
        badge={
          quickFilterFeiStatuses.length > 0 ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              {quickFilterFeiStatuses.length}
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
                checked={quickFilterFeiStatuses.includes(status)}
                className="checked:accent-action-high-blue-france h-4 w-4"
                onChange={() => {
                  if (quickFilterFeiStatuses.includes(status)) {
                    setQuickFilterFeiStatuses(quickFilterFeiStatuses.filter((s) => s !== status));
                  } else {
                    setQuickFilterFeiStatuses([...quickFilterFeiStatuses, status]);
                  }
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

      {collecteurOptions.length > 1 && (
        <CollapsibleSection
          title="Collecteur"
          defaultOpen={false}
          badge={
            quickFilterCollecteurIds.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {quickFilterCollecteurIds.length}
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
                  checked={quickFilterCollecteurIds.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (quickFilterCollecteurIds.includes(option.id)) {
                      setQuickFilterCollecteurIds(quickFilterCollecteurIds.filter((v) => v !== option.id));
                    } else {
                      setQuickFilterCollecteurIds([...quickFilterCollecteurIds, option.id]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {especeOptions.length > 1 && (
        <CollapsibleSection
          title="Espèce"
          defaultOpen={false}
          badge={
            quickFilterEspeces.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {quickFilterEspeces.length}
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
                  checked={quickFilterEspeces.includes(espece)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (quickFilterEspeces.includes(espece)) {
                      setQuickFilterEspeces(quickFilterEspeces.filter((v) => v !== espece));
                    } else {
                      setQuickFilterEspeces([...quickFilterEspeces, espece]);
                    }
                  }}
                />
                <span className="truncate text-sm">{espece}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {statusOptions.length > 1 && (
        <CollapsibleSection
          title="Statut carcasse"
          defaultOpen={false}
          badge={
            quickFilterStatuses.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {quickFilterStatuses.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {statusOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={quickFilterStatuses.includes(option.id)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (quickFilterStatuses.includes(option.id)) {
                      setQuickFilterStatuses(quickFilterStatuses.filter((v) => v !== option.id));
                    } else {
                      setQuickFilterStatuses([...quickFilterStatuses, option.id]);
                    }
                  }}
                />
                <span className="truncate text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {premierDetenteurOptions.length > 1 && (
        <CollapsibleSection
          title="Premier détenteur"
          defaultOpen={false}
          badge={
            quickFilterPremierDetenteurs.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {quickFilterPremierDetenteurs.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {premierDetenteurOptions.map((name) => (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={quickFilterPremierDetenteurs.includes(name)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => {
                    if (quickFilterPremierDetenteurs.includes(name)) {
                      setQuickFilterPremierDetenteurs(quickFilterPremierDetenteurs.filter((v) => v !== name));
                    } else {
                      setQuickFilterPremierDetenteurs([...quickFilterPremierDetenteurs, name]);
                    }
                  }}
                />
                <span className="truncate text-sm">{name}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

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
                    to={`/app/etg/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
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
                  to={`/app/etg/fei/${carcasse.fei_numero}`}
                  className="text-blue-600 hover:underline"
                >
                  {carcasse.fei_numero}
                </Link>
              </div>
              {getCollecteurName(carcasse) && (
                <div>
                  <span className="font-semibold">Collecteur: </span>
                  <span>{getCollecteurName(carcasse)}</span>
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
      <title>Carcasses | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>

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
            storageKey="etg-carcasses-espece-summary-open"
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
                      onSortBy: setSortBy,
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
                  to: `/app/etg/carcasses?page=${pageNumber}`,
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
            onChange={setFilters}
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
