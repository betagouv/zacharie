import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineStatutAnalyse, TrichineType } from '@prisma/client';
import TableFilterable from '@app/components/TableFilterable';
import LienTrichine from '@app/components/trichine/LienTrichine';
import TrichineListPage, {
  FiltrePeriode,
  FiltreSelect,
  TrichineListToolbar,
} from '@app/components/trichine/TrichineListPage';
import { useListParam } from '@app/utils/trichine-list-params';
import {
  useTrichineBasePath,
  useTrichineCarcasseLink,
  useTrichinePrelevementEnLot,
} from '@app/utils/trichine-hooks';
import { getTrichineEchantillons, type TrichineEchantillonWithCarcasse } from '@app/services/trichine';
import {
  filterParPeriode,
  filterTrichineRows,
  isResultatDefavorable,
  optionsDepuisColonne,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  resultatCourtLabels,
  sortTrichineRows,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  type TrichineSortOrder,
} from '@app/utils/trichine';

// Options du filtre « Statut » : exactement les statuts affichés dans la colonne Statut
const STATUTS = [
  { value: 'tous', label: 'Tous' },
  ...Object.values(TrichineStatutAnalyse).map((statut) => ({
    value: statut as string,
    label: statutAnalyseLabels[statut],
  })),
];

const RESULTATS = [
  { value: '', label: 'Tous' },
  { value: 'AUCUN', label: 'Sans résultat' },
  { value: 'DEFAVORABLE', label: 'Défavorables uniquement' },
  ...Object.values(TrichineResultatAnalyse).map((resultat) => ({
    value: resultat,
    label: resultatAnalyseLabels[resultat],
  })),
];

// Seuls des prélèvements initiaux pas encore regroupés peuvent constituer un nouveau pool.
// Les complémentaires se regroupent depuis le pool douteux (2e intention).
function estRegroupable(echantillon: TrichineEchantillonWithCarcasse): boolean {
  return !echantillon.pool_id && echantillon.type === TrichineType.INITIAL;
}

