import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { TrichineStatutLogistiqueFTP } from '@prisma/client';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import TableFilterable from '@app/components/TableFilterable';
import TrichineListPage, {
  FiltreSelect,
  TrichineListToolbar,
} from '@app/components/trichine/TrichineListPage';
import { useListParam } from '@app/utils/trichine-list-params';
import { getLaboFTPs, type LaboFTPListItem } from '@app/services/laboratoire';
import {
  filterTrichineRows,
  filtreLaboFTP,
  ftpResultatsResume,
  ftpTrichineNiveau,
  resultatBadgeSeverity,
  resultatCourtLabels,
  sortTrichineRows,
  type LaboFiltreTab,
  type TrichineSortOrder,
} from '@app/utils/trichine';

function expediteurDisplay(ftp: LaboFTPListItem): string {
  const user = `${ftp.ExpediteurUser.prenom ?? ''} ${ftp.ExpediteurUser.nom_de_famille ?? ''}`.trim();
  const entity = ftp.ExpediteurEntity
    ? (ftp.ExpediteurEntity.nom_d_usage ?? ftp.ExpediteurEntity.raison_sociale ?? '')
    : '';
  return entity ? `${user} (${entity})` : user;
}

function destinataireDisplay(ftp: LaboFTPListItem): string {
  const nom = ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale || '—';
  return ftp.DestinataireEntity.is_lnr ? `${nom} (LNR)` : nom;
}

/**
 * Émetteur et destinataire sont affichés tels quels : le sens de la fiche se lit dans les
 * données, sans étiquette supplémentaire. Le côté qui est le laboratoire connecté est marqué.
 */
function Correspondant({ nom, estVous }: { nom: string; estVous: boolean }) {
  return (
    <span className="flex flex-wrap items-baseline gap-1">
      <span className={estVous ? 'font-medium' : ''}>{nom}</span>
      {estVous && <span className="fr-text--xs m-0 text-gray-500">(vous)</span>}
    </span>
  );
}

function isClosed(ftp: LaboFTPListItem): boolean {
  return ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE;
}

