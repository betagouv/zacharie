import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import {
  fetchModifRequestsForExaminateur,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@app/utils/carcasse-modification-request';

// Page de détail d'une demande, pour approuver ou refuser.
// - RENAME : confirmation avant/après + boutons.
// - NEW    : formulaire d'examen initial à remplir par l'examinateur + signature.
export default function ChasseurDemandeDeModificationDetail() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const user = useUser((state) => state.user);
  const requestsById = useZustandStore((state) => state.carcasseModifRequestsById);
  const carcasses = useZustandStore((state) => state.carcasses);
  const updateCarcasseModifRequest = useZustandStore((state) => state.updateCarcasseModifRequest);

  const request = request_id ? requestsById[request_id] : null;
  const carcasse = request ? carcasses[request.zacharie_carcasse_id] : null;

  // Hooks must run unconditionally
  const [examinateurAnomaliesCarcasseRaw, setExaminateurAnomaliesCarcasseRaw] = useState('');
  const [examinateurAnomaliesAbatsRaw, setExaminateurAnomaliesAbatsRaw] = useState('');
  const [examinateurCommentaire, setExaminateurCommentaire] = useState('');
  const [sansAnomalie, setSansAnomalie] = useState(false);
  const [approbationMiseSurLeMarche, setApprobationMiseSurLeMarche] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      fetchModifRequestsForExaminateur();
    }
  }, [request]);

  const splitAnomalies = (raw: string) =>
    raw
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  if (!request) {
    return (
      <div className="fr-container fr-py-4w">
        <Alert
          severity="info"
          title="Demande introuvable"
          description={
            <>
              Cette demande n'existe pas ou a déjà été traitée.{' '}
              <Link to="/app/chasseur/demandes-de-modification">Retour à la liste</Link>
            </>
          }
        />
      </div>
    );
  }

  if (!carcasse) {
    return <p className="fr-container fr-py-4w">Chargement de la carcasse…</p>;
  }

  if (carcasse.examinateur_initial_user_id !== user?.id) {
    return (
      <div className="fr-container fr-py-4w">
        <Alert
          severity="warning"
          title="Accès refusé"
          description="Seul l'examinateur initial peut approuver ou refuser cette demande."
        />
      </div>
    );
  }

  const alreadyTreated = request.status !== CarcasseModificationRequestStatus.PENDING;

  const onApprove = () => {
    setError(null);
    const approvalPayload =
      request.type === CarcasseModificationRequestType.NEW_CARCASSE
        ? {
            examinateur_anomalies_carcasse: sansAnomalie ? [] : splitAnomalies(examinateurAnomaliesCarcasseRaw),
            examinateur_anomalies_abats: sansAnomalie ? [] : splitAnomalies(examinateurAnomaliesAbatsRaw),
            examinateur_commentaire: examinateurCommentaire || null,
            examinateur_carcasse_sans_anomalie: sansAnomalie,
            examinateur_approbation_mise_sur_le_marche: approbationMiseSurLeMarche,
          }
        : undefined;
    updateCarcasseModifRequest(
      request.id,
      {
        status: CarcasseModificationRequestStatus.APPROVED,
        reviewed_by_user_id: user!.id,
        reviewed_at: dayjs().toDate(),
      },
      approvalPayload
    );
    navigate('/app/chasseur/demandes-de-modification');
  };

  const onReject = () => {
    setError(null);
    updateCarcasseModifRequest(request.id, {
      status: CarcasseModificationRequestStatus.REJECTED,
      reviewed_by_user_id: user!.id,
      reviewed_at: dayjs().toDate(),
      rejection_reason: rejectionReason || null,
    });
    navigate('/app/chasseur/demandes-de-modification');
  };

  return (
    <div className="fr-container fr-py-4w">
      <Link to="/app/chasseur/demandes-de-modification">← Retour à la liste</Link>
      <h1 className="mt-4">
        {request.type === CarcasseModificationRequestType.BRACELET_RENAME
          ? 'Changement de numéro de bracelet'
          : 'Signature d\'une carcasse ajoutée'}
      </h1>
      <p className="opacity-80">Fiche {request.fei_numero}</p>

      {alreadyTreated && (
        <Alert
          severity="info"
          title="Cette demande a déjà été traitée"
          description={`Statut : ${request.status}`}
        />
      )}

      {/* RENAME -------------------------------------------------------- */}
      {request.type === CarcasseModificationRequestType.BRACELET_RENAME && (
        <div className="rounded-sm border border-gray-300 p-4">
          <p className="mb-2">
            <span className="font-semibold">Numéro saisi initialement :</span> {request.numero_bracelet_before}
          </p>
          <p className="mb-2">
            <span className="font-semibold">Numéro proposé par l'intermédiaire :</span>{' '}
            <span className="font-bold">{request.numero_bracelet_after}</span>
          </p>
          {request.comment_intermediaire && (
            <p className="mb-0">
              <span className="font-semibold">Commentaire :</span> {request.comment_intermediaire}
            </p>
          )}
          <p className="mt-3 text-sm opacity-70">
            Demandée le {dayjs(request.requested_at).format('DD/MM/YYYY HH:mm')}
          </p>
        </div>
      )}

      {/* NEW CARCASSE -------------------------------------------------- */}
      {request.type === CarcasseModificationRequestType.NEW_CARCASSE && (
        <>
          <section className="rounded-sm border border-gray-300 p-4">
            <h2 className="fr-h5">Pré-remplissage par l'intermédiaire</h2>
            <ul className="m-0 list-none p-0 text-sm">
              <li>Numéro de bracelet : {carcasse.numero_bracelet}</li>
              <li>Espèce : {carcasse.espece}</li>
              <li>Type : {carcasse.type}</li>
              {carcasse.nombre_d_animaux && <li>Nombre d'animaux : {carcasse.nombre_d_animaux}</li>}
              {carcasse.heure_mise_a_mort && <li>Heure de mise à mort : {carcasse.heure_mise_a_mort}</li>}
              {carcasse.heure_evisceration && <li>Heure d'éviscération : {carcasse.heure_evisceration}</li>}
              {request.comment_intermediaire && (
                <li>Commentaire intermédiaire : {request.comment_intermediaire}</li>
              )}
            </ul>
          </section>

          {!alreadyTreated && (
            <section className="fr-mt-4w rounded-sm border border-blue-300 p-4">
              <h2 className="fr-h5">Votre examen initial</h2>
              <Checkbox
                options={[
                  {
                    label: 'Aucune anomalie constatée',
                    nativeInputProps: {
                      checked: sansAnomalie,
                      onChange: (e) => setSansAnomalie(e.currentTarget.checked),
                    },
                  },
                ]}
              />
              {!sansAnomalie && (
                <>
                  <Input
                    label="Anomalies carcasse (séparées par une virgule)"
                    nativeInputProps={{
                      value: examinateurAnomaliesCarcasseRaw,
                      onChange: (e) => setExaminateurAnomaliesCarcasseRaw(e.currentTarget.value),
                      placeholder: 'Ex. abcès, hématome, …',
                    }}
                  />
                  <Input
                    label="Anomalies abats (séparées par une virgule)"
                    nativeInputProps={{
                      value: examinateurAnomaliesAbatsRaw,
                      onChange: (e) => setExaminateurAnomaliesAbatsRaw(e.currentTarget.value),
                    }}
                  />
                </>
              )}
              <Input
                label="Commentaire (optionnel)"
                textArea
                nativeTextAreaProps={{
                  value: examinateurCommentaire,
                  onChange: (e) => setExaminateurCommentaire(e.currentTarget.value),
                  rows: 3,
                }}
              />
              <Checkbox
                options={[
                  {
                    label: 'J\'approuve la mise sur le marché de cette carcasse',
                    nativeInputProps: {
                      checked: approbationMiseSurLeMarche,
                      onChange: (e) => setApprobationMiseSurLeMarche(e.currentTarget.checked),
                    },
                  },
                ]}
              />
            </section>
          )}
        </>
      )}

      {!alreadyTreated && (
        <>
          {error && (
            <Alert
              severity="error"
              title="Erreur"
              description={error}
              className="mt-4"
            />
          )}
          <div className="fr-mt-4w flex flex-wrap gap-2">
            <Button
              priority="primary"
              onClick={onApprove}
            >
              {request.type === CarcasseModificationRequestType.NEW_CARCASSE
                ? "Signer et approuver l'examen"
                : 'Approuver le changement'}
            </Button>
          </div>
          <div className="fr-mt-4w rounded-sm border border-gray-200 p-3">
            <p className="mb-2 font-semibold">Refuser la demande</p>
            <Input
              label="Motif du refus (optionnel)"
              textArea
              nativeTextAreaProps={{
                value: rejectionReason,
                onChange: (e) => setRejectionReason(e.currentTarget.value),
                rows: 2,
              }}
            />
            <Button
              priority="tertiary"
              onClick={onReject}
              className="mt-2"
            >
              Refuser
            </Button>
            {request.type === CarcasseModificationRequestType.BRACELET_RENAME && (
              <p className="mt-2 text-sm opacity-70">
                Si vous refusez, l'intermédiaire pourra marquer la carcasse comme manquante depuis sa fiche.
              </p>
            )}
            {request.type === CarcasseModificationRequestType.NEW_CARCASSE && (
              <p className="mt-2 text-sm opacity-70">
                Si vous refusez, la carcasse pré-remplie sera supprimée.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