export default function TrichineEchantillons() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const prelevementEnLot = useTrichinePrelevementEnLot();
  const carcasseLink = useTrichineCarcasseLink();
  const [echantillons, setEchantillons] = useState<Array<TrichineEchantillonWithCarcasse>>([]);
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [pool, setPool] = useListParam('pool', '');
  const [resultat, setResultat] = useListParam('resultat', '');
  const [du, setDu] = useListParam('du', '');
  const [au, setAu] = useListParam('au', '');
  const [sortBy, setSortBy] = useState<keyof TrichineEchantillonWithCarcasse>('date_prelevement');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichineEchantillons()
      .then((response) => response.ok && response.data && setEchantillons(response.data.echantillons))
      .catch(console.error);
  }, []);

  const stats = useMemo(
    () => ({
      total: echantillons.length,
      sansPool: echantillons.filter((echantillon) => !echantillon.pool_id).length,
      termines: echantillons.filter(
        (echantillon) => echantillon.statut === TrichineStatutAnalyse.ANALYSES_TERMINEES
      ).length,
    }),
    [echantillons]
  );

  const poolOptions = useMemo(
    () => [
      { value: '', label: 'Tous' },
      { value: 'sans', label: 'Sans pool' },
      ...optionsDepuisColonne(echantillons.map((echantillon) => echantillon.TrichinePool?.reference_pool)),
    ],
    [echantillons]
  );

  const rows = useMemo(() => {
    let filtered = echantillons;
    if (vue !== 'tous') filtered = filtered.filter((echantillon) => echantillon.statut === vue);
    if (pool === 'sans') filtered = filtered.filter((echantillon) => !echantillon.pool_id);
    else if (pool) {
      filtered = filtered.filter((echantillon) => echantillon.TrichinePool?.reference_pool === pool);
    }
    if (resultat === 'AUCUN') {
      filtered = filtered.filter((echantillon) => !echantillon.resultat_analyse);
    } else if (resultat === 'DEFAVORABLE') {
      filtered = filtered.filter((echantillon) => isResultatDefavorable(echantillon.resultat_analyse));
    } else if (resultat) {
      filtered = filtered.filter((echantillon) => echantillon.resultat_analyse === resultat);
    }
    filtered = filterParPeriode(filtered, du, au, (echantillon) => echantillon.date_prelevement);
    filtered = filterTrichineRows(
      filtered,
      query,
      (echantillon) =>
        `${echantillon.reference_echantillon} ${echantillon.Carcasse.numero_bracelet ?? ''} ${
          echantillon.TrichinePool?.reference_pool ?? ''
        }`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [echantillons, query, vue, pool, resultat, du, au, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <TrichineListPage
      titre="Échantillons"
      stats={[
        { value: stats.total, label: 'Échantillons' },
        { value: stats.sansPool, label: 'À regrouper' },
        { value: stats.termines, label: 'Analyses terminées' },
      ]}
      actions={
        <>
          {prelevementEnLot && (
            <Button linkProps={{ to: `${basePath}/prelever` }}>Prélever des carcasses</Button>
          )}
          <Button
            type="button"
            priority="secondary"
            disabled={!stats.sansPool}
            onClick={() =>
              navigate(
                `${basePath}/nouveau-pool${selectedIds.length ? `?echantillons=${selectedIds.join(',')}` : ''}`
              )
            }
          >
            Créer un pool{selectedIds.length ? ` (${selectedIds.length})` : ''}
          </Button>
        </>
      }
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="Référence, n° de bracelet, pool"
        >
          <FiltreSelect
            label="Statut"
            value={vue}
            onChange={setVue}
            options={STATUTS}
          />
          <FiltreSelect
            label="Résultat"
            value={resultat}
            onChange={setResultat}
            options={RESULTATS}
          />
          <FiltreSelect
            label="Pool"
            value={pool}
            onChange={setPool}
            options={poolOptions}
          />
          <FiltrePeriode
            label="Prélevé le"
            du={du}
            au={au}
            onDuChange={setDu}
            onAuChange={setAu}
          />
        </TrichineListToolbar>
      }
    >
      <TableFilterable
        data={rows}
        rowKey="id"
        withCheckbox
        checked={selectedIds}
        onCheck={setSelectedIds}
        checkboxDisabled={(echantillon) => !estRegroupable(echantillon)}
        onRowClick={(echantillon) =>
          navigate(`${basePath}/echantillons/${echantillon.reference_echantillon}`)
        }
        noData={
          echantillons.length ? 'Aucun échantillon ne correspond aux filtres' : 'Aucun échantillon prélevé'
        }
        renderCellSmallDevices={(echantillon) => (
          <tr
            key={echantillon.id}
            className="border-b border-gray-200"
            onClick={() => navigate(`${basePath}/echantillons/${echantillon.reference_echantillon}`)}
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
                  {!!echantillon.resultat_analyse && (
                    <Badge
                      small
                      severity={resultatBadgeSeverity(echantillon.resultat_analyse)}
                    >
                      {resultatCourtLabels[echantillon.resultat_analyse]}
                    </Badge>
                  )}
                </div>
                <p className="fr-text--sm fr-mb-0 text-gray-600">
                  {echantillon.Carcasse.numero_bracelet} — prélevé le{' '}
                  {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}
                  <br />
                  Pool : {echantillon.TrichinePool?.reference_pool ?? 'à regrouper'}
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
            render: (echantillon) => {
              const lienCarcasse = carcasseLink(echantillon.Carcasse);
              if (!lienCarcasse) return echantillon.Carcasse.numero_bracelet;
              return <LienTrichine to={lienCarcasse}>{echantillon.Carcasse.numero_bracelet}</LienTrichine>;
            },
          },
          {
            dataKey: 'date_prelevement',
            title: 'Prélevé le',
            ...sortProps,
            render: (echantillon) => dayjs(echantillon.date_prelevement).format('DD/MM/YYYY'),
          },
          {
            dataKey: 'pool_id',
            title: 'Pool',
            render: (echantillon) =>
              echantillon.TrichinePool ? (
                <LienTrichine to={`${basePath}/pools/${echantillon.TrichinePool.reference_pool}`}>
                  {echantillon.TrichinePool.reference_pool}
                </LienTrichine>
              ) : (
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
                  {resultatCourtLabels[echantillon.resultat_analyse]}
                </Badge>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </TrichineListPage>
  );
}
