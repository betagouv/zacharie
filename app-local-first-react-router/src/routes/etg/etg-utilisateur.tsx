import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { CarcasseStatus, CarcasseType, FeiOwnerRole } from '@prisma/client';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Tooltip as DsfrTooltip } from '@codegouvfr/react-dsfr/Tooltip';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Pagination } from '@codegouvfr/react-dsfr/Pagination';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { useLocalStorage } from '@uidotdev/usehooks';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EtgUserInteractedResponse, EtgUserInteracted } from '@api/src/types/responses';
import API from '@app/services/api';
import useZustandStore from '@app/zustand/store';
import Chargement from '@app/components/Chargement';
import CardFiche from '@app/components/CardFiche';
import CarcassesEspeceSummary from '@app/components/CarcassesEspeceSummary';
import TableFilterable from '@app/components/TableFilterable';
import DropDownMenu from '@app/components/DropDownMenu';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import { getCarcasseStatusLabel, type CarcasseStatusLabel } from '@app/utils/get-carcasse-status';
import { isCarcasseSviArchived } from '@app/utils/carcasse-svi-archived';
import { getPreviousDetenteur } from '@app/utils/get-previous-detenteur-from-fei';
import { hasBphMotif, isBphMotif } from '@app/utils/bph-motifs';
import useExportCarcasses from '@app/utils/export-carcasses';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import {
  getEtgCarcasseColumns,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  itemsPerPageOptions,
  type CatalogColumn,
} from '@app/utils/etg-carcasses-columns';

function getUserName(user: EtgUserInteracted) {
  const name = `${user.prenom ?? ''} ${user.nom_de_famille ?? ''}`.trim();
  return name || user.email || 'Utilisateur sans nom';
}

const columnsModal = createModal({
  id: 'etg-utilisateur-carcasses-columns',
  isOpenedByDefault: false,
});

