import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import {
  CarcasseType,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import useUser from '@app/zustand/user';
import InputMultiSelect from '@app/components/InputMultiSelect';
import ModalTreeDisplay from '@app/components/ModalTreeDisplay';
import grandGibierCarcasseList from '@app/data/grand-gibier-carcasse/list.json';
import grandGibierCarcasseTree from '@app/data/grand-gibier-carcasse/tree.json';
import petitGibierCarcasseList from '@app/data/petit-gibier-carcasse/list.json';
import petitGibierCarcasseTree from '@app/data/petit-gibier-carcasse/tree.json';
import grandGibierAbatsList from '@app/data/grand-gibier-abats/list.json';
import grandGibierAbatstree from '@app/data/grand-gibier-abats/tree.json';

const anomaliesCarcasseModal = createModal({
  isOpenedByDefault: false,
  id: 'modif-anomalies-carcasse-modal',
});
const anomaliesAbatsModal = createModal({
  isOpenedByDefault: false,
  id: 'modif-anomalies-abats-modal',
});

// Page de détail d'une demande, pour approuver ou refuser.
// - RENAME : confirmation avant/après + boutons.
// - NEW    : formulaire d'examen initial à remplir par l'examinateur + signature.
export default function ChasseurDemandeDeModificationDetail() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const user = useUser((state) => state.user);
  const modifRequestsByCarcasseId = useZustandStore((state) => state.modifRequestsByCarcasseId);
  const carcasses = useZustandStore((state) => state.carcasses);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const updateCarcasseModifRequest = useZustandStore((state) => state.updateCarcasseModifRequest);

  const request = useMemo(() => {
    const request = Object.values(modifRequestsByCarcasseId)
      .flat()
      .find((r) => r.id === request_id);
    return request || null;
  }, [modifRequestsByCarcasseId, request_id]);
  const carcasse = request ? carcasses[request.zacharie_carcasse_id] : null;
  const fei = request ? feis[request.fei_numero] : null;
  const requestEntity = request ? entities[request.requested_by_entity_id] : null;
  const entityLabel = requestEntity?.nom_d_usage?.trim() || "l'intermédiaire";

  // Hooks must run unconditionally
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>([]);
  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>([]);
  const [examinateurCommentaire, setExaminateurCommentaire] = useState('');
  const [sansAnomalie, setSansAnomalie] = useState(false);
  const [approbationMiseSurLeMarche, setApprobationMiseSurLeMarche] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPetitGibier = carcasse?.type === CarcasseType.PETIT_GIBIER;
  const referentielAnomaliesCarcasseList = isPetitGibier ? petitGibierCarcasseList : grandGibierCarcasseList;
  const referentielAnomaliesCarcasseTree = isPetitGibier ? petitGibierCarcasseTree : grandGibierCarcasseTree;

  const atLeastOneCarcasseWithAnomalie = anomaliesCarcasse.length > 0 || anomaliesAbats.length > 0;

  const checkboxLabel = useMemo(() => {
    let label = '';

    label = `Je, ${user?.nom_de_famille} ${user?.prenom}, certifie`;
    if (!atLeastOneCarcasseWithAnomalie) {
      label +=
        " qu'aucune anomalie n'a été observée lors de l'examen initial et que les carcasses en peau examinées ce jour peuvent être mises sur le marché.";
    } else {
      label +=
        ' que les carcasses en peau examinées ce jour présentent au moins une anomalie. Toutefois, elles peuvent être mises sur le marché.';
    }
    return label;
  }, [atLeastOneCarcasseWithAnomalie, user]);

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

  const onApprove = async () => {
    setError(null);
    const approvalPayload =
      request.type === CarcasseModificationRequestType.NEW_CARCASSE
        ? {
            examinateur_anomalies_carcasse: sansAnomalie ? [] : anomaliesCarcasse,
            examinateur_anomalies_abats: sansAnomalie ? [] : anomaliesAbats,
            examinateur_commentaire: examinateurCommentaire || null,
            examinateur_carcasse_sans_anomalie: sansAnomalie,
            examinateur_approbation_mise_sur_le_marche: approbationMiseSurLeMarche,
          }
        : undefined;
    updateCarcasseModifRequest(
      request.zacharie_carcasse_id,
      {
        status: CarcasseModificationRequestStatus.APPROVED,
        reviewed_by_user_id: user!.id,
        reviewed_at: dayjs().toDate(),
      },
      approvalPayload
    );
    await syncData('ChasseurDemandeDeModificationDetail onApprove');
    navigate('/app/chasseur/demandes-de-modification');
  };

  const onReject = () => {
    setError(null);
    updateCarcasseModifRequest(request.zacharie_carcasse_id, {
      status: CarcasseModificationRequestStatus.REJECTED,
      reviewed_by_user_id: user!.id,
      reviewed_at: dayjs().toDate(),
      rejection_reason: rejectionReason || null,
    });
    syncData('ChasseurDemandeDeModificationDetail onReject');
    navigate('/app/chasseur/demandes-de-modification');
  };

  const pageTitle =
    request.type === CarcasseModificationRequestType.BRACELET_RENAME
      ? 'Changement de numéro de marquage'
      : "Examen initial d'une carcasse ajoutée";

  return (
    <div className="fr-container fr-py-4w">
      <title>{`${pageTitle} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <Link to="/app/chasseur/demandes-de-modification">← Retour à la liste</Link>
      <h1 className="mt-4">{pageTitle}</h1>
      <p className="opacity-80">
        {(() => {
          const datePart = fei?.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM') : null;
          const commune = fei?.commune_mise_a_mort?.trim();
          return datePart
            ? `Fiche du ${datePart}${commune ? ` - ${commune}` : ''}`
            : `Fiche ${request.fei_numero}`;
        })()}
      </p>

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
            <span className="font-semibold">Numéro saisi initialement :</span>{' '}
            {request.numero_bracelet_before}
          </p>
          <p className="mb-2">
            <span className="font-semibold">Numéro proposé par {entityLabel} :</span>{' '}
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
            <h2 className="fr-h5">Pré-remplissage par {entityLabel}</h2>
            <ul className="m-0 list-none p-0 text-sm">
              <li>Numéro de marquage : {carcasse.numero_bracelet}</li>
              <li>Espèce : {carcasse.espece}</li>
              {carcasse.nombre_d_animaux && <li>Nombre d'animaux : {carcasse.nombre_d_animaux}</li>}
              {carcasse.heure_mise_a_mort && <li>Heure de mise à mort : {carcasse.heure_mise_a_mort}</li>}
              {carcasse.heure_evisceration && <li>Heure d'éviscération : {carcasse.heure_evisceration}</li>}
              {request.comment_intermediaire && (
                <li>
                  Commentaire de {entityLabel} : {request.comment_intermediaire}
                </li>
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
                className="mb-4"
              />
              {!sansAnomalie && (
                <>
                  <div className="fr-mt-3w">
                    <h3 className="fr-h5 fr-mb-2w">Anomalies carcasse</h3>
                    <InputMultiSelect
                      data={referentielAnomaliesCarcasseList}
                      label="Ajouter une nouvelle anomalie"
                      name="modif-anomalie-carcasse"
                      canEdit
                      creatable
                      placeholder="Tapez une anomalie carcasse"
                      onChange={(values) => setAnomaliesCarcasse(values)}
                      values={anomaliesCarcasse}
                    />
                    <Button
                      priority="secondary"
                      type="button"
                      onClick={() => anomaliesCarcasseModal.open()}
                    >
                      Ajouter depuis le référentiel des anomalies carcasse
                    </Button>
                    <ModalTreeDisplay
                      data={referentielAnomaliesCarcasseTree}
                      modal={anomaliesCarcasseModal}
                      title="Anomalies carcasse"
                      onItemClick={(newAnomalie) => {
                        const next = [...anomaliesCarcasse, newAnomalie].filter(Boolean);
                        setAnomaliesCarcasse(next);
                      }}
                    />
                  </div>

                  {carcasse.type === CarcasseType.GROS_GIBIER && (
                    <div className="fr-mt-3w">
                      <h3 className="fr-h5 fr-mb-2w">Anomalies abats</h3>
                      <InputMultiSelect
                        data={grandGibierAbatsList}
                        label="Ajouter une nouvelle anomalie"
                        name="modif-anomalie-abats"
                        canEdit
                        creatable
                        placeholder="Tapez une anomalie abats"
                        onChange={(values) => setAnomaliesAbats(values)}
                        values={anomaliesAbats}
                      />
                      <Button
                        priority="secondary"
                        type="button"
                        onClick={() => anomaliesAbatsModal.open()}
                      >
                        Ajouter depuis le référentiel des anomalies abats
                      </Button>
                      <ModalTreeDisplay
                        data={grandGibierAbatstree}
                        modal={anomaliesAbatsModal}
                        title="Anomalies abats"
                        onItemClick={(newAnomalie) => {
                          const next = [...anomaliesAbats, newAnomalie].filter(Boolean);
                          setAnomaliesAbats(next);
                        }}
                      />
                    </div>
                  )}
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
                className="fr-mt-3w"
              />
              <Checkbox
                options={[
                  {
                    label: checkboxLabel,
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
                ? 'Enregistrer'
                : 'Approuver le changement'}
            </Button>
          </div>
          <div className="fr-mt-4w rounded-sm border border-gray-200 bg-white p-3">
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
                Si vous refusez, {entityLabel} pourra marquer la carcasse comme manquante depuis sa fiche.
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
