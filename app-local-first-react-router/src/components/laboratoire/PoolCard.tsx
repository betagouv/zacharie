import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
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
  saisirResultatPool,
  type FtpConfirmationCreee,
  type LaboPool,
} from '@app/services/laboratoire';
import { formatAliases, monAlias, useMesEntitesAlias } from '@app/services/trichine-alias';
import PoolDocuments from '@app/components/laboratoire/PoolDocuments';
import LarvePhotos from '@app/components/laboratoire/LarvePhotos';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';
import {
  resultatAnalyseLabels,
  statutLogistiqueLabels,
  resultatBadgeSeverity,
  sitePrelevementLabels,
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
export const refusModal = createModal({ isOpenedByDefault: false, id: 'labo-refus-pool-modal' });
export const resultatModal = createModal({ isOpenedByDefault: false, id: 'labo-resultat-pool-modal' });

// Résultats autorisés par type de laboratoire (cf doc/trichine.md §3.2)
const LVD_RESULTS = [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.DOUTEUX];
const LNR_RESULTS = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
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
  onRefuser,
  onSaisirResultat,
  onCorrigerResultat,
  onDocumentDepose,
}: {
  pool: LaboPool;
  isLnr: boolean;
  confirmation: PoolConfirmation | null;
  saisieActive: boolean;
  onRefuser: () => void;
  onSaisirResultat: () => void;
  onCorrigerResultat: () => void;
  onDocumentDepose: () => void;
}) {
  const [compositionOuverte, setCompositionOuverte] = useState(false);
  const resultatSaisi = pool.resultat_analyse !== null;
  // Le LNR confirme les pools non négatifs : la saisie reste ouverte sur un DOUTEUX
  const peutSaisir =
    saisieActive && (!resultatSaisi || (isLnr && pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX));
  // Un DOUTEUX n'est pas corrigeable : la confirmation est déjà partie au LNR
  const peutCorriger =
    saisieActive && resultatSaisi && !peutSaisir && pool.resultat_analyse !== TrichineResultatAnalyse.DOUTEUX;
  const nombre = pool.TrichineEchantillons.length;
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
              <li
                key={echantillon.id}
                className="rounded border border-gray-200 p-2"
              >
                <span className="font-semibold">{echantillon.reference_echantillon}</span>
                {echantillon.Aliases.length > 0 && ` (${formatAliases(echantillon.Aliases)})`} —{' '}
                {sitePrelevementLabels[echantillon.site_prelevement]} — {echantillon.masse_grammes} g
                <br />
                Carcasse {echantillon.Carcasse.numero_bracelet} ({echantillon.Carcasse.espece ?? '—'}) — mise
                à mort le{' '}
                {echantillon.Carcasse.date_mise_a_mort
                  ? dayjs(echantillon.Carcasse.date_mise_a_mort).format('DD/MM/YYYY')
                  : '—'}{' '}
                à {echantillon.Carcasse.Fei.commune_mise_a_mort ?? '—'}
              </li>
            ))}
          </ul>
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onSaisirResultat}
          >
            {isLnr ? 'Saisir le résultat de confirmation' : 'Saisir le résultat'}
          </Button>
          <Button
            type="button"
            priority="secondary"
            onClick={onRefuser}
          >
            Refuser ce pool
          </Button>
        </div>
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
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState(dayjs().format('YYYY-MM-DD'));
  const [referenceLabo, setReferenceLabo] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [raison, setRaison] = useState('');
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
    setDateDebut('');
    setDateFin(dayjs().format('YYYY-MM-DD'));
    setReferenceLabo('');
    setCommentaire('');
    setRaison('');
  }, [pool?.id]);
  // Pré-remplit avec la référence déjà posée, qui peut arriver après l'ouverture : sans écraser
  // ce que le laboratoire a commencé à saisir
  useEffect(() => {
    setReferenceLabo((saisie) => saisie || maReference);
  }, [pool?.id, maReference]);

  const correction = mode === 'correction';
  const options = isLnr ? LNR_RESULTS : LVD_RESULTS;
  const parasiteRequis = resultat === TrichineResultatAnalyse.NON_NEGATIF;
  const versLnr = resultat === TrichineResultatAnalyse.DOUTEUX;
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

  const enregistrer = () => {
    if (!pool || !resultat) return;
    setIsSubmitting(true);
    const payload = {
      resultat_analyse: resultat,
      parasite_identifie: parasiteRequis ? parasite.trim() : undefined,
      date_debut_analyse: dateDebut || undefined,
      date_fin_analyse: dateFin || undefined,
      reference_labo: referenceLabo.trim() || undefined,
      commentaire: commentaire.trim() || undefined,
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
          (parasiteRequis && !parasite.trim()) ||
          (correction && !raison.trim()) ||
          isSubmitting,
        onClick: enregistrer,
      }}
    >
      {correction && (
        <Alert
          severity="info"
          small
          className="fr-mb-2w"
          description={`Résultat actuel : ${
            pool?.resultat_analyse ? resultatAnalyseLabels[pool.resultat_analyse] : '—'
          }. La correction est refusée si le service d'inspection a déjà statué sur une carcasse du pool.`}
        />
      )}
      <Select
        label="Résultat d'analyse"
        nativeSelectProps={{
          value: resultat,
          onChange: (event) => setResultat(event.target.value as TrichineResultatAnalyse),
        }}
      >
        <option value="">Sélectionnez un résultat</option>
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {resultatAnalyseLabels[option]}
          </option>
        ))}
      </Select>
      {parasiteRequis && (
        <Input
          label="Parasite identifié (obligatoire)"
          nativeInputProps={{
            type: 'text',
            value: parasite,
            onChange: (event) => setParasite(event.target.value),
          }}
        />
      )}
      <div className="flex flex-wrap gap-x-4">
        <Input
          label="Début d'analyse"
          nativeInputProps={{
            type: 'date',
            value: dateDebut,
            onChange: (event) => setDateDebut(event.target.value),
          }}
        />
        <Input
          label="Fin d'analyse"
          nativeInputProps={{
            type: 'date',
            value: dateFin,
            onChange: (event) => setDateFin(event.target.value),
          }}
        />
        <Input
          label="Ma référence interne (optionnel)"
          className="grow"
          nativeInputProps={{
            type: 'text',
            value: referenceLabo,
            onChange: (event) => setReferenceLabo(event.target.value),
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
      {correction && (
        <Input
          label="Raison de la correction (obligatoire)"
          textArea
          nativeTextAreaProps={{
            value: raison,
            onChange: (event) => setRaison(event.target.value),
          }}
        />
      )}
      {versLnr && (
        <Alert
          severity="warning"
          className="fr-mb-2w"
          title="Ce pool va partir au LNR pour confirmation"
          description={
            <div className="fr-mb-0">
              <div>
                Une nouvelle fiche de transmission est créée, adressée au laboratoire national de référence
                (LNR), qui est averti par email.
              </div>
              <div>L’émetteur du pool est averti du résultat non négatif.</div>
            </div>
          }
        />
      )}
    </resultatModal.Component>
  );
}

export function RefusModalContent({ pool, onDone }: { pool: LaboPool | null; onDone: () => void }) {
  const [raison, setRaison] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Évite qu'une raison saisie pour un pool ne reste pré-remplie pour le suivant
  useEffect(() => {
    setRaison('');
  }, [pool?.id]);

  return (
    <refusModal.Component title={`Refuser le pool ${pool?.reference_pool ?? ''}`}>
      <p className="fr-text--sm">
        Le pool sera marqué « analyse impossible » et l'émetteur sera invité à réaliser de nouveaux
        prélèvements.
      </p>
      <Input
        label="Raison du refus (obligatoire)"
        textArea
        nativeTextAreaProps={{
          value: raison,
          onChange: (event) => setRaison(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting || !raison.trim() || !pool}
        onClick={() => {
          if (!pool) return;
          setIsSubmitting(true);
          refuserPool(pool.id, raison.trim())
            .then((response) => {
              if (response.ok) {
                toast.success('Pool refusé, l’émetteur a été notifié');
                refusModal.close();
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
        Confirmer le refus
      </Button>
    </refusModal.Component>
  );
}
