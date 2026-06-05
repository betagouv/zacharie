import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP } from '@prisma/client';
import { getLaboFTPs, type LaboFTPListItem } from '@app/services/laboratoire';
import { statutAnalyseBadgeSeverity, statutAnalyseLabels, statutLogistiqueLabels } from '@app/utils/trichine';

type FiltreTab = 'a-traiter' | 'en-cours' | 'cloturees';

// Filtres §6.3 : à traiter (rien saisi) / en cours (saisie partielle) / clôturées (TRAITEE)
function filtreFTP(ftp: LaboFTPListItem): FiltreTab {
  if (ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE) return 'cloturees';
  const hasResult = ftp.TrichinePoolFTPs.some((link) => link.TrichinePool.resultat_analyse !== null);
  return hasResult ? 'en-cours' : 'a-traiter';
}

export default function LaboratoireFTPs() {
  const navigate = useNavigate();
  const [ftps, setFtps] = useState<Array<LaboFTPListItem>>([]);
  const [selectedTabId, setSelectedTabId] = useState<FiltreTab>('a-traiter');
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

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
    const groups: Record<FiltreTab, Array<LaboFTPListItem>> = {
      'a-traiter': [],
      'en-cours': [],
      cloturees: [],
    };
    for (const ftp of ftps) groups[filtreFTP(ftp)].push(ftp);
    return groups;
  }, [ftps]);

  const tabs: TabsProps['tabs'] = [
    { tabId: 'a-traiter', label: `À traiter (${parFiltre['a-traiter'].length})` },
    { tabId: 'en-cours', label: `En cours (${parFiltre['en-cours'].length})` },
    { tabId: 'cloturees', label: `Clôturées (${parFiltre.cloturees.length})` },
  ];

  const visibles = parFiltre[selectedTabId];

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>FTP reçues | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Fiches de transmission des prélèvements</h1>
          <Tabs
            selectedTabId={selectedTabId}
            tabs={tabs}
            onTabChange={(tabId) => setSelectedTabId(tabId as FiltreTab)}
            className="mb-6"
          >
            {!hasTriedLoading ? (
              <p className="fr-text--sm">Chargement…</p>
            ) : visibles.length === 0 ? (
              <p className="fr-text--sm">Aucune FTP dans cette catégorie.</p>
            ) : (
              <ul className="list-none space-y-3 p-0">
                {visibles.map((ftp) => (
                  <li
                    key={ftp.id}
                    className="rounded border border-gray-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{ftp.numero_fiche}</span>
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
                    <p className="fr-text--sm fr-mb-0 mt-1">
                      Émetteur : {ftp.ExpediteurUser.prenom} {ftp.ExpediteurUser.nom_de_famille}
                      {ftp.ExpediteurEntity
                        ? ` (${ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale})`
                        : ''}{' '}
                      — {ftp.TrichinePoolFTPs.length} pool(s)
                      {ftp.date_envoi ? ` — envoyée le ${dayjs(ftp.date_envoi).format('DD/MM/YYYY')}` : ''}
                    </p>
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="small"
                        onClick={() => navigate(`/app/laboratoire/ftp/${ftp.id}`)}
                      >
                        {selectedTabId === 'cloturees' ? 'Consulter' : 'Traiter'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
