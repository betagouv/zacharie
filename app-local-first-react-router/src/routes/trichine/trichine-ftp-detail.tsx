import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineStatutLogistiqueFTP, type TrichineHistoriqueStatut } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineDetailPage, {
  TrichineCard,
  TrichineFields,
} from '@app/components/trichine/TrichineDetailPage';
import {
  annulerTrichineFTP,
  envoyerTrichineFTP,
  getTrichineFTP,
  getTrichineLaboratoires,
  modifierTrichineFTP,
  supprimerTrichineFTP,
  type TrichineFTPDetail as TrichineFTPDetailType,
  type TrichineLaboratoire,
} from '@app/services/trichine';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';
import {
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurFTP,
} from '@app/utils/trichine';

const modifierModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-modifier' });
const supprimerModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-supprimer' });
const annulerModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-annuler' });

/** Détail d'une fiche de transmission des prélèvements : composition, envoi, suivi. */
export default function TrichineFTPDetail() {
  const { reference } = useParams();
  const basePath = useTrichineBasePath();
  const { isDownloading, onDownloadFtpPdf } = useDownloadFtpPdf('trichine');
  const [ftp, setFtp] = useState<TrichineFTPDetailType | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    if (!reference) return;
    getTrichineFTP(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setFtp(response.data.ftp);
          setHistorique(response.data.historique);
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
  }, [refresh]);

  if (isLoading) return <Chargement />;
  if (!ftp) {
    return (
      <TrichineIntrouvable
        objet="Transmission"
        reference={reference}
        retour={{ to: `${basePath}/ftp`, label: 'Voir toutes les transmissions' }}
        basePath={basePath}
      />
    );
  }

  const isBrouillon = ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON;
  // Le colis est parti mais le laboratoire ne l'a pas réceptionné : l'annulation reste possible
  const isAnnulable = ftp.statut_logistique === TrichineStatutLogistiqueFTP.ENVOYEE;
  const isAnnulee = ftp.statut_logistique === TrichineStatutLogistiqueFTP.ANNULEE;
  const laboratoire = ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale;
  const pools = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool);
  const echantillons = pools.flatMap((pool) => pool.TrichineEchantillons);
  const carcasses = new Set(echantillons.map((echantillon) => echantillon.Carcasse.zacharie_carcasse_id));
  const statutUtilisateur = statutUtilisateurFTP(ftp);

  const etapes: Array<ChaineEtape> = [
    { label: carcasses.size > 1 ? 'Carcasses' : 'Carcasse', value: `${carcasses.size}` },
    {
      label: 'Échantillons',
      value: `${echantillons.length}`,
      to: `${basePath}/echantillons`,
    },
    {
      label: pools.length > 1 ? 'Pools' : 'Pool',
      value: pools.length === 1 ? pools[0].reference_pool : `${pools.length} pools`,
      to: pools.length === 1 ? `${basePath}/pools/${pools[0].reference_pool}` : `${basePath}/pools`,
    },
    { label: 'FTP', value: ftp.numero_fiche, current: true },
    { label: 'Laboratoire', value: laboratoire ?? '—' },
  ];

  return (
    <TrichineDetailPage
      surtitre={`Fiche de transmission des prélèvements${ftp.DestinataireEntity.is_lnr ? ' — confirmation LNR' : ''}`}
      titre={ftp.numero_fiche}
      retour={{ to: `${basePath}/ftp`, label: 'Toutes les transmissions' }}
      badges={
        <>
          <Badge severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}>{statutUtilisateur}</Badge>
          <Badge severity="info">{statutLogistiqueLabels[ftp.statut_logistique]}</Badge>
          <Badge severity={statutAnalyseBadgeSeverity(ftp.statut_analytique)}>
            {statutAnalyseLabels[ftp.statut_analytique]}
          </Badge>
        </>
      }
      actions={
        <>
          <Button
            type="button"
            priority="secondary"
            iconId="fr-icon-download-line"
            disabled={isDownloading}
            onClick={() => onDownloadFtpPdf(ftp.id, ftp.numero_fiche)}
          >
            Télécharger la fiche
          </Button>
          {isBrouillon && (
            <>
              <Button
                type="button"
                priority="secondary"
                onClick={() => modifierModal.open()}
              >
                Modifier
              </Button>
              <Button
                type="button"
                priority="secondary"
                onClick={() => supprimerModal.open()}
              >
                Supprimer
              </Button>
            </>
          )}
          {isAnnulable && (
            <Button
              type="button"
              priority="secondary"
              onClick={() => annulerModal.open()}
            >
              Annuler la fiche
            </Button>
          )}
          {isBrouillon && (
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
          )}
        </>
      }
      chaine={<TrichineChaine etapes={etapes} />}
      aside={
        <>
          <TrichineCard titre="Informations">
            <TrichineFields
              disposition="lignes"
              fields={[
                { label: 'Créée le', value: dayjs(ftp.date_creation).format('DD/MM/YYYY') },
                {
                  label: 'Envoyée le',
                  value: ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : 'Pas encore',
                },
                !!ftp.mode_transport && { label: 'Transport', value: ftp.mode_transport },
                !!ftp.FTPParent && {
                  label: 'FTP d’origine',
                  value: (
                    <Link
                      to={`${basePath}/ftp/${ftp.FTPParent.numero_fiche}`}
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
      {isBrouillon && (
        <Alert
          severity="info"
          small
          description="Cette fiche est en brouillon : envoyez-la au laboratoire pour démarrer les analyses. Imprimez-la et joignez-la au colis."
        />
      )}

      {isAnnulee && (
        <Alert
          severity="warning"
          small
          title="Fiche annulée"
          description={`${ftp.date_annulation ? `Annulée le ${dayjs(ftp.date_annulation).format('DD/MM/YYYY')}. ` : ''}${ftp.raison_annulation ?? ''} Le laboratoire a été prévenu. Les pools sont de nouveau disponibles pour une nouvelle fiche.`}
        />
      )}

      <TrichineCard titre="Laboratoire destinataire">
        <TrichineFields
          fields={[
            { label: 'Laboratoire', value: laboratoire },
            {
              label: 'Type',
              value: ftp.DestinataireEntity.is_lnr
                ? 'Laboratoire national de référence'
                : 'Laboratoire vétérinaire départemental agréé',
            },
            !!ftp.DestinataireEntity.address_ligne_1 && {
              label: 'Adresse',
              value: [
                ftp.DestinataireEntity.address_ligne_1,
                ftp.DestinataireEntity.code_postal,
                ftp.DestinataireEntity.ville,
              ]
                .filter(Boolean)
                .join(', '),
            },
          ]}
        />
      </TrichineCard>

      <TrichineCard
        titre="Pools transmis"
        hint={`${pools.length} pool${pools.length > 1 ? 's' : ''} — ${echantillons.length} échantillon${echantillons.length > 1 ? 's' : ''}`}
      >
        <ul className="m-0 list-none space-y-4 p-0">
          {pools.map((pool) => (
            <li
              key={pool.id}
              className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`${basePath}/pools/${pool.reference_pool}`}
                  className="fr-link font-semibold"
                >
                  {pool.reference_pool}
                </Link>
                <Badge
                  small
                  severity={statutAnalyseBadgeSeverity(pool.statut)}
                >
                  {statutAnalyseLabels[pool.statut]}
                </Badge>
                {!!pool.resultat_analyse && (
                  <Badge
                    small
                    severity={resultatBadgeSeverity(pool.resultat_analyse)}
                  >
                    {resultatAnalyseLabels[pool.resultat_analyse]}
                  </Badge>
                )}
              </div>
              <p className="fr-text--sm fr-mb-0 text-gray-600">
                {pool.TrichineEchantillons.length} échantillon
                {pool.TrichineEchantillons.length > 1 ? 's' : ''} —{' '}
                {pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse.numero_bracelet)
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {!!pool.raison_refus && <p className="fr-text--sm fr-mb-0">Refus : {pool.raison_refus}</p>}
            </li>
          ))}
        </ul>
      </TrichineCard>

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
                  to={`${basePath}/ftp/${enfant.numero_fiche}`}
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

      <ModifierModalContent
        ftp={ftp}
        onDone={refresh}
      />

      <supprimerModal.Component title={`Supprimer le brouillon ${ftp.numero_fiche}`}>
        <p className="fr-text--sm">
          La fiche disparaîtra de vos listes. Ses {pools.length} pool{pools.length > 1 ? 's' : ''} ne sont pas
          supprimés : ils redeviennent disponibles pour une autre fiche.
        </p>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            supprimerTrichineFTP(ftp.id)
              .then((response) => {
                if (response.ok) {
                  toast.success(`Brouillon ${ftp.numero_fiche} supprimé`);
                  supprimerModal.close();
                  navigate(`${basePath}/ftp`);
                } else {
                  toast.error(response.error || 'Une erreur est survenue');
                }
              })
              .catch(() => toast.error('Une erreur est survenue'))
              .finally(() => setIsSubmitting(false));
          }}
        >
          Confirmer la suppression
        </Button>
      </supprimerModal.Component>

      <AnnulerModalContent
        ftp={ftp}
        onDone={refresh}
      />
    </TrichineDetailPage>
  );
}

