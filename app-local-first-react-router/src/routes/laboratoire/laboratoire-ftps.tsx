import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import dayjs from 'dayjs';
import TableFilterable from '@app/components/TableFilterable';
import { getLaboFTPs, type LaboFTPListItem } from '@app/services/laboratoire';
import {
  filterTrichineRows,
  filtreLaboFTP,
  sortTrichineRows,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
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

export default function LaboratoireFTPs() {
  const navigate = useNavigate();
  const [ftps, setFtps] = useState<Array<LaboFTPListItem>>([]);
  const [selectedTabId, setSelectedTabId] = useState<LaboFiltreTab>('a-traiter');
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [query, setQuery] = useState('');
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

  const parFiltre = useMemo(() => {
    const groups: Record<LaboFiltreTab, Array<LaboFTPListItem>> = {
      'a-traiter': [],
      'en-cours': [],
      cloturees: [],
    };
    for (const ftp of ftps) groups[filtreLaboFTP(ftp)].push(ftp);
    return groups;
  }, [ftps]);

  const tabs: TabsProps['tabs'] = [
    { tabId: 'a-traiter', label: `À traiter (${parFiltre['a-traiter'].length})` },
    { tabId: 'en-cours', label: `En cours (${parFiltre['en-cours'].length})` },
    { tabId: 'cloturees', label: `Clôturées (${parFiltre.cloturees.length})` },
  ];

  const rows = useMemo(() => {
    const filtered = filterTrichineRows(
      parFiltre[selectedTabId],
      query,
      (ftp) => `${ftp.numero_fiche} ${expediteurDisplay(ftp)}`
    );
    return sortTrichineRows(filtered, sortBy, sortOrder);
  }, [parFiltre, selectedTabId, query, sortBy, sortOrder]);

  const sortProps = { onSortBy: setSortBy, onSortOrder: setSortOrder, sortBy, sortOrder };

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>FTP reçues | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Fiches de transmission des prélèvements</h1>
          <Tabs
            selectedTabId={selectedTabId}
            tabs={tabs}
            onTabChange={(tabId) => setSelectedTabId(tabId as LaboFiltreTab)}
            className="mb-6"
          >
            {!hasTriedLoading ? (
              <p className="fr-text--sm">Chargement…</p>
            ) : (
              <>
                <Input
                  label="Rechercher"
                  hintText="N° de FTP, émetteur"
                  className="mb-4 max-w-md"
                  nativeInputProps={{
                    type: 'search',
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                  }}
                />
                <TableFilterable
                  data={rows}
                  rowKey="id"
                  noData={
                    parFiltre[selectedTabId].length
                      ? 'Aucune FTP ne correspond à la recherche'
                      : 'Aucune FTP dans cette catégorie'
                  }
                  columns={[
                    {
                      dataKey: 'numero_fiche',
                      title: 'Numéro',
                      ...sortProps,
                      render: (ftp) => <span className="font-semibold">{ftp.numero_fiche}</span>,
                    },
                    {
                      dataKey: 'expediteur_user_id',
                      title: 'Émetteur',
                      render: (ftp) => expediteurDisplay(ftp),
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
                    {
                      dataKey: 'destinataire_entity_id',
                      title: 'Action',
                      render: (ftp) => (
                        <Button
                          type="button"
                          size="small"
                          priority={selectedTabId === 'cloturees' ? 'tertiary' : 'primary'}
                          onClick={() => navigate(`/app/laboratoire/ftp/${ftp.id}`)}
                        >
                          {selectedTabId === 'cloturees' ? 'Consulter' : 'Traiter'}
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