// Point coloré devant le n° de fiche : rouge (positif) / orange (douteux) / rien
function NumeroCell({ ftp }: { ftp: LaboFTPListItem }) {
  const niveau = ftpTrichineNiveau(ftp);
  return (
    <span className="flex items-center gap-2">
      {niveau && (
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${niveau === 'positif' ? 'bg-red-500' : 'bg-orange-500'}`}
          aria-hidden
        />
      )}
      <span className="font-semibold">{ftp.numero_fiche}</span>
    </span>
  );
}

// Résumé coloré des résultats des pools (met en avant la trichine)
function ResultatsCell({ ftp }: { ftp: LaboFTPListItem }) {
  const resume = ftpResultatsResume(ftp);
  if (!resume.length) return <span className="fr-text--sm m-0 text-gray-500">En attente</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {resume.map(({ resultat, count }) => (
        <Badge
          key={resultat}
          small
          severity={resultatBadgeSeverity(resultat)}
        >
          {count > 1 ? `${count}× ` : ''}
          {resultatCourtLabels[resultat]}
        </Badge>
      ))}
    </div>
  );
}

const VUES = [
  { value: 'tous', label: 'Toutes' },
  { value: 'a-traiter', label: 'À réceptionner' },
  { value: 'en-cours', label: 'En cours' },
  { value: 'cloturees', label: 'Clôturées' },
  { value: 'trichine', label: 'Trichine confirmée ou suspectée' },
  { value: 'trichine-en-attente', label: 'Trichine en attente du SVI' },
  { value: 'envoyees', label: 'Envoyées au LNR' },
];

export default function LaboratoireFTPs() {
  const navigate = useNavigate();
  const [ftps, setFtps] = useState<Array<LaboFTPListItem>>([]);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [query, setQuery] = useListParam('q', '');
  const [vue, setVue] = useListParam('vue', 'tous');
  const [sortBy, setSortBy] = useState<keyof LaboFTPListItem>('date_envoi');
  const [sortOrder, setSortOrder] = useState<TrichineSortOrder>('DESC');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    getLaboFTPs()
      .then((response) => {
        if (response.ok && response.data) setFtps(response.data.ftps);
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, []);

  const compteurs = useMemo(() => {
    const parFiltre: Record<LaboFiltreTab, number> = { 'a-traiter': 0, 'en-cours': 0, cloturees: 0 };
    for (const ftp of ftps) if (ftp.direction === 'recue') parFiltre[filtreLaboFTP(ftp)]++;
    return {
      ...parFiltre,
      envoyees: ftps.filter((ftp) => ftp.direction === 'envoyee').length,
      trichine: ftps.filter((ftp) => ftpTrichineNiveau(ftp) !== null).length,
    };
  }, [ftps]);

  const base = useMemo(() => {
    if (vue === 'tous') return ftps;
    if (vue === 'envoyees') return ftps.filter((ftp) => ftp.direction === 'envoyee');
    if (vue === 'trichine') return ftps.filter((ftp) => ftpTrichineNiveau(ftp) !== null);
    // Fiches trichine dont au moins une carcasse attend encore la décision du SVI (IPM2)
    if (vue === 'trichine-en-attente') {
      return ftps.filter((ftp) => ftpTrichineNiveau(ftp) !== null && ftp.carcasses_sans_ipm2 > 0);
    }
    // Les autres vues suivent la réception : elles ne concernent que les fiches reçues
    const recues = ftps.filter((ftp) => ftp.direction === 'recue');
    return recues.filter((ftp) => filtreLaboFTP(ftp) === vue);
  }, [ftps, vue]);

  const rows = useMemo(() => {
    const filtered = filterTrichineRows(
      base,
      query,
      (ftp) => `${ftp.numero_fiche} ${expediteurDisplay(ftp)}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [base, query, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };
  const ouvrir = (ftp: LaboFTPListItem) => navigate(`/app/laboratoire/ftp/${ftp.numero_fiche}`);

  const actionButton = (ftp: LaboFTPListItem) => (
    <Button
      type="button"
      size="small"
      priority={isClosed(ftp) || ftp.direction === 'envoyee' ? 'tertiary' : 'primary'}
      onClick={() => ouvrir(ftp)}
    >
      {isClosed(ftp) || ftp.direction === 'envoyee' ? 'Consulter' : 'Traiter'}
    </Button>
  );

  const renderMobileCard = (ftp: LaboFTPListItem) => {
    const niveau = ftpTrichineNiveau(ftp);
    return (
      <tr key={ftp.id}>
        <td className="block border-none p-0">
          <div
            className={`mb-3 rounded-lg border p-3 ${niveau === 'positif' ? 'border-red-300 bg-red-50' : niveau === 'douteux' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <NumeroCell ftp={ftp} />
              {actionButton(ftp)}
            </div>
            <div className="fr-text--sm m-0 mt-1 text-gray-700">
              De {expediteurDisplay(ftp)}
              {ftp.direction === 'envoyee' ? ' (vous)' : ''} → vers {destinataireDisplay(ftp)}
              {ftp.direction === 'recue' ? ' (vous)' : ''}
            </div>
            <div className="fr-text--xs m-0 mt-1 text-gray-500">
              {ftp.TrichinePoolFTPs.length} pool(s)
              {ftp.date_envoi ? ` · Envoyée le ${dayjs(ftp.date_envoi).format('DD/MM/YYYY')}` : ''}
            </div>
            <div className="mt-2">
              <ResultatsCell ftp={ftp} />
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <TrichineListPage
      titre="Transmissions reçues"
      description="Fiches de transmission des prélèvements envoyées par les détenteurs. Réceptionnez la fiche à l'arrivée du colis, puis saisissez un résultat par pool."
      stats={[
        { value: compteurs['a-traiter'], label: 'À réceptionner' },
        { value: compteurs['en-cours'], label: 'En cours' },
        { value: compteurs.cloturees, label: 'Clôturées' },
        { value: compteurs.envoyees, label: 'Envoyées au LNR' },
      ]}
      toolbar={
        <TrichineListToolbar
          query={query}
          onQueryChange={setQuery}
          searchHint="N° de fiche, émetteur"
        >
          <FiltreSelect
            label="Affichage"
            value={vue}
            onChange={setVue}
            options={VUES}
          />
        </TrichineListToolbar>
      }
    >
      {!hasTriedLoading ? (
        <p className="fr-text--sm">Chargement…</p>
      ) : (
        <TableFilterable
          data={rows}
          rowKey="id"
          onRowClick={ouvrir}
          renderCellSmallDevices={renderMobileCard}
          noData={
            base.length ? 'Aucune fiche ne correspond à la recherche' : 'Aucune fiche dans cette catégorie'
          }
          columns={[
            {
              dataKey: 'numero_fiche',
              title: 'Numéro',
              ...sortProps,
              render: (ftp) => <NumeroCell ftp={ftp} />,
            },
            {
              dataKey: 'expediteur_user_id',
              title: 'Émetteur',
              render: (ftp) => (
                <Correspondant
                  nom={expediteurDisplay(ftp)}
                  estVous={ftp.direction === 'envoyee'}
                />
              ),
            },
            {
              dataKey: 'destinataire_entity_id',
              title: 'Destinataire',
              render: (ftp) => (
                <Correspondant
                  nom={destinataireDisplay(ftp)}
                  estVous={ftp.direction === 'recue'}
                />
              ),
            },
            {
              dataKey: 'id',
              title: 'Pools',
              small: true,
              render: (ftp) => ftp.TrichinePoolFTPs.length,
            },
            {
              dataKey: 'date_creation',
              title: 'Résultats',
              render: (ftp) => <ResultatsCell ftp={ftp} />,
            },
            {
              dataKey: 'date_envoi',
              title: 'Envoyée le',
              ...sortProps,
              render: (ftp) => (ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : '—'),
            },
            {
              dataKey: 'destinataire_entity_id',
              title: 'Action',
              render: (ftp) => actionButton(ftp),
            },
          ]}
        />
      )}
    </TrichineListPage>
  );
}
