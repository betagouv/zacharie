import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP, type TrichineHistoriqueStatut } from '@prisma/client';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import Chargement from '@app/components/Chargement';
import PoolCard, {
  refusModal,
  RefusModalContent,
  resultatModal,
  ResultatModalContent,
  type ResultatMode,
} from '@app/components/laboratoire/PoolCard';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineDetailPage, {
  TrichineCard,
  TrichineContact,
  TrichineFields,
  TrichineSeparateur,
} from '@app/components/trichine/TrichineDetailPage';
import {
  getLaboFTP,
  getLaboMe,
  receptionnerFTP,
  type LaboFTPDetail,
  type LaboFTPDirection,
  type LaboPool,
} from '@app/services/laboratoire';
import {
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutLogistiqueLaboLabels,
} from '@app/utils/trichine';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';

export default function LaboratoireFTP() {
  const { reference } = useParams();
  const { isDownloading, onDownloadFtpPdf } = useDownloadFtpPdf('laboratoire');
  const [ftp, setFtp] = useState<LaboFTPDetail | null>(null);
  // Une fiche que le labo a émise (confirmation vers le LNR) se consulte, elle ne se traite pas
  const [direction, setDirection] = useState<LaboFTPDirection>('recue');
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [isLnr, setIsLnr] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dateReception, setDateReception] = useState(dayjs().format('YYYY-MM-DD'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refusPool, setRefusPool] = useState<LaboPool | null>(null);
  const [resultatPool, setResultatPool] = useState<LaboPool | null>(null);
  const [resultatMode, setResultatMode] = useState<ResultatMode>('saisie');

  const refresh = useCallback(() => {
    if (!reference) return;
    getLaboFTP(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setFtp(response.data.ftp);
          setHistorique(response.data.historique);
          setDirection(response.data.direction);
        } else {
          setFtp(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [reference]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
    getLaboMe()
      .then((response) => {
        if (response.ok && response.data) setIsLnr(response.data.isLnr);
      })
      .catch(console.error);
  }, [refresh]);

  if (isLoading) return <Chargement />;
  if (!ftp) {
    return (
      <TrichineIntrouvable
        objet="Transmission"
        reference={reference}
        retour={{ to: '/app/laboratoire/ftp', label: 'Voir toutes les transmissions' }}
        basePath="/app/laboratoire"
      />
    );
  }

  const envoyee = direction === 'envoyee';
  const aReceptionner = !envoyee && ftp.statut_logistique === TrichineStatutLogistiqueFTP.ENVOYEE;
  const pools = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool);
  const echantillons = pools.flatMap((pool) => pool.TrichineEchantillons);
  const poolsSansResultat = pools.filter((pool) => !pool.resultat_analyse).length;
  const expediteur = `${ftp.ExpediteurUser.prenom ?? ''} ${ftp.ExpediteurUser.nom_de_famille ?? ''}`.trim();
  const expediteurEntity = ftp.ExpediteurEntity
    ? ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale
    : null;

  const etapes: Array<ChaineEtape> = [
    { label: 'Émetteur', value: expediteurEntity || expediteur || '—' },
    { label: 'FTP', value: ftp.numero_fiche, current: true },
    {
      label: pools.length > 1 ? 'Pools' : 'Pool',
      value: pools.length === 1 ? pools[0].reference_pool : `${pools.length} pools`,
    },
    { label: 'Échantillons', value: `${echantillons.length}` },
  ];

  return (
    <TrichineDetailPage
      surtitre={
        envoyee
          ? 'Fiche de confirmation envoyée au laboratoire national de référence'
          : 'Fiche de transmission des prélèvements'
      }
      titre={ftp.numero_fiche}
      retour={{ to: '/app/laboratoire/ftp', label: 'Toutes les transmissions' }}
      badges={
        <>
          <Badge severity="info">
            {(envoyee ? statutLogistiqueLabels : statutLogistiqueLaboLabels)[ftp.statut_logistique]}
          </Badge>
          <Badge severity={statutAnalyseBadgeSeverity(ftp.statut_analytique)}>
            {statutAnalyseLabels[ftp.statut_analytique]}
          </Badge>
          {!envoyee && !aReceptionner && poolsSansResultat > 0 && (
            <Badge severity="new">
              {poolsSansResultat} résultat{poolsSansResultat > 1 ? 's' : ''} à saisir
            </Badge>
          )}
        </>
      }
      actions={
        <Button
          type="button"
          priority="secondary"
          iconId="fr-icon-download-line"
          disabled={isDownloading}
          onClick={() => onDownloadFtpPdf(ftp.id, ftp.numero_fiche)}
        >
          Télécharger la fiche
        </Button>
      }
      chaine={<TrichineChaine etapes={etapes} />}
      aside={
        <>
          <TrichineCard titre={envoyee ? 'Destinataire' : 'Émetteur'}>
            {envoyee ? (
              <TrichineContact
                nom={ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale}
                organisation={ftp.DestinataireEntity.is_lnr ? 'Laboratoire national de référence' : null}
              />
            ) : (
              <TrichineContact
                nom={expediteur}
                organisation={expediteurEntity}
                email={ftp.ExpediteurUser.email}
                telephone={ftp.ExpediteurUser.telephone}
              />
            )}
            <TrichineSeparateur />
            <TrichineFields
              disposition="lignes"
              fields={[
                {
                  label: 'Envoyée le',
                  value: ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : '—',
                },
                !!ftp.mode_transport && { label: 'Transport', value: ftp.mode_transport },
                !!ftp.FTPParent && {
                  label: 'FTP d’origine',
                  value: (
                    <Link
                      to={`/app/laboratoire/ftp/${ftp.FTPParent.numero_fiche}`}
                      className="fr-link"
                    >
                      {ftp.FTPParent.numero_fiche}
                    </Link>
                  ),
                },
              ]}
            />
            {!!ftp.commentaire && <p className="fr-text--sm fr-mt-2w fr-mb-0">{ftp.commentaire}</p>}
          </TrichineCard>
          <TrichineChronologie historique={historique} />
        </>
      }
    >
      {envoyee && (
        <Alert
          severity="info"
          small
          description={`Cette fiche a été générée automatiquement après votre résultat douteux. Elle est destinée à ${ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale}, qui saisira le résultat de confirmation.`}
        />
      )}

      {aReceptionner && (
        <TrichineCard
          titre="Réception du colis"
          hint="Confirmez la réception pour ouvrir la saisie des résultats."
        >
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Date de réception"
              className="fr-mb-0 max-w-xs"
              nativeInputProps={{
                type: 'date',
                value: dateReception,
                onChange: (event) => setDateReception(event.target.value),
              }}
            />
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                receptionnerFTP(ftp.id, dateReception)
                  .then((response) => {
                    if (response.ok) {
                      toast.success('Réception confirmée, vous pouvez saisir les résultats');
                      refresh();
                    } else {
                      toast.error(response.error || 'Une erreur est survenue');
                    }
                  })
                  .catch(() => toast.error('Une erreur est survenue'))
                  .finally(() => setIsSubmitting(false));
              }}
            >
              Confirmer la réception
            </Button>
          </div>
        </TrichineCard>
      )}

      {pools.map((pool) => (
        <PoolCard
          key={pool.id}
          pool={pool}
          isLnr={isLnr}
          saisieActive={
            !envoyee && !aReceptionner && ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON
          }
          onRefuser={() => {
            setRefusPool(pool);
            refusModal.open();
          }}
          onSaisirResultat={() => {
            setResultatPool(pool);
            setResultatMode('saisie');
            resultatModal.open();
          }}
          onCorrigerResultat={() => {
            setResultatPool(pool);
            setResultatMode('correction');
            resultatModal.open();
          }}
          onDocumentDepose={refresh}
        />
      ))}

      {ftp.FTPChildren.length > 0 && (
        <TrichineCard
          titre="Transmissions de confirmation"
          hint="Fiches générées vers le laboratoire national de référence"
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {ftp.FTPChildren.map((enfant) => (
              <li
                key={enfant.numero_fiche}
                className="flex flex-wrap items-center gap-2"
              >
                <Link
                  to={`/app/laboratoire/ftp/${enfant.numero_fiche}`}
                  className="fr-link"
                >
                  {enfant.numero_fiche}
                </Link>
                <Badge
                  small
                  severity="info"
                >
                  {statutLogistiqueLabels[enfant.statut_logistique]}
                </Badge>
              </li>
            ))}
          </ul>
        </TrichineCard>
      )}

      <ResultatModalContent
        pool={resultatPool}
        isLnr={isLnr}
        mode={resultatMode}
        onDone={refresh}
      />

      <RefusModalContent
        pool={refusPool}
        onDone={refresh}
      />
    </TrichineDetailPage>
  );
}
