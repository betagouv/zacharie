import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import TableFilterable from '@app/components/TableFilterable';
import TrichineListPage, {
  FiltrePeriode,
  FiltreSelect,
  TrichineListToolbar,
} from '@app/components/trichine/TrichineListPage';
import { useListParam } from '@app/utils/trichine-list-params';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import { getTrichineFTPs, type TrichineFTPPopulated } from '@app/services/trichine';
import {
  filterByStatutUtilisateur,
  filterParPeriode,
  filterTrichineRows,
  ftpResultatsResume,
  isResultatDefavorable,
  optionsDepuisColonne,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  resultatCourtLabels,
  sortTrichineRows,
  statutLogistiqueLabels,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurFTP,
  statutUtilisateurVues,
  type TrichineSortOrder,
} from '@app/utils/trichine';

const RESULTATS = [
  { value: '', label: 'Tous' },
  { value: 'AUCUN', label: 'Sans résultat' },
  { value: 'DEFAVORABLE', label: 'Défavorables uniquement' },
  ...Object.values(TrichineResultatAnalyse).map((resultat) => ({
    value: resultat,
    label: resultatAnalyseLabels[resultat],
  })),
];

function laboNom(ftp: TrichineFTPPopulated): string {
  return ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale || '—';
}

function resultatsDesPools(ftp: TrichineFTPPopulated): Array<TrichineResultatAnalyse> {
  return ftp.TrichinePoolFTPs.map((link) => link.TrichinePool.resultat_analyse).filter(
    (resultat): resultat is TrichineResultatAnalyse => !!resultat
  );
}

function ResumeResultats({ ftp }: { ftp: TrichineFTPPopulated }) {
  const resume = ftpResultatsResume(ftp);
  if (!resume.length) return <>—</>;
  return (
    <span className="flex flex-wrap gap-1">
      {resume.map(({ resultat, count }) => (
        <Badge
          key={resultat}
          small
          severity={resultatBadgeSeverity(resultat)}
        >
          {count} {resultatCourtLabels[resultat].toLowerCase()}
        </Badge>
      ))}
    </span>
  );
}

