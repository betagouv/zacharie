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
import { getLaboEchantillons, type LaboEchantillonRegistre } from '@app/services/laboratoire';
import {
  filterTrichineRows,
  sitePrelevementLabels,
  sortTrichineRows,
  trichineTypeLabels,
  type TrichineSortOrder,
} from '@app/utils/trichine';

const VUES = [
  { value: 'tous', label: 'Tous' },
  { value: 'en-attente', label: 'Sans résultat' },
  { value: 'avec-resultat', label: 'Résultat connu' },
];

/**
 * Registre réglementaire des échantillons reçus. Vue de consultation : un échantillon n'est
 * jamais analysé seul, tout se joue au niveau du pool — chaque ligne y mène.
 */
export default function LaboratoireEchantillons() {
  const navigate = useNavigate();
  const [echantillons, setEchantillons] = useState<Array<LaboEchantillonRegistre>>([]);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [statut, setStatut] = useListParam('statut', '');
  const [sortBy, setSortBy] = useState<keyof LaboEchantillonRegistre>('date_prelevement');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getLaboEchantillons()
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, []);

  const compteurs = useMemo(
    () => ({
      total: echantillons.length,
      carcasses: new Set(echantillons.map((echantillon) => echantillon.zacharie_carcasse_id)).size,
      sansResultat: echantillons.filter((echantillon) => !echantillon.resultat_analyse).length,
    }),
    [echantillons]
  );

  const rows = useMemo(() => {
    let filtered = echantillons;
    if (vue === 'en-attente') filtered = filtered.filter((echantillon) => !echantillon.resultat_analyse);
    if (vue === 'avec-resultat') filtered = filtered.filter((echantillon) => echantillon.resultat_analyse);
    if (statut) filtered = filtered.filter((echantillon) => echantillon.statut === statut);
    filtered = filterTrichineRows(
      filtered,
      query,
      (echantillon) =>
        `${echantillon.reference_echantillon} ${echantillon.Carcasse.numero_bracelet} ${
          echantillon.TrichinePool?.reference_pool ?? ''
        }`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [echantillons, query, vue, statut, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };
  const ouvrirPool = (echantillon: LaboEchantillonRegistre) => {
    if (echantillon.TrichinePool) {
      navigate(`/app/laboratoire/pools/${echantillon.TrichinePool.reference_pool}`);
    }
  };

  return (
    <TrichineListPage
      titre="Échantillons"
      description="Registre des échantillons reçus par votre laboratoire. L'analyse porte sur le pool : chaque ligne mène au pool qui la contient."
      stats={[
        { value: compteurs.total, label: 'Échantillons reçus' },
        { value: compteurs.carcasses, label: 'Carcasses concernées' },
        { value: compteurs.sansResultat, label: 'Sans résultat' },
      ]}
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="Référence, n° de marquage, pool"
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
            onRowClick={ouvrirPool}
            noData={echantillons.length ? 'Aucun échantillon ne correspond' : 'Aucun échantillon reçu'}
            renderCellSmallDevices={(echantillon) => (
              <tr
                key={echantillon.id}
                onClick={() => ouvrirPool(echantillon)}
              >
                <td className="block border-none p-0">
                  <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{echantillon.reference_echantillon}</span>
                      <StatutBadge statut={echantillon.statut} />
                    </div>
                    <div className="fr-text--xs m-0 mt-1 text-gray-500">
                      {echantillon.Carcasse.numero_bracelet} · {trichineTypeLabels[echantillon.type]} ·{' '}
                      {echantillon.TrichinePool?.reference_pool ?? 'sans pool'}
                    </div>
                    <div className="mt-2">
                      <ResultatBadge resultat={echantillon.resultat_analyse} />
                    </div>
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
                title: 'N° de marquage',
                render: (echantillon) => echantillon.Carcasse.numero_bracelet,
              },
              {
                dataKey: 'type',
                title: 'Type',
                render: (echantillon) => trichineTypeLabels[echantillon.type],
              },
              {
                dataKey: 'site_prelevement',
                title: 'Site',
                render: (echantillon) => sitePrelevementLabels[echantillon.site_prelevement],
              },
              {
                dataKey: 'masse_grammes',
                title: 'Masse',
                small: true,
                render: (echantillon) => `${echantillon.masse_grammes} g`,
              },
              {
                dataKey: 'date_prelevement',
                title: 'Prélevé le',
                ...sortProps,
                render: (echantillon) => dateFmt(echantillon.date_prelevement),
              },
              {
                dataKey: 'pool_id',
                title: 'Pool',
                render: (echantillon) => echantillon.TrichinePool?.reference_pool ?? '—',
              },
              {
                dataKey: 'statut',
                title: 'Statut',
                render: (echantillon) => <StatutBadge statut={echantillon.statut} />,
              },
              {
                dataKey: 'resultat_analyse',
                title: 'Résultat',
                render: (echantillon) => <ResultatBadge resultat={echantillon.resultat_analyse} />,
              },
            ]}
          />
        </div>
      )}
    </TrichineListPage>
  );
}
