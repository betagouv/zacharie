import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import TableFilterable from '@app/components/TableFilterable';
import TrichineListPage, {
  FiltreSelect,
  TrichineListToolbar,
} from '@app/components/trichine/TrichineListPage';
import { useListParam } from '@app/utils/trichine-list-params';
import {
  dateFmt,
  ResultatBadge,
  statutAnalyseOptions,
  StatutBadge,
} from '@app/components/laboratoire/cellules';
import { getLaboPools, type LaboPoolRegistre } from '@app/services/laboratoire';
import {
  filterTrichineRows,
  sortTrichineRows,
  trichineTypeLabels,
  type TrichineSortOrder,
} from '@app/utils/trichine';

const VUES = [
  { value: 'a-analyser', label: 'À analyser' },
  { value: 'avec-resultat', label: 'Résultat saisi' },
  { value: 'tous', label: 'Tous' },
];

function ftpNumeros(pool: LaboPoolRegistre): string {
  return pool.TrichinePoolFTPs.map((link) => link.TrichineFTP.numero_fiche).join(', ');
}

export default function LaboratoirePools() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<Array<LaboPoolRegistre>>([]);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [statut, setStatut] = useListParam('statut', '');
  const [sortBy, setSortBy] = useState<keyof LaboPoolRegistre>('date_constitution');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getLaboPools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, []);

  const compteurs = useMemo(
    () => ({
      total: pools.length,
      aAnalyser: pools.filter((pool) => !pool.resultat_analyse && pool.date_reception).length,
      enTransit: pools.filter((pool) => !pool.date_reception).length,
      avecResultat: pools.filter((pool) => pool.resultat_analyse).length,
    }),
    [pools]
  );

  const rows = useMemo(() => {
    let filtered = pools;
    if (vue === 'a-analyser') {
      filtered = filtered.filter((pool) => !pool.resultat_analyse && pool.date_reception);
    }
    if (vue === 'avec-resultat') filtered = filtered.filter((pool) => pool.resultat_analyse);
    if (statut) filtered = filtered.filter((pool) => pool.statut === statut);
    filtered = filterTrichineRows(
      filtered,
      query,
      (pool) => `${pool.reference_pool} ${ftpNumeros(pool)} ${pool.PoolParent?.reference_pool ?? ''}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [pools, query, vue, statut, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <TrichineListPage
      titre="Pools"
      description="Pools reçus par votre laboratoire. Le résultat d'analyse se saisit sur la page d'un pool ou depuis sa fiche de transmission."
      stats={[
        { value: compteurs.total, label: 'Pools reçus' },
        { value: compteurs.aAnalyser, label: 'À analyser' },
        { value: compteurs.enTransit, label: 'Colis pas encore reçus' },
        { value: compteurs.avecResultat, label: 'Résultat saisi' },
      ]}
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="Référence de pool, n° de fiche, pool parent"
        >
          <FiltreSelect
            label="Affichage"
            value={vue}
            onChange={setVue}
            options={VUES}
          />
          <FiltreSelect
            label="Statut"
            value={statut}
            onChange={setStatut}
            options={[{ value: '', label: 'Tous les statuts' }, ...statutAnalyseOptions]}
          />
        </TrichineListToolbar>
      }
    >
      {!hasTriedLoading ? (
        <p className="fr-text--sm">Chargement…</p>
      ) : (
        <div className="overflow-x-auto [&_td]:align-middle [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <TableFilterable
            data={rows}
            rowKey="id"
            onRowClick={(pool) => navigate(`/app/laboratoire/pools/${pool.reference_pool}`)}
            noData={pools.length ? 'Aucun pool ne correspond' : 'Aucun pool reçu'}
            renderCellSmallDevices={(pool) => (
              <tr
                key={pool.id}
                onClick={() => navigate(`/app/laboratoire/pools/${pool.reference_pool}`)}
              >
                <td className="block border-none p-0">
                  <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{pool.reference_pool}</span>
                      <StatutBadge statut={pool.statut} />
                    </div>
                    <div className="fr-text--xs m-0 mt-1 text-gray-500">
                      {trichineTypeLabels[pool.type]} · {pool.TrichineEchantillons.length} échantillon(s) ·{' '}
                      {ftpNumeros(pool) || 'sans fiche'}
                    </div>
                    <div className="mt-2">
                      <ResultatBadge resultat={pool.resultat_analyse} />
                    </div>
                  </div>
                </td>
              </tr>
            )}
            columns={[
              {
                dataKey: 'reference_pool',
                title: 'Référence',
                ...sortProps,
                render: (pool) => <span className="font-semibold">{pool.reference_pool}</span>,
              },
              { dataKey: 'type', title: 'Type', render: (pool) => trichineTypeLabels[pool.type] },
              {
                dataKey: 'pool_parent_id',
                title: 'Pool parent',
                render: (pool) => pool.PoolParent?.reference_pool ?? '—',
              },
              {
                dataKey: 'id',
                title: 'Éch.',
                small: true,
                render: (pool) => pool.TrichineEchantillons.length,
              },
              { dataKey: 'updated_at', title: 'Fiche', render: (pool) => ftpNumeros(pool) || '—' },
              {
                dataKey: 'date_reception',
                title: 'Reçu le',
                render: (pool) => dateFmt(pool.date_reception),
              },
              {
                dataKey: 'date_fin_analyse',
                title: 'Fin analyse',
                render: (pool) => dateFmt(pool.date_fin_analyse),
              },
              { dataKey: 'statut', title: 'Statut', render: (pool) => <StatutBadge statut={pool.statut} /> },
              {
                dataKey: 'resultat_analyse',
                title: 'Résultat',
                render: (pool) => <ResultatBadge resultat={pool.resultat_analyse} />,
              },
              {
                dataKey: 'reference_labo',
                title: 'Réf. labo',
                render: (pool) => pool.reference_labo || '—',
              },
            ]}
          />
        </div>
      )}
    </TrichineListPage>
  );
}