export default function EtgUtilisateur() {
  const { userId } = useParams();
  const [user, setUser] = useState<EtgUserInteracted | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState('Statistiques de saisies');

  const carcassesRegistry = useZustandStore((state) => state.carcassesRegistry);
  const feis = useZustandStore((state) => state.feis);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const entities = useZustandStore((state) => state.entities);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setUser(null);
    setNotFound(false);
    API.get({ path: `entite/etg/utilisateurs/${userId}` })
      .then((res) => res as EtgUserInteractedResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setUser(res.data.user);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [userId]);

  useLoaderEffect(() => {
    loadData('etg-utilisateur');
  }, []);

  // carcasses de l'utilisateur dans le périmètre ETG (déjà scopé dans le store)
  const userCarcasses = useMemo(() => {
    if (!userId) return [];
    const interCarcasseIds = new Set<string>();
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at) continue;
      if (ci.intermediaire_user_id === userId) interCarcasseIds.add(ci.zacharie_carcasse_id);
    }
    return carcassesRegistry.filter(
      (c) =>
        c.premier_detenteur_user_id === userId ||
        c.examinateur_initial_user_id === userId ||
        c.svi_user_id === userId ||
        c.svi_ipm1_user_id === userId ||
        c.svi_ipm2_user_id === userId ||
        interCarcasseIds.has(c.zacharie_carcasse_id)
    );
  }, [carcassesRegistry, carcassesIntermediaireById, userId]);

  const userFeis = useMemo(() => {
    const numeros = new Set(userCarcasses.map((c) => c.fei_numero));
    return [...numeros]
      .map((numero) => feis[numero])
      .filter(Boolean)
      .sort((a, b) => (b.updated_at < a.updated_at ? -1 : 1));
  }, [userCarcasses, feis]);

  const collecteursNamesByFeiNumero = useMemo(() => {
    const result: Record<string, string> = {};
    for (const ci of Object.values(carcassesIntermediaireById)) {
      if (ci.deleted_at) continue;
      if (ci.intermediaire_role !== FeiOwnerRole.COLLECTEUR_PRO) continue;
      const entity = ci.intermediaire_entity_id ? entities[ci.intermediaire_entity_id] : null;
      const name = entity?.nom_d_usage || entity?.raison_sociale;
      if (!name) continue;
      const current = result[ci.fei_numero];
      if (!current) result[ci.fei_numero] = name;
      else if (!current.split(', ').includes(name)) result[ci.fei_numero] = `${current}, ${name}`;
    }
    return result;
  }, [carcassesIntermediaireById, entities]);

  if (notFound) {
    return (
      <div className="fr-container p-8 text-center">
        <title>{`Utilisateur introuvable | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
        <p className="text-gray-600">
          Cet utilisateur n'existe pas ou n'a pas interagi avec votre établissement.
        </p>
        <Link
          className="fr-link"
          to="/app/etg/utilisateurs"
        >
          Retour à la liste des utilisateurs
        </Link>
      </div>
    );
  }

  if (!user) {
    return <Chargement />;
  }

  const fullName = getUserName(user);
  const localisation = [user.code_postal, user.ville].filter(Boolean).join(' ');

  const tabs: TabsProps['tabs'] = [
    { tabId: 'Statistiques de saisies', label: 'Statistiques de saisies' },
    { tabId: 'Fiches', label: `Fiches (${userFeis.length})` },
    { tabId: 'Carcasses', label: `Carcasses (${userCarcasses.length})` },
  ];

  return (
    <div className="fr-container fr-container--fluid">
      <title>{`${fullName} | Utilisateurs | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="p-4 pb-32 md:p-8 md:pb-0">
        <Link
          className="fr-link fr-icon-arrow-left-line fr-link--icon-left mb-4 inline-block"
          to="/app/etg/utilisateurs"
        >
          Retour à la liste
        </Link>

        <header className="rounded-lg border border-gray-200 bg-white p-3 md:p-4">
          <h1 className="m-0 text-xl font-bold break-words">{fullName}</h1>
          {fullName !== user.email && user.email && (
            <p className="m-0 text-sm break-words text-gray-500">{user.email}</p>
          )}

          {user.roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.roles.map((role) => (
                <Tag
                  key={role}
                  small
                >
                  {getUserRoleLabel(role)}
                </Tag>
              ))}
            </div>
          )}

          <p className="mt-2 mb-0 text-xs text-gray-500">
            {user.telephone && <>{user.telephone} · </>}
            {localisation && <>{localisation} · </>}
            Inscrit le {dayjs(user.created_at).format('DD/MM/YYYY')}
          </p>
        </header>

        <Tabs
          selectedTabId={selectedTabId}
          tabs={tabs}
          onTabChange={setSelectedTabId}
          className="mt-4"
        >
          {selectedTabId === 'Statistiques de saisies' && <SaisieStats carcasses={userCarcasses} />}
          {selectedTabId === 'Fiches' && (
            <div className="py-4">
              {userFeis.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune fiche pour cet utilisateur.</p>
              ) : (
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userFeis.map((fei) => {
                    const detenteurPrecedent = getPreviousDetenteur(fei);
                    return (
                      <CardFiche
                        key={fei.numero}
                        fei={fei}
                        filter="Toutes les fiches"
                        linkTo={`/app/etg/fei/${fei.numero}`}
                        detenteurName={detenteurPrecedent.name}
                        detenteurIcon={detenteurPrecedent.icon}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {selectedTabId === 'Carcasses' && (
            <UserCarcasses
              carcasses={userCarcasses}
              collecteursNamesByFeiNumero={collecteursNamesByFeiNumero}
            />
          )}
        </Tabs>
      </div>
    </div>
  );
}

// Libellé de statut unifié (masculin/féminin fusionnés pour ne pas dédoubler les parts du donut).
type StatusDisplayLabel =
  | 'Saisie totale'
  | 'Saisie partielle'
  | 'En traitement assainissant'
  | 'Consigné(e)'
  | 'Levée de consigne'
  | 'Accepté(e)'
  | 'Manquant(e)'
  | 'Sans décision';

function normalizeStatusLabel(label: CarcasseStatusLabel): StatusDisplayLabel {
  switch (label) {
    case 'Accepté':
    case 'Acceptée':
      return 'Accepté(e)';
    case 'Consigné':
    case 'Consignée':
      return 'Consigné(e)';
    case 'Manquant':
    case 'Manquante':
      return 'Manquant(e)';
    default:
      return label;
  }
}

// Couleur stable par statut SVI (même statut = même couleur d'un utilisateur à l'autre).
const STATUS_COLORS: Record<StatusDisplayLabel, string> = {
  'Saisie totale': '#e1000f', // rouge
  'Saisie partielle': '#fa5252', // rouge clair
  'En traitement assainissant': '#7048e8', // violet
  'Consigné(e)': '#f59f00', // ambre
  'Levée de consigne': '#37b24d', // vert
  'Accepté(e)': '#1971c2', // bleu
  'Manquant(e)': '#868e96', // gris
  'Sans décision': '#ced4da', // gris clair
};
const BPH_COLOR = '#e1000f';
const NON_BPH_COLOR = '#3b82f6';

function SaisieStats({ carcasses }: { carcasses: Array<Carcasse> }) {
  const stats = useMemo(() => {
    const total = carcasses.length;
    const statusCounts = new Map<StatusDisplayLabel, number>();
    const motifCounts = new Map<string, number>();
    let totalGG = 0;
    let totalPG = 0;
    let saisiesCount = 0;
    let saisiesGG = 0;
    let saisiesPG = 0;
    let saisiesBphCount = 0;
    for (const carcasse of carcasses) {
      const isPetitGibier = carcasse.type === CarcasseType.PETIT_GIBIER;
      if (isPetitGibier) totalPG += 1;
      else totalGG += 1;

      const statusLabel = normalizeStatusLabel(getCarcasseStatusLabel(carcasse));
      statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);

      const motifs = [
        ...(carcasse.svi_ipm1_lesions_ou_motifs ?? []),
        ...(carcasse.svi_ipm2_lesions_ou_motifs ?? []),
      ].filter(Boolean);
      for (const motif of motifs) {
        motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1);
      }

      const isSaisie =
        carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_TOTALE ||
        carcasse.svi_carcasse_status === CarcasseStatus.SAISIE_PARTIELLE;
      if (isSaisie) {
        saisiesCount += 1;
        if (isPetitGibier) saisiesPG += 1;
        else saisiesGG += 1;
        if (hasBphMotif(motifs)) saisiesBphCount += 1;
      }
    }
    const statusData = [...statusCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name],
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
    const motifData = [...motifCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([motif, count]) => ({ motif, count, bph: isBphMotif(motif) }));
    return {
      total,
      totalGG,
      totalPG,
      statusData,
      motifData,
      saisiesCount,
      saisiesBphCount,
      tauxSaisie: total > 0 ? Math.round((saisiesCount / total) * 1000) / 10 : 0,
      tauxSaisieGG: totalGG > 0 ? Math.round((saisiesGG / totalGG) * 1000) / 10 : 0,
      tauxSaisiePG: totalPG > 0 ? Math.round((saisiesPG / totalPG) * 1000) / 10 : 0,
      tauxBph: saisiesCount > 0 ? Math.round((saisiesBphCount / saisiesCount) * 1000) / 10 : 0,
    };
  }, [carcasses]);

  if (carcasses.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-gray-500">Aucune carcasse pour cet utilisateur.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-wrap gap-4">
        <StatCard
          label="Grand gibier"
          value={stats.totalGG}
        />
        <StatCard
          label="Petit gibier"
          value={stats.totalPG}
        />
        <StatCard
          label="Taux de saisie"
          value={`${stats.tauxSaisie.toLocaleString('fr-FR')} %`}
          sub={`Grand gibier : ${stats.tauxSaisieGG.toLocaleString('fr-FR')} % · Petit gibier : ${stats.tauxSaisiePG.toLocaleString('fr-FR')} %`}
        />
        <StatCard
          label="Saisies liées au BPH"
          value={`${stats.tauxBph.toLocaleString('fr-FR')} %`}
          sub={`${stats.saisiesBphCount} saisie${stats.saisiesBphCount > 1 ? 's' : ''} sur ${stats.saisiesCount} (hygiène)`}
          info="BPH = Bonnes Pratiques d'Hygiène. Saisies dont au moins un motif relève d'un défaut d'hygiène (souillures, putréfaction, morsures…), souvent évitable lors de la préparation."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="fr-h6 mb-3">Répartition par décision SVI</h3>
          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <PieChart>
              <Pie
                data={stats.statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
              >
                {stats.statusData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.color}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [Number(v).toLocaleString('fr-FR'), String(n)]} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-3 flex flex-col gap-1">
            {stats.statusData.map((d) => (
              <li
                key={d.name}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-semibold text-gray-900">{d.value}</span>
                <span className="w-10 text-right text-gray-500">{d.pct}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="fr-h6 mb-1">Motifs de saisie</h3>
          <p className="mb-3 text-xs text-gray-500">
            <span
              className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: BPH_COLOR }}
            />
            Motif lié aux Bonnes Pratiques d'Hygiène (BPH)
          </p>
          {stats.motifData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">Aucun motif de saisie renseigné.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(220, stats.motifData.length * 28)}
            >
              <BarChart
                data={stats.motifData}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="motif"
                  type="category"
                  width={160}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v) => [Number(v).toLocaleString('fr-FR'), 'Nombre']} />
                <Bar
                  dataKey="count"
                  name="Nombre de carcasses"
                >
                  {stats.motifData.map((d) => (
                    <Cell
                      key={d.motif}
                      fill={d.bph ? BPH_COLOR : NON_BPH_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  info,
}: {
  label: string;
  value: string | number;
  sub?: string;
  info?: string;
}) {
  return (
    <div className="flex min-w-48 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4">
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <span className="flex items-center gap-1 text-sm text-gray-600">
        {label}
        {info && (
          <DsfrTooltip
            kind="hover"
            title={info}
          />
        )}
      </span>
      {sub && <span className="mt-1 text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

interface UserCarcassesProps {
  carcasses: Array<Carcasse>;
  collecteursNamesByFeiNumero: Record<string, string>;
}

function UserCarcasses({ carcasses, collecteursNamesByFeiNumero }: UserCarcassesProps) {
  const { onExportToXlsx, isExporting } = useExportCarcasses();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useLocalStorage<keyof Carcasse>(
    'etg-utilisateur-carcasses-sort-by',
    'numero_bracelet'
  );
  const [sortOrder, setSortOrder] = useLocalStorage<'ASC' | 'DESC'>(
    'etg-utilisateur-carcasses-sort-order',
    'ASC'
  );
  const [itemsPerPage, setItemsPerPage] = useLocalStorage<number>(
    'etg-utilisateur-carcasses-items-per-page',
    50
  );
  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorage<Array<string>>(
    'etg-utilisateur-carcasses-visible-columns',
    DEFAULT_VISIBLE_COLUMN_KEYS
  );
  const [selectedCarcassesIds, setSelectedCarcassesIds] = useState<Array<string>>([]);
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  useIsModalOpen(columnsModal, {
    onDisclose: () => setIsColumnsModalOpen(true),
    onConceal: () => setIsColumnsModalOpen(false),
  });

  const sortedData = useMemo(() => {
    return [...carcasses].sort((a, b) => {
      const aValue =
        // @ts-expect-error: svi_carcasse_archived est calculé par isCarcasseSviArchived
        sortBy === 'svi_carcasse_archived' ? isCarcasseSviArchived(a) : a[sortBy];
      const bValue =
        // @ts-expect-error: svi_carcasse_archived est calculé par isCarcasseSviArchived
        sortBy === 'svi_carcasse_archived' ? isCarcasseSviArchived(b) : b[sortBy];
      if (!aValue) return bValue ? (sortOrder === 'ASC' ? 1 : -1) : 0;
      if (!bValue) return sortOrder === 'ASC' ? -1 : 1;
      if (aValue === bValue) return 0;
      if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
      return sortOrder === 'ASC' ? 1 : -1;
    });
  }, [carcasses, sortBy, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, page, itemsPerPage]);

  const allColumns: Array<CatalogColumn> = getEtgCarcasseColumns({
    page,
    itemsPerPage,
    getCollecteurName: (carcasse) => collecteursNamesByFeiNumero[carcasse.fei_numero] ?? null,
  });
  const columnsByKey: Record<string, CatalogColumn> = {};
  for (const c of allColumns) columnsByKey[c.key] = c;

  const alwaysVisibleColumns = allColumns.filter((c) => c.alwaysVisible);
  const toggleableColumns = allColumns.filter((c) => !c.alwaysVisible);
  const orderedVisibleToggleableColumns = visibleColumnKeys
    .map((k) => columnsByKey[k])
    .filter((c): c is CatalogColumn => Boolean(c) && !c.alwaysVisible);
  const hiddenColumns = toggleableColumns.filter((c) => !visibleColumnKeys.includes(c.key));
  const visibleColumns = [...alwaysVisibleColumns, ...orderedVisibleToggleableColumns];

  if (carcasses.length === 0) {
    return (
      <div className="py-4">
        <p className="text-sm text-gray-500">Aucune carcasse pour cet utilisateur.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <section className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-2 text-sm opacity-50">Par page:</span>
          {itemsPerPageOptions.map((option) => (
            <button
              type="button"
              key={option}
              className={[
                'px-2 py-1 text-sm sm:px-3 sm:py-1.5',
                itemsPerPage === option ? 'font-semibold underline' : '',
              ].join(' ')}
              onClick={() => {
                setItemsPerPage(option);
                setPage(1);
              }}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            onClick={() => {
              setIsColumnsModalOpen(true);
              columnsModal.open();
            }}
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
                    if (selectedCarcassesIds.length === 0 || isExporting) return;
                    const selectedSet = new Set(selectedCarcassesIds);
                    onExportToXlsx(sortedData.filter((c) => selectedSet.has(c.zacharie_carcasse_id)));
                  },
                },
                text: `Export Excel (${selectedCarcassesIds.length})`,
              },
            ]}
          />
        </div>
      </section>

      <CarcassesEspeceSummary
        carcasses={sortedData}
        storageKey="etg-utilisateur-carcasses-espece-summary-open"
      />

      <section className="mb-4 overflow-x-auto bg-white sm:mb-6 md:shadow-sm">
        <TableFilterable
          data={paginatedData}
          rowKey="zacharie_carcasse_id"
          withCheckbox
          onCheck={setSelectedCarcassesIds}
          checked={selectedCarcassesIds}
          columns={visibleColumns.map((c) => ({
            dataKey: c.dataKey as keyof Carcasse,
            title: c.title,
            type: c.type,
            small: c.small,
            render: c.render,
            ...(c.sortable ? { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder } : {}),
          }))}
        />
        <div className="flex justify-center overflow-x-auto py-4 sm:justify-start sm:py-6">
          <Pagination
            className="mt-4 flex justify-center sm:mt-6 sm:justify-start"
            count={Math.ceil(sortedData.length / itemsPerPage)}
            defaultPage={page}
            getPageLinkProps={(pageNumber) => ({
              to: '#',
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                setPage(pageNumber);
              },
            })}
          />
        </div>
      </section>

      <columnsModal.Component
        size="large"
        title="Colonnes affichées"
        buttons={[{ children: 'Fermer', doClosesModal: true }]}
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
                    {orderedVisibleToggleableColumns.map((c) => (
                      <li
                        key={c.key}
                        className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5"
                      >
                        <span className="flex-1 truncate text-sm">{c.label}</span>
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
                    ))}
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
