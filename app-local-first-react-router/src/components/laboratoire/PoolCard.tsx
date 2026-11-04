import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import {
  TrichineResultatAnalyse,
  type TrichineDocument,
  type TrichinePool,
  type TrichineStatutLogistiqueFTP,
} from '@prisma/client';
import {
  corrigerResultatPool,
  refuserPool,
  retirerEchantillonDuPoolLabo,
  saisirResultatPool,
  type FtpConfirmationCreee,
  type LaboEchantillon,
  type LaboPool,
} from '@app/services/laboratoire';
import { formatAliases, monAlias, useMesEntitesAlias } from '@app/services/trichine-alias';
import PoolDocuments from '@app/components/laboratoire/PoolDocuments';
import EchantillonLabo, { EchantillonRetireLabo } from '@app/components/laboratoire/EchantillonLabo';
import LarvePhotos from '@app/components/laboratoire/LarvePhotos';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';
import {
  resultatAnalyseLabels,
  statutLogistiqueLabels,
  resultatBadgeSeverity,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
} from '@app/utils/trichine';

/**
 * Saisie du résultat d'un pool par le laboratoire.
 * Partagée par la fiche de transmission et la page de détail d'un pool : c'est le même geste,
 * il ne doit pas exister en deux exemplaires.
 *
 * Une fiche porte plusieurs pools : la carte se lit d'un coup d'œil (référence, statut, résultat),
 * le détail des échantillons se déplie à la demande et la saisie s'ouvre en modale.
 */
export const resultatModal = createModal({ isOpenedByDefault: false, id: 'labo-resultat-pool-modal' });
export const retraitModal = createModal({ isOpenedByDefault: false, id: 'labo-retrait-echantillon-modal' });

/** Échantillon que le laboratoire s'apprête à retirer de son pool */
export type RetraitEchantillon = { echantillon: LaboEchantillon; referencePool: string };

// Résultats autorisés par type de laboratoire (cf doc/trichine.md §3.2)
const LVD_RESULTS = [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.DOUTEUX];
const LNR_RESULTS = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];
// Résultats sur lesquels le laboratoire a vu des larves et peut indiquer leur nombre
const RESULTATS_AVEC_LARVES: Array<TrichineResultatAnalyse> = [
  TrichineResultatAnalyse.DOUTEUX,
  ...LNR_RESULTS,
];

/** Saisie d'un premier résultat, ou correction d'un résultat déjà rendu. */
export type ResultatMode = 'saisie' | 'correction';

/** FTP par laquelle le laboratoire a transmis ce pool non négatif au LNR */
export type PoolConfirmation = {
  id: string;
  numero_fiche: string;
  statut_logistique: TrichineStatutLogistiqueFTP;
};