export default function TrichineFTPs() {
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [ftps, setFtps] = useState<Array<TrichineFTPPopulated>>([]);
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [labo, setLabo] = useListParam('labo', '');
  const [resultat, setResultat] = useListParam('resultat', '');
  const [nbPools, setNbPools] = useListParam('pools', '');
  const [du, setDu] = useListParam('du', '');
  const [au, setAu] = useListParam('au', '');
  const [sortBy, setSortBy] = useState<keyof TrichineFTPPopulated>('date_creation');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getTrichineFTPs()
      .then((response) => response.ok && response.data && setFtps(response.data.ftps))
      .catch(console.error);
  }, []);

  const stats = useMemo(
    () => ({
      total: ftps.length,
      brouillons: ftps.filter((ftp) => ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON)
        .length,
      enCours: ftps.filter((ftp) => statutUtilisateurFTP(ftp) === 'En cours').length,
    }),
    [ftps]
  );

  const laboOptions = useMemo(
    () => [{ value: '', label: 'Tous' }, ...optionsDepuisColonne(ftps.map(laboNom))],
    [ftps]
  );

  const nbPoolsOptions = useMemo(
    () => [
      { value: '', label: 'Tous' },
      ...optionsDepuisColonne(ftps.map((ftp) => String(ftp.TrichinePoolFTPs.length))),
    ],
    [ftps]
  );

  const rows = useMemo(() => {
    let filtered = filterByStatutUtilisateur(ftps, vue, statutUtilisateurFTP);
    if (labo) filtered = filtered.filter((ftp) => laboNom(ftp) === labo);
    if (resultat === 'AUCUN') {
      filtered = filtered.filter((ftp) => !resultatsDesPools(ftp).length);
    } else if (resultat === 'DEFAVORABLE') {
      filtered = filtered.filter((ftp) => resultatsDesPools(ftp).some(isResultatDefavorable));
    } else if (resultat) {
      filtered = filtered.filter((ftp) =>
        resultatsDesPools(ftp).includes(resultat as TrichineResultatAnalyse)
      );
    }
    if (nbPools) filtered = filtered.filter((ftp) => String(ftp.TrichinePoolFTPs.length) === nbPools);
    filtered = filterParPeriode(filtered, du, au, (ftp) => ftp.date_envoi);
    filtered = filterTrichineRows(
      filtered,
      query,
      (ftp) =>
        `${ftp.numero_fiche} ${ftp.DestinataireEntity.nom_d_usage ?? ''} ${ftp.DestinataireEntity.raison_sociale ?? ''}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [ftps, query, vue, labo, resultat, nbPools, du, au, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <TrichineListPage
      titre="Transmissions"
      stats={[
        { value: stats.total, label: 'Transmissions' },
        { value: stats.brouillons, label: 'Brouillons à envoyer' },
        { value: stats.enCours, label: 'En cours au laboratoire' },
      ]}
      actions={<Button linkProps={{ to: `${basePath}/nouvelle-ftp` }}>Créer une transmission</Button>}
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="N° de fiche, laboratoire"
        >
          <FiltreSelect
            label="Suivi"
            value={vue}
            onChange={setVue}
            options={statutUtilisateurVues}
          />
          <FiltreSelect
            label="Laboratoire"
            value={labo}
            onChange={setLabo}
            options={laboOptions}
          />
          <FiltreSelect
            label="Résultats"
            value={resultat}
            onChange={setResultat}
            options={RESULTATS}
          />
          <FiltreSelect
            label="Pools"
            value={nbPools}
            onChange={setNbPools}
            options={nbPoolsOptions}
          />
          <FiltrePeriode
            label="Envoyée le"
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
        onRowClick={(ftp) => navigate(`${basePath}/ftp/${ftp.numero_fiche}`)}
        noData={ftps.length ? 'Aucune transmission ne correspond aux filtres' : 'Aucune transmission créée'}
        renderCellSmallDevices={(ftp) => (
          <tr
            key={ftp.id}
            className="border-b border-gray-200"
            onClick={() => navigate(`${basePath}/ftp/${ftp.numero_fiche}`)}
          >
            <td className="p-3">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{ftp.numero_fiche}</span>
                <div className="flex flex-wrap gap-1">
                  <Badge
                    small
                    severity={statutUtilisateurBadgeSeverity(statutUtilisateurFTP(ftp))}
                  >
                    {statutUtilisateurFTP(ftp)}
                  </Badge>
                  <Badge
                    small
                    severity="info"
                  >
                    {statutLogistiqueLabels[ftp.statut_logistique]}
                  </Badge>
                </div>
                <p className="fr-text--sm fr-mb-0 text-gray-600">
                  {laboNom(ftp)}
                  <br />
                  {ftp.TrichinePoolFTPs.length} pool{ftp.TrichinePoolFTPs.length > 1 ? 's' : ''}
                  {ftp.date_envoi ? ` — envoyée le ${dayjs(ftp.date_envoi).format('DD/MM/YYYY')}` : ''}
                </p>
              </div>
            </td>
          </tr>
        )}
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
            render: (ftp) => laboNom(ftp),
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
          // dataKey arbitraire (clé de colonne unique) : la cellule est rendue via render()
          {
            dataKey: 'statut_analytique',
            title: 'Résultats',
            render: (ftp) => <ResumeResultats ftp={ftp} />,
          },
          {
            dataKey: 'statut_logistique',
            title: 'Suivi',
            render: (ftp) => (
              <Badge
                small
                severity={statutUtilisateurBadgeSeverity(statutUtilisateurFTP(ftp))}
              >
                {statutUtilisateurFTP(ftp)}
              </Badge>
            ),
          },
        ]}
      />
    </TrichineListPage>
  );
}
