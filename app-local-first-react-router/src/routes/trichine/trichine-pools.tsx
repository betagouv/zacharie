import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse } from '@prisma/client';
import TableFilterable from '@app/components/TableFilterable';
import LienTrichine from '@app/components/trichine/LienTrichine';
import TrichineListPage, {
  FiltrePeriode,
  FiltreSelect,
  TrichineListToolbar,
} from '@app/components/trichine/TrichineListPage';
import { useListParam } from '@app/utils/trichine-list-params';
import { useCarcassesAvecIpm2, useTrichineBasePath } from '@app/utils/trichine-hooks';
import { getTrichinePools, type TrichinePoolPopulated } from '@app/services/trichine';
import {
  filterByStatutUtilisateur,
  filterParPeriode,
  filterTrichineRows,
  isResultatDefavorable,
  optionsDepuisColonne,
  poolEnAttenteIpm2,
  poolSansFTP,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  resultatCourtLabels,
  sortTrichineRows,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurPool,
  statutUtilisateurVues,
  type TrichineSortOrder,
} from '@app/utils/trichine';

const RESULTATS = [
  { value: '', label: 'Tous' },
  { value: 'AUCUN', label: 'Sans résultat' },
  { value: 'DEFAVORABLE', label: 'Défavorables uniquement' },
  { value: 'DEFAVORABLE_SANS_IPM2', label: 'Défavorables sans IPM2' },
  ...Object.values(TrichineResultatAnalyse).map((resultat) => ({
    value: resultat,
    label: resultatAnalyseLabels[resultat],
  })),
];

// Numéros des FTP auxquelles le pool est rattaché (une FTP supprimée ne compte plus)
function ftpNumerosListe(pool: TrichinePoolPopulated): Array<string> {
  return pool.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at).map(
    (link) => link.TrichineFTP.numero_fiche
  );
}

function ftpNumeros(pool: TrichinePoolPopulated): string {
  return ftpNumerosListe(pool).join(', ');
}

