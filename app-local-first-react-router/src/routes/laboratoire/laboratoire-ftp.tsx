import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, TrichineStatutLogistiqueFTP } from '@prisma/client';
import {
  getLaboFTP,
  getLaboMe,
  receptionnerFTP,
  refuserPool,
  saisirResultatPool,
  type LaboFTPDetail,
  type LaboPool,
} from '@app/services/laboratoire';
import {
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  sitePrelevementLabels,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
} from '@app/utils/trichine';

const refusModal = createModal({ isOpenedByDefault: false, id: 'labo-refus-pool-modal' });

// Résultats autorisés par type de laboratoire (cf doc/trichine.md §3.2)
const LVD_RESULTS = [TrichineResultatAnalyse.NEGATIF, TrichineResultatAnalyse.DOUTEUX];
const LNR_RESULTS = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];

export default function LaboratoireFTP() {
  const params = useParams();
  const navigate = useNavigate();
  const [ftp, setFtp] = useState<LaboFTPDetail | null>(null);
  const [isLnr, setIsLnr] = useState(false);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  const [dateReception, setDateReception] = useState(dayjs().format('YYYY-MM-DD'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refusPool, setRefusPool] = useState<LaboPool | null>(null);

  const refresh = useCallback(() => {
    getLaboFTP(params.ftp_id!)
      .then((response) => {
        if (response.ok && response.data) setFtp(response.data.ftp);
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, [params.ftp_id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
    getLaboMe()
      .then((response) => {
        if (response.ok && response.data) setIsLnr(response.data.isLnr);
      })
      .catch(console.error);
  }, [refresh]);

  if (!ftp) {
    return (
      <div className="fr-container fr-my-md-14v p-4">
        <p>{hasTriedLoading ? 'FTP introuvable' : 'Chargement…'}</p>
      </div>
    );
  }

  const aReceptionner = ftp.statut_logistique === TrichineStatutLogistiqueFTP.ENVOYEE;

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
                Émetteur : {ftp.ExpediteurUser.prenom} {ftp.ExpediteurUser.nom_de_famille}
                {ftp.ExpediteurEntity
                  ? ` — ${ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale}`
                  : ''}
              </li>
              {ftp.ExpediteurUser.email && <li>Email : {ftp.ExpediteurUser.email}</li>}
              {ftp.ExpediteurUser.telephone && <li>Téléphone : {ftp.ExpediteurUser.telephone}</li>}
              {ftp.date_envoi && <li>Envoyée le {dayjs(ftp.date_envoi).format('DD/MM/YYYY')}</li>}
              {ftp.mode_transport && <li>Mode de transport : {ftp.mode_transport}</li>}
              {ftp.commentaire && <li>Commentaire : {ftp.commentaire}</li>}
            </ul>

            {aReceptionner && (
              <div className="fr-mt-2w">
                <Input
                  label="Date de réception"
                  className="max-w-xs"
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
            )}
          </div>

          {ftp.TrichinePoolFTPs.map(({ TrichinePool: pool }) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              isLnr={isLnr}
              saisieActive={!aReceptionner && ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON}
              onRefuser={() => {
                setRefusPool(pool);
                refusModal.open();
              }}
              onSaved={refresh}
            />
          ))}

          <Button
            priority="secondary"
            type="button"
            onClick={() => navigate('/app/laboratoire/ftp')}
          >
            Retour aux FTP
          </Button>
        </div>
      </div>

      <RefusModalContent
        pool={refusPool}
        onDone={refresh}
      />
    </div>
  );
}

function PoolCard({
  pool,
  isLnr,
  saisieActive,
  onRefuser,
  onSaved,
}: {
  pool: LaboPool;
  isLnr: boolean;
  saisieActive: boolean;
  onRefuser: () => void;
  onSaved: () => void;
}) {
  const resultatSaisi = pool.resultat_analyse !== null;
  // Le LNR confirme les pools douteux : la saisie reste ouverte sur un DOUTEUX
  const peutSaisir =
    saisieActive && (!resultatSaisi || (isLnr && pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX));

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <div className="fr-mb-2w flex flex-wrap items-center gap-2">
        <h2 className="fr-h5 fr-mb-0">{pool.reference_pool}</h2>
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

      <h3 className="fr-text--md fr-mb-1w font-semibold">
        Composition ({pool.TrichineEchantillons.length} échantillon(s))
      </h3>
      <ul className="fr-text--sm fr-mb-2w list-none space-y-1 p-0">
        {pool.TrichineEchantillons.map((echantillon) => (
          <li
            key={echantillon.id}
            className="rounded border border-gray-200 p-2"
          >
            <span className="font-semibold">{echantillon.reference_echantillon}</span> —{' '}
            {sitePrelevementLabels[echantillon.site_prelevement]} — {echantillon.masse_grammes} g
            <br />
            Carcasse {echantillon.Carcasse.numero_bracelet} ({echantillon.Carcasse.espece ?? '—'}) — mise à
            mort le{' '}
            {echantillon.Carcasse.date_mise_a_mort
              ? dayjs(echantillon.Carcasse.date_mise_a_mort).format('DD/MM/YYYY')
              : '—'}{' '}
            à {echantillon.Carcasse.Fei.commune_mise_a_mort ?? '—'}
          </li>
        ))}
      </ul>

      {resultatSaisi && (
        <ul className="fr-text--sm fr-mb-2w space-y-1">
          {pool.parasite_identifie && <li>Parasite identifié : {pool.parasite_identifie}</li>}
          {pool.raison_refus && <li>Raison du refus : {pool.raison_refus}</li>}
          {pool.reference_labo && <li>Référence laboratoire : {pool.reference_labo}</li>}
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
        <PoolResultForm
          pool={pool}
          isLnr={isLnr}
          onRefuser={onRefuser}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function PoolResultForm({
  pool,
  isLnr,
  onRefuser,
  onSaved,
}: {
  pool: LaboPool;
  isLnr: boolean;
  onRefuser: () => void;
  onSaved: () => void;
}) {
  const [resultat, setResultat] = useState<TrichineResultatAnalyse | ''>('');
  const [parasite, setParasite] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState(dayjs().format('YYYY-MM-DD'));
  const [referenceLabo, setReferenceLabo] = useState(pool.reference_labo ?? '');
  const [commentaire, setCommentaire] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = isLnr ? LNR_RESULTS : LVD_RESULTS;
  const parasiteRequis = resultat === TrichineResultatAnalyse.NON_NEGATIF;

  return (
    <div className="rounded border border-gray-200 p-3">
      <h3 className="fr-text--md fr-mb-1w font-semibold">
        {isLnr ? 'Saisir le résultat de confirmation' : 'Saisir le résultat'}
      </h3>
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
      <div className="flex flex-wrap gap-4">
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
      </div>
      <Input
        label="Référence interne laboratoire (optionnel)"
        nativeInputProps={{
          type: 'text',
          value: referenceLabo,
          onChange: (event) => setReferenceLabo(event.target.value),
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
      {resultat === TrichineResultatAnalyse.DOUTEUX && (
        <Alert
          severity="warning"
          small
          className="fr-mb-2w"
          description="Une FTP de confirmation sera générée automatiquement vers le LNR. L'upload des photographies de larves sera disponible prochainement."
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!resultat || (parasiteRequis && !parasite.trim()) || isSubmitting}
          onClick={() => {
            if (!resultat) return;
            setIsSubmitting(true);
            saisirResultatPool(pool.id, {
              resultat_analyse: resultat,
              parasite_identifie: parasiteRequis ? parasite.trim() : undefined,
              date_debut_analyse: dateDebut || undefined,
              date_fin_analyse: dateFin || undefined,
              reference_labo: referenceLabo.trim() || undefined,
              commentaire: commentaire.trim() || undefined,
            })
              .then((response) => {
                if (response.ok) {
                  toast.success(
                    resultat === TrichineResultatAnalyse.DOUTEUX
                      ? 'Résultat enregistré — FTP de confirmation générée vers le LNR'
                      : 'Résultat enregistré, l’émetteur a été notifié'
                  );
                  onSaved();
                } else {
                  toast.error(response.error || 'Une erreur est survenue');
                }
              })
              .catch(() => toast.error('Une erreur est survenue'))
              .finally(() => setIsSubmitting(false));
          }}
        >
          Enregistrer le résultat
        </Button>
        <Button
          type="button"
          priority="secondary"
          onClick={onRefuser}
        >
          Refuser ce pool
        </Button>
      </div>
    </div>
  );
}

function RefusModalContent({ pool, onDone }: { pool: LaboPool | null; onDone: () => void }) {
  const [raison, setRaison] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