function ModifierModalContent({ ftp, onDone }: { ftp: TrichineFTPDetailType; onDone: () => void }) {
  const [laboratoires, setLaboratoires] = useState<Array<TrichineLaboratoire>>([]);
  const [destinataire, setDestinataire] = useState(ftp.destinataire_entity_id);
  const [modeTransport, setModeTransport] = useState(ftp.mode_transport ?? '');
  const [commentaire, setCommentaire] = useState(ftp.commentaire ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getTrichineLaboratoires()
      .then((response) => {
        if (response.ok && response.data) setLaboratoires(response.data.laboratoires);
      })
      .catch(console.error);
  }, []);

  // Réaligne le formulaire sur la fiche rechargée après un enregistrement
  useEffect(() => {
    setDestinataire(ftp.destinataire_entity_id);
    setModeTransport(ftp.mode_transport ?? '');
    setCommentaire(ftp.commentaire ?? '');
  }, [ftp]);

  return (
    <modifierModal.Component title={`Modifier la fiche ${ftp.numero_fiche}`}>
      <Select
        label="Laboratoire destinataire"
        nativeSelectProps={{
          value: destinataire,
          onChange: (event) => setDestinataire(event.target.value),
        }}
      >
        {laboratoires.map((laboratoire) => (
          <option
            key={laboratoire.id}
            value={laboratoire.id}
          >
            {laboratoire.nom_d_usage || laboratoire.raison_sociale}
          </option>
        ))}
      </Select>
      <Input
        label="Mode de transport (optionnel)"
        nativeInputProps={{
          type: 'text',
          value: modeTransport,
          onChange: (event) => setModeTransport(event.target.value),
        }}
      />
      <Input
        label="Commentaire (optionnel)"
        textArea
        nativeTextAreaProps={{
          value: commentaire,
          onChange: (event) => setCommentaire(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting || !destinataire}
        onClick={() => {
          setIsSubmitting(true);
          modifierTrichineFTP(ftp.id, {
            destinataire_entity_id: destinataire,
            mode_transport: modeTransport,
            commentaire,
          })
            .then((response) => {
              if (response.ok) {
                toast.success('Fiche modifiée');
                modifierModal.close();
                onDone();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Enregistrer
      </Button>
    </modifierModal.Component>
  );
}

function AnnulerModalContent({ ftp, onDone }: { ftp: TrichineFTPDetailType; onDone: () => void }) {
  const [raison, setRaison] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <annulerModal.Component title={`Annuler la fiche ${ftp.numero_fiche}`}>
      <p className="fr-text--sm">
        Le laboratoire sera prévenu de ne pas analyser le colis s'il lui parvient. Les pools de la fiche
        redeviendront disponibles pour une nouvelle transmission. L'annulation n'est plus possible une fois le
        colis réceptionné.
      </p>
      <Input
        label="Raison de l'annulation (obligatoire)"
        textArea
        nativeTextAreaProps={{
          value: raison,
          onChange: (event) => setRaison(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting || !raison.trim()}
        onClick={() => {
          setIsSubmitting(true);
          annulerTrichineFTP(ftp.id, raison.trim())
            .then((response) => {
              if (response.ok) {
                toast.success(`Fiche ${ftp.numero_fiche} annulée, le laboratoire a été prévenu`);
                annulerModal.close();
                setRaison('');
                onDone();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Confirmer l'annulation
      </Button>
    </annulerModal.Component>
  );
}
