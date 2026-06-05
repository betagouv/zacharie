import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP } from '@prisma/client';
import {
  envoyerTrichineFTP,
  getTrichineFTP,
  type TrichineFTPDetail as TrichineFTPDetailType,
} from '@app/services/trichine';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
} from '@app/utils/trichine';

/**
 * Détail d'une FTP : composition, statuts, envoi au laboratoire.
 * Le téléchargement du PDF arrive avec la P4 (génération PDF FTP).
 */
export default function TrichineFTPDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const basePath = useTrichineBasePath();
  const [ftp, setFtp] = useState<TrichineFTPDetailType | null>(null);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(() => {
    getTrichineFTP(params.ftp_id!)
      .then((response) => {
        if (response.ok && response.data) setFtp(response.data.ftp);
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, [params.ftp_id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
  }, [refresh]);

  if (!ftp) {
    return (
      <div className="fr-container fr-my-md-14v p-4">
        <p>{hasTriedLoading ? 'FTP introuvable' : 'Chargement…'}</p>
      </div>
    );
  }

  const isBrouillon = ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON;

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`FTP ${ftp.numero_fiche} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">FTP {ftp.numero_fiche}</h1>
          <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
            <div className="fr-mb-2w flex flex-wrap items-center gap-2">
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
            <ul className="fr-text--sm space-y-1">
              <li>
                Laboratoire destinataire :{' '}
                {ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale}
              </li>
              <li>Créée le {dayjs(ftp.date_creation).format('DD/MM/YYYY')}</li>
              {ftp.date_envoi && <li>Envoyée le {dayjs(ftp.date_envoi).format('DD/MM/YYYY')}</li>}
              {ftp.mode_transport && <li>Mode de transport : {ftp.mode_transport}</li>}
            </ul>

            {isBrouillon && (
              <>
                <Alert
                  severity="info"
                  small
                  className="fr-my-2w"
                  description="Cette FTP est en brouillon : envoyez-la au laboratoire pour démarrer les analyses."
                />
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    envoyerTrichineFTP(ftp.id)
                      .then((response) => {
                        if (response.ok) {
                          toast.success(`FTP ${ftp.numero_fiche} envoyée au laboratoire`);
                          refresh();
                        } else {
                          toast.error(response.error || 'Une erreur est survenue');
                        }
                      })
                      .catch(() => toast.error('Une erreur est survenue'))
                      .finally(() => setIsSubmitting(false));
                  }}
                >
                  Envoyer au laboratoire
                </Button>
              </>
            )}
          </div>

          <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
            <h2 className="fr-h5 fr-mb-2w">Pools transmis</h2>
            <ul className="list-none space-y-3 p-0">
              {ftp.TrichinePoolFTPs.map(({ TrichinePool: pool }) => (
                <li
                  key={pool.id}
                  className="rounded border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{pool.reference_pool}</span>
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
                  <p className="fr-text--sm fr-mb-0 mt-1">
                    {pool.TrichineEchantillons.map((echantillon) => echantillon.reference_echantillon).join(
                      ', '
                    )}
                  </p>
                  {pool.raison_refus && (
                    <p className="fr-text--sm fr-mb-0 mt-1">Refus du laboratoire : {pool.raison_refus}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Button
            priority="secondary"
            type="button"
            onClick={() => navigate(`${basePath}?tab=ftps`)}
          >
            Retour à mes FTP
          </Button>
        </div>
      </div>
    </div>
  );
}
