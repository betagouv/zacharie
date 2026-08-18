import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
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
import Section from '@app/components/Section';
import { HistoriqueDesModifications } from '@app/components/CarcasseModificationRequest';
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

// Encadré blanc, même bloc visuel que les autres pages fiche/carcasse.
function Bloc({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['bg-white p-4 md:p-8', className].join(' ')}>
      {title && <h2 className="fr-h5 fr-mb-2w">{title}</h2>}
      {children}
    </div>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm opacity-60">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}

// Page de détail d'une demande. La modification est déjà appliquée : l'examinateur donne son avis.
// - RENAME : avant → après + confirmer ou contester.
// - NEW    : formulaire d'examen initial à remplir par l'examinateur + signature.
export default function ChasseurDemandeDeModificationDetail() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const user = useUser((state) => state.user);
  const modifRequestsByCarcasseId = useZustandStore((state) => state.modifRequestsByCarcasseId);
  const carcasses = useZustandStore((state) => state.carcasses);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
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
  const requestUser = request ? users[request.requested_by_user_id] : null;
  const entityLabel = requestEntity?.nom_d_usage?.trim() || "l'intermédiaire";

  // Hooks must run unconditionally
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>([]);
  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>([]);
  const [examinateurCommentaire, setExaminateurCommentaire] = useState('');
  const [sansAnomalie, setSansAnomalie] = useState(false);
  const [approbationMiseSurLeMarche, setApprobationMiseSurLeMarche] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  // Le désaccord est un chemin secondaire : on ne déplie son formulaire qu'à la demande.
  const [isRejecting, setIsRejecting] = useState(false);

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
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
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
        </div>
      </div>
    );
  }

  if (!carcasse) {
    return <p className="fr-container fr-py-4w">Chargement de la carcasse…</p>;
  }

  if (carcasse.examinateur_initial_user_id !== user?.id) {
    return (
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Alert
              severity="warning"
              title="Accès refusé"
              description="Seul l'examinateur initial de cette carcasse peut donner son avis sur cette demande."
            />
          </div>
        </div>
      </div>
    );
  }

  const alreadyTreated = request.status !== CarcasseModificationRequestStatus.PENDING;
  const isRename = request.type === CarcasseModificationRequestType.BRACELET_RENAME;
  const isApproved = request.status === CarcasseModificationRequestStatus.APPROVED;

  const onApprove = async () => {
    const approvalPayload = isRename
      ? undefined
      : {
          examinateur_anomalies_carcasse: sansAnomalie ? [] : anomaliesCarcasse,
          examinateur_anomalies_abats: sansAnomalie ? [] : anomaliesAbats,
          examinateur_commentaire: examinateurCommentaire || null,
          examinateur_carcasse_sans_anomalie: sansAnomalie,
          examinateur_approbation_mise_sur_le_marche: approbationMiseSurLeMarche,
        };
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
    updateCarcasseModifRequest(request.zacharie_carcasse_id, {
      status: CarcasseModificationRequestStatus.REJECTED,
      reviewed_by_user_id: user!.id,
      reviewed_at: dayjs().toDate(),
      rejection_reason: rejectionReason || null,
    });
    syncData('ChasseurDemandeDeModificationDetail onReject');
    navigate('/app/chasseur/demandes-de-modification');
  };

  const pageTitle = isRename ? 'Numéro de marquage corrigé' : "Examen initial d'une carcasse ajoutée";
  const ficheLabel = (() => {
    const datePart = fei?.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : null;
    const commune = fei?.commune_mise_a_mort?.trim();
    return datePart
      ? `Chasse du ${datePart}${commune ? ` à ${commune}` : ''}`
      : `Fiche ${request.fei_numero}`;
  })();
  const requesterName =
    [requestUser?.prenom, requestUser?.nom_de_famille].filter(Boolean).join(' ') || 'un intermédiaire';

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>{`${pageTitle} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-grid-row fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">{pageTitle}</h1>
          <Breadcrumb
            className="[&_a]:text-base!"
            currentPageLabel={pageTitle}
            segments={[
              {
                label: 'Demandes de modification',
                linkProps: {
                  to: '/app/chasseur/demandes-de-modification',
                  href: '#',
                },
              },
            ]}
          />
          <div className="fr-mb-2w flex flex-wrap items-center gap-3">
            {alreadyTreated ? (
              <Badge severity={isApproved ? 'success' : 'warning'}>
                {isApproved
                  ? isRename
                    ? 'Numéro confirmé'
                    : 'Examen signé'
                  : isRename
                    ? 'Numéro contesté'
                    : 'Carcasse refusée'}
              </Badge>
            ) : (
              <Badge
                severity="info"
                noIcon
              >
                Votre retour est facultatif
              </Badge>
            )}
            <span className="text-sm opacity-70">
              {ficheLabel} · carcasse {carcasse.numero_bracelet}
            </span>
          </div>

          <div className="flex flex-col gap-6">
            {!alreadyTreated && (
              <Alert
                className="bg-white"
                severity="info"
                title={isRename ? 'La correction est déjà appliquée' : 'La carcasse suit déjà son parcours'}
                description={
                  isRename
                    ? `Le numéro de marquage de cette carcasse est déjà « ${request.numero_bracelet_after} ». Votre retour est informatif : il ne bloque ni l'intermédiaire ni le SVI.`
                    : 'La carcasse a rejoint votre fiche et peut être inspectée par le SVI sans attendre. Il vous reste à signer son examen initial.'
                }
              />
            )}

            {/* Ce qui a changé -------------------------------------------- */}
            <Bloc title={isRename ? 'Ce qui a changé' : 'Carcasse pré-remplie'}>
              {isRename ? (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="w-full rounded-sm border border-gray-300 bg-gray-50 px-4 py-3 sm:w-auto">
                    <p className="mb-1 text-xs tracking-wide uppercase opacity-60">
                      Saisi à l'examen initial
                    </p>
                    <p className="mb-0 text-lg font-semibold line-through opacity-60">
                      {request.numero_bracelet_before}
                    </p>
                  </div>
                  <span
                    className="fr-icon-arrow-right-line self-center text-gray-500 max-sm:rotate-90"
                    aria-hidden="true"
                  />
                  <div className="w-full rounded-sm border-2 border-[#000091] bg-[#E8EDFF] px-4 py-3 sm:w-auto">
                    <p className="mb-1 text-xs tracking-wide text-[#000091] uppercase">
                      Relevé sur la carcasse · appliqué
                    </p>
                    <p className="mb-0 text-lg font-bold text-[#000091]">{request.numero_bracelet_after}</p>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <Definition
                    label="Numéro de marquage"
                    value={carcasse.numero_bracelet}
                  />
                  <Definition
                    label="Espèce"
                    value={carcasse.espece ?? 'Non renseignée'}
                  />
                  {!!carcasse.nombre_d_animaux && (
                    <Definition
                      label="Nombre d'animaux"
                      value={String(carcasse.nombre_d_animaux)}
                    />
                  )}
                  {!!carcasse.heure_mise_a_mort && (
                    <Definition
                      label="Heure de mise à mort"
                      value={carcasse.heure_mise_a_mort}
                    />
                  )}
                  {!!carcasse.heure_evisceration && (
                    <Definition
                      label="Heure d'éviscération"
                      value={carcasse.heure_evisceration}
                    />
                  )}
                </dl>
              )}

              <p className="fr-mt-3w mb-0 text-sm opacity-70">
                Signalé par {requesterName}
                {requestEntity?.nom_d_usage ? ` (${requestEntity.nom_d_usage})` : ''} le{' '}
                {dayjs(request.requested_at).format('DD/MM/YYYY à HH:mm')}
              </p>
              {request.comment_intermediaire && (
                <blockquote className="mt-3 mb-0 border-l-4 border-gray-300 pl-4">
                  <p className="mb-0 text-sm italic">« {request.comment_intermediaire} »</p>
                </blockquote>
              )}
            </Bloc>

            {/* Votre examen initial (NEW_CARCASSE) ------------------------- */}
            {!isRename && !alreadyTreated && (
              <Bloc title="Votre examen initial">
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
                    <div className="fr-mt-3w">
                      <h3 className="fr-h6 fr-mb-2w">Anomalies carcasse</h3>
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
                        <h3 className="fr-h6 fr-mb-2w">Anomalies abats</h3>
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
              </Bloc>
            )}

            {/* Votre retour ----------------------------------------------- */}
            {!alreadyTreated && (
              <Bloc title="Votre retour">
                {!isRejecting ? (
                  <>
                    <ButtonsGroup
                      inlineLayoutWhen="sm and up"
                      buttons={[
                        {
                          children: isRename ? 'Confirmer le numéro' : 'Enregistrer',
                          type: 'button',
                          nativeButtonProps: { onClick: onApprove },
                        },
                        {
                          children: isRename ? 'Contester le numéro' : 'Refuser la carcasse',
                          priority: 'secondary',
                          type: 'button',
                          nativeButtonProps: { onClick: () => setIsRejecting(true) },
                        },
                      ]}
                    />
                    <p className="fr-mt-2w mb-0 text-sm opacity-70">
                      {isRename
                        ? `Confirmer indique à ${entityLabel} que le numéro relevé est bon. Dans tous les cas, la carcasse continue son parcours.`
                        : "Votre signature complète l'examen initial de cette carcasse. Le SVI peut l'inspecter sans l'attendre."}
                    </p>
                  </>
                ) : (
                  <div className="border-l-4 border-[#b34000] pl-4">
                    <p className="mb-2 font-semibold">
                      {isRename ? 'Vous contestez ce numéro' : 'Vous refusez cette carcasse'}
                    </p>
                    <p className="mb-3 text-sm opacity-70">
                      {isRename
                        ? `Le numéro reste celui relevé par ${entityLabel}, qui a la carcasse sous les yeux. Votre désaccord lui est transmis : il pourra le vérifier, ou marquer la carcasse comme manquante depuis sa fiche.`
                        : "La carcasse pré-remplie sera supprimée — sauf si le SVI l'a déjà inspectée."}
                    </p>
                    <Input
                      label="Motif (optionnel)"
                      textArea
                      nativeTextAreaProps={{
                        value: rejectionReason,
                        onChange: (e) => setRejectionReason(e.currentTarget.value),
                        rows: 2,
                      }}
                    />
                    <ButtonsGroup
                      inlineLayoutWhen="sm and up"
                      buttons={[
                        {
                          children: isRename ? 'Envoyer ma contestation' : 'Confirmer le refus',
                          priority: 'secondary',
                          type: 'button',
                          nativeButtonProps: { onClick: onReject },
                        },
                        {
                          children: 'Annuler',
                          priority: 'tertiary no outline',
                          type: 'button',
                          nativeButtonProps: { onClick: () => setIsRejecting(false) },
                        },
                      ]}
                    />
                  </div>
                )}
              </Bloc>
            )}

            {alreadyTreated && (
              <Bloc title="Votre retour">
                <p className="mb-0">
                  {isApproved
                    ? isRename
                      ? 'Vous avez confirmé ce numéro de marquage.'
                      : "Vous avez signé l'examen initial de cette carcasse."
                    : isRename
                      ? 'Vous avez contesté ce numéro de marquage.'
                      : 'Vous avez refusé cette carcasse ajoutée.'}
                  {request.reviewed_at
                    ? ` Le ${dayjs(request.reviewed_at).format('DD/MM/YYYY à HH:mm')}.`
                    : ''}
                </p>
                {request.rejection_reason && (
                  <blockquote className="mt-3 mb-0 border-l-4 border-gray-300 pl-4">
                    <p className="mb-0 text-sm italic">« {request.rejection_reason} »</p>
                  </blockquote>
                )}
              </Bloc>
            )}

            <Section
              title="Historique des modifications"
              open={false}
            >
              <HistoriqueDesModifications carcasse={carcasse} />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