export default function PoolCard({
  pool,
  isLnr,
  confirmation,
  saisieActive,
  onSaisirResultat,
  onCorrigerResultat,
  onRetirerEchantillon,
  onDocumentDepose,
  onAliasChange,
}: {
  pool: LaboPool;
  isLnr: boolean;
  confirmation: PoolConfirmation | null;
  saisieActive: boolean;
  onSaisirResultat: () => void;
  onCorrigerResultat: () => void;
  onRetirerEchantillon: (echantillon: LaboEchantillon) => void;
  onDocumentDepose: () => void;
  onAliasChange: () => void;
}) {
  const [compositionOuverte, setCompositionOuverte] = useState(false);
  const mesEntites = useMesEntitesAlias();
  const resultatSaisi = pool.resultat_analyse !== null;
  // Le LNR confirme les pools non négatifs : la saisie reste ouverte sur un DOUTEUX
  const peutSaisir =
    saisieActive && (!resultatSaisi || (isLnr && pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX));
  // Une fois le pool parti en confirmation, son résultat appartient au LNR
  const transmisAuLnr = !isLnr && !!confirmation && confirmation.statut_logistique !== 'ANNULEE';
  // Un DOUTEUX n'est pas corrigeable : la confirmation est déjà partie au LNR
  const peutCorriger =
    saisieActive &&
    resultatSaisi &&
    !peutSaisir &&
    !transmisAuLnr &&
    pool.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX;
  const nombre = pool.TrichineEchantillons.length;
  const nombreRetires = pool.EchantillonsRetires.length;
  // Retrait possible tant que le résultat peut être saisi. Le dernier échantillon ne se retire
  // pas : c'est alors le pool qu'on refuse.
  const peutRetirer = peutSaisir && nombre > 1;
  const carcasses = pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse.numero_bracelet)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <div className="fr-mb-2w flex flex-wrap items-center gap-2">
        <h2 className="fr-h5 fr-mb-0">
          <Link
            to={`/app/laboratoire/pools/${pool.reference_pool}`}
            className="fr-link"
          >
            {pool.reference_pool}
          </Link>
        </h2>
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

      <div className="fr-mb-2w">
        <p className="fr-text--sm fr-mb-0 text-gray-600">
          {nombre} échantillon{nombre > 1 ? 's' : ''}
          {!!carcasses && ` — carcasses ${carcasses}`}
          {nombreRetires > 0 &&
            ` — ${nombreRetires} retiré${nombreRetires > 1 ? 's' : ''} par le laboratoire`}
        </p>
        {pool.Aliases.length > 0 && (
          <p className="fr-text--sm fr-mb-0 text-gray-600">Réf. internes : {formatAliases(pool.Aliases)}</p>
        )}
        <button
          type="button"
          onClick={() => setCompositionOuverte((ouverte) => !ouverte)}
          className={`fr-link fr-text--sm fr-link--icon-left ${
            compositionOuverte ? 'fr-icon-arrow-up-s-line' : 'fr-icon-arrow-down-s-line'
          }`}
          aria-expanded={compositionOuverte}
        >
          {compositionOuverte ? 'Masquer le détail' : 'Afficher le détail'}
        </button>
        {compositionOuverte && (
          <ul className="fr-text--sm fr-mt-1w list-none space-y-1 p-0">
            {pool.TrichineEchantillons.map((echantillon) => (
              <EchantillonLabo
                key={echantillon.id}
                echantillon={echantillon}
                mesEntites={mesEntites}
                onRetirer={peutRetirer ? () => onRetirerEchantillon(echantillon) : null}
                onAliasChange={onAliasChange}
              />
            ))}
          </ul>
        )}
        {compositionOuverte && nombreRetires > 0 && (
          <>
            <p className="fr-text--sm fr-mt-2w fr-mb-1v font-bold">Retirés du pool par le laboratoire</p>
            <ul className="fr-text--sm list-none space-y-1 p-0">
              {pool.EchantillonsRetires.map((echantillon) => (
                <EchantillonRetireLabo
                  key={echantillon.id}
                  echantillon={echantillon}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {confirmation && (
        <div className="fr-mb-2w rounded border-l-4 border-blue-800 bg-blue-50 p-4">
          <p className="fr-text--sm fr-mb-1w font-bold">
            Transmis au LNR pour confirmation — FTP{' '}
            <Link
              to={`/app/laboratoire/ftp/${confirmation.numero_fiche}`}
              className="fr-link fr-text--sm"
            >
              {confirmation.numero_fiche}
            </Link>{' '}
            ({statutLogistiqueLabels[confirmation.statut_logistique].toLowerCase()})
          </p>
        </div>
      )}

      {resultatSaisi && (
        <ul className="fr-text--sm fr-mb-2w space-y-1">
          {pool.parasite_identifie && <li>Parasite identifié : {pool.parasite_identifie}</li>}
          {pool.nombre_larves_lvd != null && (
            <li>Larves comptées par le laboratoire agréé : {pool.nombre_larves_lvd}</li>
          )}
          {pool.nombre_larves_lnr != null && <li>Larves comptées par le LNR : {pool.nombre_larves_lnr}</li>}
          {pool.raison_refus && <li>Raison du refus : {pool.raison_refus}</li>}
          {pool.date_debut_analyse && (
            <li>Début d'analyse : {dayjs(pool.date_debut_analyse).format('DD/MM/YYYY')}</li>
          )}
          {pool.date_fin_analyse && (
            <li>Fin d'analyse : {dayjs(pool.date_fin_analyse).format('DD/MM/YYYY')}</li>
          )}
          {pool.commentaire && <li>Commentaire : {pool.commentaire}</li>}
        </ul>
      )}

      {peutSaisir && (
        <Button
          type="button"
          onClick={onSaisirResultat}
        >
          {isLnr ? 'Saisir le résultat de confirmation' : 'Saisir le résultat'}
        </Button>
      )}

      {peutCorriger && (
        <Button
          type="button"
          priority="secondary"
          onClick={onCorrigerResultat}
        >
          Corriger le résultat
        </Button>
      )}

      <PoolDocuments
        poolId={pool.id}
        referencePool={pool.reference_pool}
        documents={pool.Documents}
        onDone={onDocumentDepose}
      />
    </div>
  );
}

export function ResultatModalContent({
  pool,
  isLnr,
  mode,
  onDone,
}: {
  pool: LaboPool | null;
  isLnr: boolean;
  mode: ResultatMode;
  onDone: () => void;
}) {
  const [resultat, setResultat] = useState<TrichineResultatAnalyse | ''>('');
  const [parasite, setParasite] = useState('');
  const [nombreLarves, setNombreLarves] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [referenceLabo, setReferenceLabo] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [dateEnvoiLnr, setDateEnvoiLnr] = useState(dayjs().format('YYYY-MM-DD'));
  const [modeTransportLnr, setModeTransportLnr] = useState('');
  const [conditionsConservationLnr, setConditionsConservationLnr] = useState('');
  const [raison, setRaison] = useState('');
  const [raisonRefus, setRaisonRefus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Sur un non négatif, la modale reste ouverte pour guider l'envoi au LNR
  const [ftpConfirmation, setFtpConfirmation] = useState<FtpConfirmationCreee | null>(null);
  const [photos, setPhotos] = useState<Array<TrichineDocument>>([]);
  const { isDownloading, onDownloadFtpPdf } = useDownloadFtpPdf('laboratoire');
  const mesEntites = useMesEntitesAlias();
  const maReference = monAlias(pool?.Aliases, mesEntites)?.reference ?? '';

  // Une fiche porte plusieurs pools : rien de ce qui a été saisi pour l'un ne doit rester pour le suivant
  useEffect(() => {
    setFtpConfirmation(null);
    setPhotos([]);
  }, [pool?.id]);
  useEffect(() => {
    setResultat('');
    setParasite('');
    setNombreLarves('');
    setDateDebut('');
    setDateFin('');
    setReferenceLabo('');
    setCommentaire('');
    setDateEnvoiLnr(dayjs().format('YYYY-MM-DD'));
    setModeTransportLnr('');
    setConditionsConservationLnr('');
    setRaison('');
    setRaisonRefus('');
  }, [pool?.id]);
  // Pré-remplit avec la référence déjà posée, qui peut arriver après l'ouverture : sans écraser
  // ce que le laboratoire a commencé à saisir
  useEffect(() => {
    setReferenceLabo((saisie) => saisie || maReference);
  }, [pool?.id, maReference]);

  const correction = mode === 'correction';
  // Analyse impossible : un résultat comme un autre pour le laboratoire, enregistré par la route de refus
  const options = isLnr ? LNR_RESULTS : LVD_RESULTS;
  const choix = correction ? options : [...options, TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE];
  const analyseImpossible = resultat === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE;
  const parasiteRequis = resultat === TrichineResultatAnalyse.NON_NEGATIF;
  const larvesSaisissables = !!resultat && RESULTATS_AVEC_LARVES.includes(resultat);
  const nombreLarvesInvalide =
    larvesSaisissables &&
    !!nombreLarves &&
    !(Number.isInteger(Number(nombreLarves)) && Number(nombreLarves) >= 1);
  const versLnr = resultat === TrichineResultatAnalyse.DOUTEUX;
  // La FTP de confirmation part au LNR avec ce qu'il doit savoir de l'échantillon
  const envoiLnrIncomplet = versLnr && (!nombreLarves || !conditionsConservationLnr.trim());
  const aujourdhui = dayjs().format('YYYY-MM-DD');
  const dateFuture = (date: string) => !!date && date > aujourdhui;
  const datesInvalides =
    !analyseImpossible &&
    (dateFuture(dateDebut) || dateFuture(dateFin) || (!!dateDebut && !!dateFin && dateDebut > dateFin));
  const reference = pool?.reference_pool ?? '';

  if (ftpConfirmation) {
    return (
      <resultatModal.Component title={`Pool ${reference} transmis au LNR`}>
        <Alert
          severity="success"
          small
          className="fr-mb-3w"
          description={`Résultat non négatif enregistré. La fiche de transmission de confirmation ${ftpConfirmation.numero_fiche} a été créée et adressée au laboratoire national de référence, qui en a été averti par email. L’émetteur du pool a été averti.`}
        />
        <h3 className="fr-text--sm fr-mb-1w font-bold">1. Envoyez le pool au LNR</h3>
        <p className="fr-text--sm fr-mb-1w">Imprimez la fiche et joignez-la au colis.</p>
        <div className="fr-mb-3w flex flex-wrap gap-2">
          <Button
            type="button"
            iconId="fr-icon-printer-line"
            disabled={isDownloading}
            onClick={() => onDownloadFtpPdf(ftpConfirmation.id, ftpConfirmation.numero_fiche)}
          >
            Télécharger la fiche à joindre au colis
          </Button>
          <Button
            priority="secondary"
            linkProps={{
              to: `/app/laboratoire/ftp/${ftpConfirmation.numero_fiche}`,
              onClick: () => resultatModal.close(),
            }}
          >
            Voir la fiche
          </Button>
        </div>
        <h3 className="fr-text--sm fr-mb-1w font-bold">2. Ajoutez les photographies des larves</h3>
        <p className="fr-text--sm fr-mb-1w">
          Le LNR les consulte sur la fiche. Vous pourrez aussi les ajouter plus tard depuis la fiche.
        </p>
        <LarvePhotos
          ftpId={ftpConfirmation.id}
          numeroFiche={ftpConfirmation.numero_fiche}
          documents={photos}
          peutDeposer
          onDone={(documents) => setPhotos((deposees) => [...deposees, ...documents])}
        />
      </resultatModal.Component>
    );
  }

  const enregistrerAnalyseImpossible = () => {
    if (!pool) return;
    setIsSubmitting(true);
    refuserPool(pool.id, raisonRefus.trim())
      .then((response) => {
        if (response.ok) {
          onDone();
          toast.success('Analyse impossible enregistrée, l’émetteur a été notifié');
          resultatModal.close();
        } else {
          toast.error(response.error || 'Une erreur est survenue');
        }
      })
      .catch(() => toast.error('Une erreur est survenue'))
      .finally(() => setIsSubmitting(false));
  };

  const enregistrer = () => {
    if (!pool || !resultat) return;
    if (analyseImpossible) {
      enregistrerAnalyseImpossible();
      return;
    }
    setIsSubmitting(true);
    const payload = {
      resultat_analyse: resultat,
      parasite_identifie: parasiteRequis ? parasite.trim() : undefined,
      nombre_larves: larvesSaisissables && nombreLarves ? Number(nombreLarves) : undefined,
      date_debut_analyse: dateDebut || undefined,
      date_fin_analyse: dateFin || undefined,
      // Seulement si le laboratoire l'a changée : celle déjà posée n'a pas à être revérifiée.
      // Une chaîne vide retire la référence déjà posée.
      reference_labo: referenceLabo.trim() !== maReference ? referenceLabo.trim() : undefined,
      commentaire: commentaire.trim() || undefined,
      ...(versLnr && {
        date_envoi_lnr: dateEnvoiLnr || undefined,
        mode_transport_lnr: modeTransportLnr.trim() || undefined,
        conditions_conservation_lnr: conditionsConservationLnr.trim(),
      }),
    };
    // Seule une première saisie peut générer une FTP de confirmation vers le LNR
    const request: Promise<{
      ok: boolean;
      data: { pool: TrichinePool; ftp_confirmation?: FtpConfirmationCreee | null } | null;
      error: string;
    }> = correction
      ? corrigerResultatPool(pool.id, { ...payload, raison: raison.trim() })
      : saisirResultatPool(pool.id, payload);
    request
      .then((response) => {
        if (response.ok) {
          onDone();
          const ftpCreee = response.data?.ftp_confirmation ?? null;
          if (ftpCreee) {
            setFtpConfirmation(ftpCreee);
            return;
          }
          toast.success(
            correction
              ? 'Résultat corrigé, l’émetteur a été notifié'
              : 'Résultat enregistré, l’émetteur a été notifié'
          );
          resultatModal.close();
        } else {
          toast.error(response.error || 'Une erreur est survenue');
        }
      })
      .catch(() => toast.error('Une erreur est survenue'))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <resultatModal.Component
      size="large"
      title={
        correction
          ? `Corriger le résultat du pool ${reference}`
          : isLnr
            ? `Résultat de confirmation du pool ${reference}`
            : `Résultat du pool ${reference}`
      }
      // Le bouton dans le pied de la modale reste visible quel que soit le contenu affiché
      buttons={{
        children: correction
          ? 'Enregistrer la correction'
          : versLnr
            ? 'Enregistrer et transmettre au LNR'
            : 'Enregistrer le résultat',
        doClosesModal: false,
        disabled:
          !pool ||
          !resultat ||
          (analyseImpossible && !raisonRefus.trim()) ||
          (parasiteRequis && !parasite.trim()) ||
          nombreLarvesInvalide ||
          envoiLnrIncomplet ||
          datesInvalides ||
          (correction && !raison.trim()) ||
          isSubmitting,
        onClick: enregistrer,
      }}
    >
      <p className="fr-text--sm fr-mb-2w text-gray-600">
        Sauf mention contraire, tous les champs sont requis.
      </p>
      {correction && (
        <>
          <Alert
            severity="info"
            small
            className="fr-mb-2w"
            description={`Résultat actuel : ${
              pool?.resultat_analyse ? resultatAnalyseLabels[pool.resultat_analyse] : '—'
            }. La correction est refusée si le service d'inspection a déjà statué sur une carcasse du pool.`}
          />
          <Input
            label="Raison de la correction"
            textArea
            nativeTextAreaProps={{
              rows: 2,
              value: raison,
              onChange: (event) => setRaison(event.target.value),
            }}
          />
        </>
      )}
      <RadioButtons
        legend="Résultat d'analyse"
        options={choix.map((option) => ({
          label: resultatAnalyseLabels[option],
          hintText:
            option === TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE
              ? 'L’émetteur sera invité à réaliser de nouveaux prélèvements'
              : undefined,
          nativeInputProps: {
            value: option,
            checked: resultat === option,
            onChange: () => setResultat(option),
          },
        }))}
      />
      {versLnr && (
        <Alert
          severity="warning"
          small
          className="fr-mb-3w"
          description="Ce pool va partir au LNR pour confirmation : une fiche de transmission est créée et adressée au laboratoire national de référence, averti par email. L’émetteur du pool est averti du résultat non négatif."
        />
      )}
      {analyseImpossible && (
        <Input
          label="Raison de l’analyse impossible"
          hintText="Transmise à l’émetteur"
          textArea
          nativeTextAreaProps={{
            rows: 2,
            value: raisonRefus,
            onChange: (event) => setRaisonRefus(event.target.value),
          }}
        />
      )}
      {parasiteRequis && (
        <Input
          label="Parasite identifié"
          nativeInputProps={{
            type: 'text',
            value: parasite,
            onChange: (event) => setParasite(event.target.value),
          }}
        />
      )}
      {larvesSaisissables && (
        <Input
          label={`Nombre de larves découvertes dans le pool${versLnr ? '' : ' (optionnel)'}`}
          hintText="Visible uniquement par les laboratoires"
          state={nombreLarvesInvalide ? 'error' : 'default'}
          stateRelatedMessage="Nombre entier supérieur à 0 attendu"
          nativeInputProps={{
            type: 'number',
            inputMode: 'numeric',
            min: 1,
            step: 1,
            value: nombreLarves,
            onChange: (event) => setNombreLarves(event.target.value),
          }}
        />
      )}
      {versLnr && (
        <fieldset className="fr-mb-2w border-0 p-0">
          <legend className="fr-text--sm fr-mb-1w font-bold">
            Envoi au LNR (figure sur la fiche de transmission)
          </legend>
          <Input
            label="Date d'envoi des échantillons"
            nativeInputProps={{
              type: 'date',
              value: dateEnvoiLnr,
              onChange: (event) => setDateEnvoiLnr(event.target.value),
            }}
          />
          <Input
            label="Modalités de transmission (optionnel)"
            hintText="Transporteur, type de colis…"
            nativeInputProps={{
              type: 'text',
              value: modeTransportLnr,
              onChange: (event) => setModeTransportLnr(event.target.value),
            }}
          />
          <Input
            label="Conditions de conservation de l'élément parasitaire"
            hintText="Ex. : larves dans l'éthanol à 70 %, sous froid positif"
            textArea
            nativeTextAreaProps={{
              rows: 2,
              value: conditionsConservationLnr,
              onChange: (event) => setConditionsConservationLnr(event.target.value),
            }}
          />
        </fieldset>
      )}
      {!!resultat && !analyseImpossible && (
        <>
          <div className="flex flex-wrap gap-x-4">
            <Input
              label="Début d'analyse (optionnel)"
              state={dateFuture(dateDebut) ? 'error' : 'default'}
              stateRelatedMessage="Date dans le futur"
              nativeInputProps={{
                type: 'date',
                max: aujourdhui,
                value: dateDebut,
                onChange: (event) => setDateDebut(event.target.value),
              }}
            />
            <Input
              label="Fin d'analyse (optionnel)"
              state={
                dateFuture(dateFin) || (!!dateDebut && !!dateFin && dateDebut > dateFin) ? 'error' : 'default'
              }
              stateRelatedMessage={
                dateFuture(dateFin) ? 'Date dans le futur' : 'La fin doit suivre le début d’analyse'
              }
              nativeInputProps={{
                type: 'date',
                min: dateDebut || undefined,
                max: aujourdhui,
                value: dateFin,
                onChange: (event) => setDateFin(event.target.value),
              }}
            />
          </div>
          <Input
            label="Commentaire (optionnel)"
            textArea
            nativeTextAreaProps={{
              rows: 2,
              value: commentaire,
              onChange: (event) => setCommentaire(event.target.value),
            }}
          />
          {/* Une correction intervient analyses terminées : la référence est alors figée */}
          {!correction && (
            <Input
              label="Ma référence interne (optionnel)"
              nativeInputProps={{
                type: 'text',
                value: referenceLabo,
                onChange: (event) => setReferenceLabo(event.target.value),
              }}
            />
          )}
        </>
      )}
    </resultatModal.Component>
  );
}

export function RetraitEchantillonModalContent({
  retrait,
  onDone,
}: {
  retrait: RetraitEchantillon | null;
  onDone: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Évite qu'un motif saisi pour un échantillon ne reste pré-rempli pour le suivant
  useEffect(() => {
    setMotif('');
  }, [retrait?.echantillon.id]);

  const echantillon = retrait?.echantillon;

  return (
    <retraitModal.Component
      title={`Retirer l'échantillon ${echantillon?.reference_echantillon ?? ''} du pool ${
        retrait?.referencePool ?? ''
      }`}
    >
      <p className="fr-text--sm">
        L'échantillon ne sera pas analysé avec le pool et n'en recevra pas le résultat. La carcasse{' '}
        {echantillon?.Carcasse.numero_bracelet} sera à prélever de nouveau : l'émetteur en est averti.
      </p>
      <Input
        label="Motif du retrait (obligatoire)"
        hintText="Par exemple : tube absent du colis, échantillon abîmé, numéro illisible"
        textArea
        nativeTextAreaProps={{
          value: motif,
          onChange: (event) => setMotif(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting || !motif.trim() || !echantillon}
        onClick={() => {
          if (!echantillon) return;
          setIsSubmitting(true);
          retirerEchantillonDuPoolLabo(echantillon.id, motif.trim())
            .then((response) => {
              if (response.ok) {
                toast.success('Échantillon retiré du pool, l’émetteur a été notifié');
                retraitModal.close();
                setMotif('');
                onDone();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Confirmer le retrait
      </Button>
    </retraitModal.Component>
  );
}
