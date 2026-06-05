import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineStatutAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import TableFilterable from '@app/components/TableFilterable';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  envoyerTrichineFTP,
  getTrichineEchantillons,
  getTrichineFTPs,
  getTrichinePools,
  type TrichineEchantillonWithCarcasse,
  type TrichineFTPPopulated,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import {
  filterTrichineRows,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  sitePrelevementLabels,
  sortTrichineRows,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurFTP,
  statutUtilisateurPool,
  type TrichineSortOrder,
} from '@app/utils/trichine';

type TabId = 'echantillons' | 'pools' | 'ftps';

/**
 * « Mes analyses trichine » (cf doc/trichine.md §6.1) : tables échantillons / pools / FTP
 * avec recherche, filtre statut et tri par colonne (client-side, volumes faibles).
 */
export default function TrichineTableau() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTabId = (searchParams.get('tab') as TabId) || 'echantillons';

  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [ftps, setFtps] = useState<Array<TrichineFTPPopulated>>([]);

  const refresh = useCallback(() => {
    getTrichineEchantillons()
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error);
    getTrichinePools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
    getTrichineFTPs()
      .then((response) => response.ok && response.data && setFtps(response.data.ftps))
      .catch(console.error);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
  }, [refresh]);

  const tabs: TabsProps['tabs'] = [
    { tabId: 'echantillons', label: `Échantillons (${echantillons.length})` },
    { tabId: 'pools', label: `Pools (${pools.length})` },
    { tabId: 'ftps', label: `FTP (${ftps.length})` },
  ];

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Analyses trichine | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Mes analyses trichine</h1>
          <Tabs
            selectedTabId={selectedTabId}
            tabs={tabs}
            onTabChange={(tabId) => setSearchParams({ tab: tabId })}
            className="mb-6"
          >
            {selectedTabId === 'echantillons' && <TabEchantillons echantillons={echantillons} />}
            {selectedTabId === 'pools' && <TabPools pools={pools} />}
            {selectedTabId === 'ftps' && (
              <TabFTPs
                ftps={ftps}
                onChanged={refresh}
              />
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Toolbar commune : recherche + filtre statut                                 */
/* -------------------------------------------------------------------------- */

function ListToolbar({
  query,
  onQueryChange,
  searchHint,
  statut,
  onStatutChange,
  statutOptions,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchHint: string;
  statut: string;
  onStatutChange: (value: string) => void;
  statutOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <Input
        label="Rechercher"
        hintText={searchHint}
        className="mb-0! min-w-48 grow"
        nativeInputProps={{
          type: 'search',
          value: query,
          onChange: (event) => onQueryChange(event.target.value),
        }}
      />
      <Select
        label="Statut"
        className="mb-0!"
        nativeSelectProps={{
          value: statut,
          onChange: (event) => onStatutChange(event.target.value),
        }}
      >
        <option value="">Tous les statuts</option>
        {statutOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

const statutAnalyseOptions = Object.values(TrichineStatutAnalyse).map((statut) => ({
  value: statut,
  label: statutAnalyseLabels[statut],
}));

/* -------------------------------------------------------------------------- */
/* Échantillons                                                                */
/* -------------------------------------------------------------------------- */

function TabEchantillons({ echantillons }: { echantillons: Array<TrichineEchantillonWithCarcasse> }) {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [sortBy, setSortBy] = useState<keyof TrichineEchantillonWithCarcasse>('date_prelevement');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  const rows = useMemo(() => {
    let filtered = echantillons;
    if (statut === 'SANS_POOL') filtered = filtered.filter((echantillon) => !echantillon.pool_id);
    else if (statut) filtered = filtered.filter((echantillon) => echantillon.statut === statut);
    filtered = filterTrichineRows(
      filtered,
      query,
      (echantillon) =>
        `${echantillon.reference_echantillon} ${echantillon.Carcasse.numero_bracelet} ${echantillon.TrichinePool?.reference_pool ?? ''}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [echantillons, query, statut, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <>
      <p className="fr-text--sm">
        Les échantillons se créent depuis la page de chaque carcasse de sanglier, puis se regroupent en pool
        (19 carcasses maximum) pour être envoyés au laboratoire.
      </p>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Référence, n° de carcasse, pool"
        statut={statut}
        onStatutChange={setStatut}
        statutOptions={[...statutAnalyseOptions, { value: 'SANS_POOL', label: 'Sans pool' }]}
      />
      <TableFilterable
        data={rows}
        rowKey="id"
        noData={
          echantillons.length ? 'Aucun échantillon ne correspond aux filtres' : 'Aucun échantillon prélevé'
        }
        renderCellSmallDevices={(echantillon) => (
          <tr
            key={echantillon.id}
            className="border-b border-gray-200"
          >
            <td className="p-3">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{echantillon.reference_echantillon}</span>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    small
                    severity={statutAnalyseBadgeSeverity(echantillon.statut)}
                  >
                    {statutAnalyseLabels[echantillon.statut]}
                  </Badge>
                  {echantillon.resultat_analyse && (
                    <Badge
                      small
                      severity={resultatBadgeSeverity(echantillon.resultat_analyse)}
                    >
                      {resultatAnalyseLabels[echantillon.resultat_analyse]}
                    </Badge>
                  )}
                </div>
                <p className="fr-text--sm fr-mb-0">
                  <span className="font-semibold">Carcasse&nbsp;:</span>{' '}
                  {echantillon.Carcasse.numero_bracelet}
                  <br />
                  <span className="font-semibold">Prélevé le&nbsp;:</span>{' '}
                  {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')} — {echantillon.masse_grammes}
                  &nbsp;g — {sitePrelevementLabels[echantillon.site_prelevement]}
                  <br />
                  <span className="font-semibold">Pool&nbsp;:</span>{' '}
                  {echantillon.TrichinePool?.reference_pool ?? 'à regrouper'}
                </p>
              </div>
            </td>
          </tr>
        )}
        columns={[
          {
            dataKey: 'reference_echantillon',
            title: 'Référence',
            ...sortProps,
            render: (echantillon) => (
              <span className="font-semibold">{echantillon.reference_echantillon}</span>
            ),
          },
          {
            dataKey: 'zacharie_carcasse_id',
            title: 'Carcasse',
            render: (echantillon) => echantillon.Carcasse.numero_bracelet,
          },
          {
            dataKey: 'date_prelevement',
            title: 'Prélevé le',
            ...sortProps,
            render: (echantillon) => dayjs(echantillon.date_prelevement).format('DD/MM/YYYY'),
          },
          {
            dataKey: 'masse_grammes',
            title: 'Masse',
            small: true,
            render: (echantillon) => `${echantillon.masse_grammes} g`,
          },
          {
            dataKey: 'site_prelevement',
            title: 'Site',
            render: (echantillon) => sitePrelevementLabels[echantillon.site_prelevement],
          },
          {
            dataKey: 'pool_id',
            title: 'Pool',
            render: (echantillon) =>
              echantillon.TrichinePool?.reference_pool ?? (
                <Badge
                  small
                  severity="new"
                >
                  À regrouper
                </Badge>
              ),
          },
          {
            dataKey: 'statut',
            title: 'Statut',
            render: (echantillon) => (
              <Badge
                small
                severity={statutAnalyseBadgeSeverity(echantillon.statut)}
              >
                {statutAnalyseLabels[echantillon.statut]}
              </Badge>
            ),
          },
          {
            dataKey: 'resultat_analyse',
            title: 'Résultat',
            render: (echantillon) =>
              echantillon.resultat_analyse ? (
                <Badge
                  small
                  severity={resultatBadgeSeverity(echantillon.resultat_analyse)}
                >
                  {resultatAnalyseLabels[echantillon.resultat_analyse]}
                </Badge>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <div className="fr-mt-2w">
        <Button
          type="button"
          disabled={!echantillons.some((echantillon) => !echantillon.pool_id)}
          onClick={() => navigate(`${basePath}/nouveau-pool`)}
        >
          Créer un nouveau pool
        </Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Pools                                                                       */
/* -------------------------------------------------------------------------- */

function TabPools({ pools }: { pools: Array<TrichinePoolPopulated> }) {
  const basePath = useTrichineBasePath();
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [sortBy, setSortBy] = useState<keyof TrichinePoolPopulated>('date_constitution');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  const ftpNumeros = useCallback(
    (pool: TrichinePoolPopulated) =>
      pool.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at)
        .map((link) => link.TrichineFTP.numero_fiche)
        .join(', '),
    []
  );

  const rows = useMemo(() => {
    let filtered = pools;
    if (statut) filtered = filtered.filter((pool) => pool.statut === statut);
    filtered = filterTrichineRows(filtered, query, (pool) => `${pool.reference_pool} ${ftpNumeros(pool)}`);
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [pools, query, statut, sortBy, sortOrder, ftpNumeros]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="Référence du pool, n° de FTP"
        statut={statut}
        onStatutChange={setStatut}
        statutOptions={statutAnalyseOptions}
      />
      <TableFilterable
        data={rows}
        rowKey="id"
        noData={pools.length ? 'Aucun pool ne correspond aux filtres' : 'Aucun pool constitué'}
        renderCellSmallDevices={(pool) => {
          const statutUtilisateur = statutUtilisateurPool(pool);
          return (
            <tr
              key={pool.id}
              className="border-b border-gray-200"
            >
              <td className="p-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{pool.reference_pool}</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      small
                      severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}
                    >
                      {statutUtilisateur}
                    </Badge>
                    <Badge
                      small
                      severity={statutAnalyseBadgeSeverity(pool.statut)}
                    >
                      {statutAnalyseLabels[pool.statut]}
                    </Badge>
                    {pool.resultat_analyse && (
                      <Badge
                        small
                        severity={resultatBadgeSeverity(pool.resultat_analyse)}
                      >
                        {resultatAnalyseLabels[pool.resultat_analyse]}
                      </Badge>
                    )}
                  </div>
                  <p className="fr-text--sm fr-mb-0">
                    <span className="font-semibold">Échantillons&nbsp;:</span>{' '}
                    {pool.TrichineEchantillons.length}
                    <br />
                    <span className="font-semibold">Constitué le&nbsp;:</span>{' '}
                    {dayjs(pool.date_constitution).format('DD/MM/YYYY')}
                    <br />
                    <span className="font-semibold">FTP&nbsp;:</span> {ftpNumeros(pool) || '—'}
                    {pool.raison_refus && (
                      <>
                        <br />
                        <span className="font-semibold">Refus&nbsp;:</span> {pool.raison_refus}
                      </>
                    )}
                  </p>
                </div>
              </td>
            </tr>
          );
        }}
        columns={[
          {
            dataKey: 'reference_pool',
            title: 'Référence',
            ...sortProps,
            render: (pool) => <span className="font-semibold">{pool.reference_pool}</span>,
          },
          {
            dataKey: 'date_constitution',
            title: 'Constitué le',
            ...sortProps,
            render: (pool) => dayjs(pool.date_constitution).format('DD/MM/YYYY'),
          },
          {
            dataKey: 'id',
            title: 'Échantillons',
            small: true,
            render: (pool) => pool.TrichineEchantillons.length,
          },
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'updated_at',
            title: 'FTP',
            render: (pool) => ftpNumeros(pool) || '—',
          },
          {
            dataKey: 'statut',
            title: 'Statut',
            render: (pool) => (
              <Badge
                small
                severity={statutAnalyseBadgeSeverity(pool.statut)}
              >
                {statutAnalyseLabels[pool.statut]}
              </Badge>
            ),
          },
          {
            dataKey: 'resultat_analyse',
            title: 'Résultat',
            render: (pool) =>
              pool.resultat_analyse ? (
                <Badge
                  small
                  severity={resultatBadgeSeverity(pool.resultat_analyse)}
                >
                  {resultatAnalyseLabels[pool.resultat_analyse]}
                </Badge>
              ) : (
                '—'
              ),
          },
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'cree_par_user_id',
            title: 'Suivi',
            render: (pool) => {
              const statutUtilisateur = statutUtilisateurPool(pool);
              return (
                <Badge
                  small
                  severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}
                >
                  {statutUtilisateur}
                </Badge>
              );
            },
          },
        ]}
      />
      <div className="fr-mt-2w flex flex-wrap gap-2">
        <Button linkProps={{ to: `${basePath}/nouveau-pool` }}>Créer un nouveau pool</Button>
        <Button
          priority="secondary"
          linkProps={{ to: `${basePath}/nouvelle-ftp` }}
        >
          Créer une FTP
        </Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* FTP                                                                         */
/* -------------------------------------------------------------------------- */

const statutLogistiqueOptions = Object.values(TrichineStatutLogistiqueFTP).map((statut) => ({
  value: statut,
  label: statutLogistiqueLabels[statut],
}));

function TabFTPs({ ftps, onChanged }: { ftps: Array<TrichineFTPPopulated>; onChanged: () => void }) {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statut, setStatut] = useState('');
  const [sortBy, setSortBy] = useState<keyof TrichineFTPPopulated>('date_creation');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  const rows = useMemo(() => {
    let filtered = ftps;
    if (statut) filtered = filtered.filter((ftp) => ftp.statut_logistique === statut);
    filtered = filterTrichineRows(
      filtered,
      query,
      (ftp) =>
        `${ftp.numero_fiche} ${ftp.DestinataireEntity.nom_d_usage ?? ''} ${ftp.DestinataireEntity.raison_sociale ?? ''}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [ftps, query, statut, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  const envoyer = (ftp: TrichineFTPPopulated) => {
    setSendingId(ftp.id);
    envoyerTrichineFTP(ftp.id)
      .then((response) => {
        if (response.ok) {
          toast.success(`FTP ${ftp.numero_fiche} envoyée au laboratoire`);
          onChanged();
        } else {
          toast.error(response.error || 'Une erreur est survenue');
        }
      })
      .catch(() => toast.error('Une erreur est survenue'))
      .finally(() => setSendingId(null));
  };

  const actions = (ftp: TrichineFTPPopulated) => (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        priority="tertiary"
        size="small"
        onClick={() => navigate(`${basePath}/ftp/${ftp.id}`)}
      >
        Voir
      </Button>
      {ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON && (
        <Button
          type="button"
          size="small"
          disabled={sendingId === ftp.id}
          onClick={() => envoyer(ftp)}
        >
          Envoyer
        </Button>
      )}
    </div>
  );

  return (
    <>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        searchHint="N° de FTP, laboratoire"
        statut={statut}
        onStatutChange={setStatut}
        statutOptions={statutLogistiqueOptions}
      />
      <TableFilterable
        data={rows}
        rowKey="id"
        noData={
          ftps.length
            ? 'Aucune FTP ne correspond aux filtres'
            : 'Aucune fiche de transmission des prélèvements (FTP)'
        }
        renderCellSmallDevices={(ftp) => {
          const statutUtilisateur = statutUtilisateurFTP(ftp);
          return (
            <tr
              key={ftp.id}
              className="border-b border-gray-200"
            >
              <td className="p-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{ftp.numero_fiche}</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      small
                      severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}
                    >
                      {statutUtilisateur}
                    </Badge>
                    <Badge
                      small
                      severity="info"
                    >
                      {statutLogistiqueLabels[ftp.statut_logistique]}
                    </Badge>
                    <Badge
                      small
                      severity={statutAnalyseBadgeSeverity(ftp.statut_analytique)}
                    >
                      {statutAnalyseLabels[ftp.statut_analytique]}
                    </Badge>
                  </div>
                  <p className="fr-text--sm fr-mb-0">
                    <span className="font-semibold">Laboratoire&nbsp;:</span>{' '}
                    {ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale}
                    <br />
                    <span className="font-semibold">Pools&nbsp;:</span> {ftp.TrichinePoolFTPs.length}
                    {ftp.date_envoi && (
                      <>
                        <br />
                        <span className="font-semibold">Envoyée le&nbsp;:</span>{' '}
                        {dayjs(ftp.date_envoi).format('DD/MM/YYYY')}
                      </>
                    )}
                  </p>
                  {actions(ftp)}
                </div>
              </td>
            </tr>
          );
        }}
        columns={[
          {
            dataKey: 'numero_fiche',
            title: 'Numéro',
            ...sortProps,
            render: (ftp) => <span className="font-semibold">{ftp.numero_fiche}</span>,
          },
          {
            dataKey: 'destinataire_entity_id',
            title: 'Laboratoire',
            render: (ftp) => ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale,
          },
          {
            dataKey: 'id',
            title: 'Pools',
            small: true,
            render: (ftp) => ftp.TrichinePoolFTPs.length,
          },
          {
            dataKey: 'date_envoi',
            title: 'Envoyée le',
            ...sortProps,
            render: (ftp) => (ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : '—'),
          },
          {
            dataKey: 'statut_logistique',
            title: 'Statut logistique',
            render: (ftp) => (
              <Badge
                small
                severity="info"
              >
                {statutLogistiqueLabels[ftp.statut_logistique]}
              </Badge>
            ),
          },
          {
            dataKey: 'statut_analytique',
            title: 'Statut analytique',
            render: (ftp) => (
              <Badge
                small
                severity={statutAnalyseBadgeSeverity(ftp.statut_analytique)}
              >
                {statutAnalyseLabels[ftp.statut_analytique]}
              </Badge>
            ),
          },
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'expediteur_user_id',
            title: 'Actions',
            render: (ftp) => actions(ftp),
          },
        ]}
      />
      <div className="fr-mt-2w">
        <Button linkProps={{ to: `${basePath}/nouvelle-ftp` }}>Créer une FTP</Button>
      </div>
    </>
  );
}