export default function TrichinePools() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const carcassesAvecIpm2 = useCarcassesAvecIpm2();
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [resultat, setResultat] = useListParam('resultat', '');
  const [ftp, setFtp] = useListParam('ftp', '');
  const [nbEchantillons, setNbEchantillons] = useListParam('echantillons', '');
  const [du, setDu] = useListParam('du', '');
  const [au, setAu] = useListParam('au', '');
  const [sortBy, setSortBy] = useState<keyof TrichinePoolPopulated>('date_constitution');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichinePools()
      .then((response) => response.ok && response.data && setPools(response.data.pools))
      .catch(console.error);
  }, []);

  const stats = useMemo(
    () => ({
      total: pools.length,
      aEnvoyer: pools.filter((pool) => poolSansFTP(pool)).length,
      enCours: pools.filter((pool) => statutUtilisateurPool(pool) === 'En cours').length,
      defavorables: pools.filter((pool) => isResultatDefavorable(pool.resultat_analyse)).length,
    }),
    [pools]
  );

  const ftpOptions = useMemo(
    () => [
      { value: '', label: 'Toutes' },
      { value: 'sans', label: 'Sans transmission' },
      ...optionsDepuisColonne(pools.flatMap(ftpNumerosListe)),
    ],
    [pools]
  );

  const nbEchantillonsOptions = useMemo(
    () => [
      { value: '', label: 'Tous' },
      ...optionsDepuisColonne(pools.map((pool) => String(pool.TrichineEchantillons.length))),
    ],
    [pools]
  );

  const rows = useMemo(() => {
    let filtered = filterByStatutUtilisateur(pools, vue, statutUtilisateurPool);
    if (resultat === 'DEFAVORABLE') {
      filtered = filtered.filter((pool) => isResultatDefavorable(pool.resultat_analyse));
    } else if (resultat === 'DEFAVORABLE_SANS_IPM2') {
      // Défavorables sur lesquels le SVI n'a pas encore statué : ce que signale l'alerte d'accueil
      filtered = filtered.filter(
        (pool) => isResultatDefavorable(pool.resultat_analyse) && poolEnAttenteIpm2(pool, carcassesAvecIpm2)
      );
    } else if (resultat === 'AUCUN') {
      filtered = filtered.filter((pool) => !pool.resultat_analyse);
    } else if (resultat) {
      filtered = filtered.filter((pool) => pool.resultat_analyse === resultat);
    }
    if (ftp === 'sans') filtered = filtered.filter((pool) => poolSansFTP(pool));
    else if (ftp) filtered = filtered.filter((pool) => ftpNumerosListe(pool).includes(ftp));
    if (nbEchantillons) {
      filtered = filtered.filter((pool) => String(pool.TrichineEchantillons.length) === nbEchantillons);
    }
    filtered = filterParPeriode(filtered, du, au, (pool) => pool.date_constitution);
    filtered = filterTrichineRows(filtered, query, (pool) => `${pool.reference_pool} ${ftpNumeros(pool)}`);
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [pools, query, vue, resultat, ftp, nbEchantillons, du, au, sortBy, sortOrder, carcassesAvecIpm2]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <TrichineListPage
      titre="Pools"
      stats={[
        { value: stats.total, label: 'Pools' },
        { value: stats.aEnvoyer, label: 'À envoyer' },
        { value: stats.enCours, label: 'En analyse' },
        { value: stats.defavorables, label: 'Résultats défavorables' },
      ]}
      actions={
        <>
          <Button
            priority="secondary"
            linkProps={{ to: `${basePath}/nouveau-pool` }}
          >
            Créer un pool
          </Button>
          <Button
            type="button"
            disabled={!stats.aEnvoyer}
            onClick={() => navigate(`${basePath}/nouvelle-ftp`)}
          >
            Envoyer au laboratoire
          </Button>
        </>
      }
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="Référence de pool, n° de FTP"
        >
          <FiltreSelect
            label="Suivi"
            value={vue}
            onChange={setVue}
            options={statutUtilisateurVues}
          />
          <FiltreSelect
            label="Résultat"
            value={resultat}
            onChange={setResultat}
            options={RESULTATS}
          />
          <FiltreSelect
            label="FTP"
            value={ftp}
            onChange={setFtp}
            options={ftpOptions}
          />
          <FiltreSelect
            label="Échantillons"
            value={nbEchantillons}
            onChange={setNbEchantillons}
            options={nbEchantillonsOptions}
          />
          <FiltrePeriode
            label="Constitué le"
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
        onRowClick={(pool) => navigate(`${basePath}/pools/${pool.reference_pool}`)}
        noData={pools.length ? 'Aucun pool ne correspond aux filtres' : 'Aucun pool constitué'}
        renderCellSmallDevices={(pool) => (
          <tr
            key={pool.id}
            className="border-b border-gray-200"
            onClick={() => navigate(`${basePath}/pools/${pool.reference_pool}`)}
          >
            <td className="p-3">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{pool.reference_pool}</span>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    small
                    severity={statutUtilisateurBadgeSeverity(statutUtilisateurPool(pool))}
                  >
                    {statutUtilisateurPool(pool)}
                  </Badge>
                  {!!pool.resultat_analyse && (
                    <Badge
                      small
                      severity={resultatBadgeSeverity(pool.resultat_analyse)}
                    >
                      {resultatCourtLabels[pool.resultat_analyse]}
                    </Badge>
                  )}
                </div>
                <p className="fr-text--sm fr-mb-0 text-gray-600">
                  {pool.TrichineEchantillons.length} échantillon
                  {pool.TrichineEchantillons.length > 1 ? 's' : ''} — constitué le{' '}
                  {dayjs(pool.date_constitution).format('DD/MM/YYYY')}
                  <br />
                  FTP : {ftpNumeros(pool) || '—'}
                </p>
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
          {
            dataKey: 'date_constitution',
            title: 'Constitué le',
            ...sortProps,
            render: (pool) => dayjs(pool.date_constitution).format('DD/MM/YYYY'),
          },
          {
            dataKey: 'id',
            title: 'Éch.',
            small: true,
            render: (pool) => pool.TrichineEchantillons.length,
          },
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'updated_at',
            title: 'FTP',
            render: (pool) => {
              const numeros = ftpNumerosListe(pool);
              if (!numeros.length) return '—';
              return numeros.map((numero, index) => (
                <span key={numero}>
                  {index > 0 && ', '}
                  <LienTrichine to={`${basePath}/ftp/${numero}`}>{numero}</LienTrichine>
                </span>
              ));
            },
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
                  {resultatCourtLabels[pool.resultat_analyse]}
                </Badge>
              ) : (
                '—'
              ),
          },
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'cree_par_user_id',
            title: 'Suivi',
            render: (pool) => (
              <Badge
                small
                severity={statutUtilisateurBadgeSeverity(statutUtilisateurPool(pool))}
              >
                {statutUtilisateurPool(pool)}
              </Badge>
            ),
          },
        ]}
      />
    </TrichineListPage>
  );
}
