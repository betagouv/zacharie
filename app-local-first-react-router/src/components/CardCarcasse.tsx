import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import useUser from '@app/zustand/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import {
  Carcasse,
  CarcasseStatus,
  CarcasseType,
  DepotType,
  FeiOwnerRole,
  IPM1Decision,
  IPM2Decision,
  PoidsType,
  UserRoles,
} from '@prisma/client';
import dayjs from 'dayjs';
import { useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import ItemNotEditable from './ItemNotEditable';
import { useIsCircuitCourt } from '@app/utils/circuit-court';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';

interface CardCarcasseProps {
  carcasse: Carcasse;
  className?: string;
  hideDateMiseAMort?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  forceRefus?: boolean;
  forceManquante?: boolean;
  forceAccept?: boolean;
}

export default function CardCarcasse({
  carcasse,
  className,
  hideDateMiseAMort,
  onEdit,
  onDelete,
  onClick,
  forceRefus,
  forceManquante,
  forceAccept,
}: CardCarcasseProps) {
  const cacasseModal = useRef(
    createModal({
      id: `carcasse-modal-${carcasse.zacharie_carcasse_id}`,
      isOpenedByDefault: false,
    }),
  ).current;

  const isCarcasseModalOpen = useIsModalOpen(cacasseModal);

  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const latestIntermediaire = carcassesIntermediaires[0];
  const entities = useZustandStore((state) => state.entities);
  const user = useUser((state) => state.user)!;
  const viewRole: CardViewRole = user.roles.includes(UserRoles.SVI)
    ? 'svi'
    : user.roles.includes(UserRoles.ETG) || user.roles.includes(UserRoles.COLLECTEUR_PRO)
      ? 'etg-coll'
      : 'chasseur';

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _carcasseIntermediaire of carcassesIntermediaires) {
      if (_carcasseIntermediaire?.commentaire) {
        const _intermediaireEntity = entities[_carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(
          `Commentaire de ${_intermediaireEntity?.nom_d_usage}\u00A0: ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  const { statusNewCard, motifRefus } = useCarcasseStatusAndRefus(carcasse, fei);

  let miseAMort = '';
  if (!hideDateMiseAMort) {
    miseAMort += `Mise à mort\u00A0: ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
    if (carcasse.heure_mise_a_mort) {
      miseAMort += ` à ${carcasse.heure_mise_a_mort}`;
    }
  }

  let anomaliesExaminateurs =
    carcasse.examinateur_anomalies_abats?.length + carcasse.examinateur_anomalies_carcasse?.length;
  let descriptionLine = '';
  if (anomaliesExaminateurs) {
    descriptionLine = `${anomaliesExaminateurs} anomalie`;
    if (anomaliesExaminateurs > 1) descriptionLine += 's';
  }
  if (commentairesIntermediaires.length > 0) {
    if (descriptionLine.length > 0) descriptionLine += `, `;
    descriptionLine += `${commentairesIntermediaires.length} commentaire`;
    if (commentairesIntermediaires.length > 1) descriptionLine += 's';
  }

  const cardDisplay = getCarcasseCardDisplay({
    carcasse,
    fei,
    latestIntermediaire,
    entities,
    viewRole,
    forceRefus,
    forceManquante,
    forceAccept,
  });

  const isEcarteePourInspection =
    !!latestIntermediaire?.ecarte_pour_inspection &&
    (cardDisplay.uiState === 'transmise' || cardDisplay.uiState === 'acceptee-etg');

  const accentBorderClass = (() => {
    if (isEcarteePourInspection) return 'border-error-main-525 border-l-3';
    switch (cardDisplay.accentColor) {
      case 'red':
        return 'border-error-main-525 border-l-3';
      case 'blue':
        return 'border-action-high-blue-france border-l-3';
      case 'orange':
        return 'border-warning-main-525 border-l-3';
      default:
        return '';
    }
  })();

  const accentTextClass = (() => {
    if (isEcarteePourInspection) return 'text-error-main-525';
    switch (cardDisplay.accentColor) {
      case 'red':
        return 'text-error-main-525';
      case 'blue':
        return 'text-action-high-blue-france';
      case 'orange':
        return 'text-warning-main-525';
      case 'gray':
        return 'text-gray-600';
      default:
        return '';
    }
  })();

  const statusLabel = isEcarteePourInspection ? 'Écarté pour inspection' : cardDisplay.statusLabel;
  const statusIconId = isEcarteePourInspection ? 'fr-icon-alert-line' : cardDisplay.iconId;
  const showStatusLine = isEcarteePourInspection || cardDisplay.showStatusLine;
  const isBlockingState =
    cardDisplay.uiState === 'refusee-etg' ||
    cardDisplay.uiState === 'manquante-etg' ||
    cardDisplay.uiState === 'manquante-svi' ||
    cardDisplay.uiState === 'saisie-totale';

  const nombreDAnimaux = carcasse.nombre_d_animaux ?? 0;
  const nombreDAnimauxAcceptes = latestIntermediaire?.nombre_d_animaux_acceptes ?? 0;
  const nombreDAnimauxDisplay =
    CarcasseType.PETIT_GIBIER === carcasse.type
      ? nombreDAnimaux > 1 && nombreDAnimauxAcceptes > 0
        ? `(${nombreDAnimauxAcceptes} sur ${nombreDAnimaux})`
        : `(${nombreDAnimaux})`
      : '';

  return (
    <>
      <div
        className={[
          'flex basis-full flex-row items-center justify-between border-solid border-1 border-transparent hover:border-gray-300! text-left',
          'bg-contrast-grey border-0',
          accentBorderClass,
          className || '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          className="flex flex-1 flex-row items-center gap-3 border-none p-4 text-left hover:bg-transparent"
          type="button"
          onClick={onClick ? onClick : cacasseModal.open}
        >
          {statusIconId && (
            <span
              className={[statusIconId, 'shrink-0 text-2xl', accentTextClass]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            />
          )}
          <div className="flex flex-1 flex-col">
            <p className="text-base font-bold">
              {carcasse.espece} {nombreDAnimauxDisplay}
            </p>
            <p className="text-sm/4 font-bold">N° {carcasse.numero_bracelet}</p>
            {miseAMort && <p className="text-sm/4">{miseAMort}</p>}
            {showStatusLine && statusLabel && (
              <p
                className={[
                  'text-sm/4 font-bold first-letter:uppercase',
                  accentTextClass,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {statusLabel}
              </p>
            )}
            {descriptionLine && (
              <p
                className={['text-sm/4', accentTextClass].filter(Boolean).join(' ')}
              >
                {descriptionLine}
              </p>
            )}
          </div>
        </button>
        {(onEdit || onDelete) && (
          <div className="flex flex-row gap-2 pr-4">
            {onEdit && (
              <Button
                type="button"
                iconId="fr-icon-pencil-line"
                onClick={onEdit}
                title="Éditer la carcasse"
                priority="tertiary no outline"
              />
            )}
            {onDelete && !isBlockingState && (
              <Button
                type="button"
                iconId="fr-icon-delete-bin-line"
                onClick={onDelete}
                title="Supprimer la carcasse"
                priority="tertiary no outline"
              />
            )}
          </div>
        )}
      </div>

      <cacasseModal.Component
        size="large"
        title={`${carcasse.espece} - N° ${carcasse.numero_bracelet}`}
        buttons={[
          {
            children: 'Fermer',
            onClick: () => cacasseModal.close(),
          },
        ]}
      >
        {isCarcasseModalOpen && (
          <CarcasseDetails
            carcasseId={carcasse.zacharie_carcasse_id}
            statusNewCard={statusNewCard}
            motifRefus={motifRefus}
          />
        )}
      </cacasseModal.Component>
    </>
  );
}

function CarcasseDetails({
  carcasseId,
  statusNewCard,
  motifRefus,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
  statusNewCard: string;
  motifRefus: string;
}) {
  const user = useUser((state) => state.user)!;
  const isCircuitCourt = useIsCircuitCourt();
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const carcasses = useZustandStore((state) => state.carcasses);
  const fei = feis[params.fei_numero!];
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasseId);
  const latestIntermediaire = carcassesIntermediaires[0];

  const carcasse = carcasses[carcasseId!];

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcasseIntermediaire of carcassesIntermediaires) {
      if (carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = entities[carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage}\u00A0: ${carcasseIntermediaire?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id!] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id!]
    : null;

  const onlyPetitGibier = useMemo(() => {
    if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
      return false;
    }
    return true;
  }, [carcasse]);

  const examinateurInitialInput = useMemo(() => {
    const lines = [];
    lines.push(`${examinateurInitialUser?.prenom} ${examinateurInitialUser?.nom_de_famille}`);
    lines.push(examinateurInitialUser?.telephone);
    lines.push(examinateurInitialUser?.email);
    lines.push(examinateurInitialUser?.numero_cfei);
    lines.push(`${examinateurInitialUser?.code_postal} ${examinateurInitialUser?.ville}`);
    return lines;
  }, [examinateurInitialUser]);

  const premierDetenteurInput = useMemo(() => {
    const lines = [];
    if (premierDetenteurEntity) {
      lines.push(premierDetenteurEntity.nom_d_usage);
      lines.push(premierDetenteurEntity.siret);
      lines.push(`${premierDetenteurEntity.code_postal} ${premierDetenteurEntity.ville}`);
      return lines;
    }
    lines.push(`${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`);
    lines.push(premierDetenteurUser?.telephone);
    lines.push(premierDetenteurUser?.email);
    lines.push(premierDetenteurUser?.numero_cfei);
    lines.push(`${premierDetenteurUser?.code_postal} ${premierDetenteurUser?.ville}`);
    return lines;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const intermediairesInputs = useMemo(() => {
    const lines = [];
    let collecteurs = 0;
    for (const carcasseIntermediaire of carcassesIntermediaires) {
      const intermediaireLines = [];
      const isCollecteur = carcasseIntermediaire.intermediaire_role === UserRoles.COLLECTEUR_PRO;
      const label = isCollecteur
        ? `Collecteur ${collecteurs + 1}`
        : 'Établissement de Traitement du Gibier Sauvage';
      const entity = entities[carcasseIntermediaire.intermediaire_entity_id!];
      intermediaireLines.push(entity.nom_d_usage);
      intermediaireLines.push(entity.siret);
      intermediaireLines.push(`${entity.code_postal} ${entity.ville}`);
      lines.push({ label, value: intermediaireLines });
    }
    return lines;
  }, [carcassesIntermediaires, entities]);

  const ccgDate =
    fei.premier_detenteur_depot_type === DepotType.CCG
      ? dayjs(fei.premier_detenteur_depot_ccg_at).format('dddd D MMMM YYYY à HH:mm')
      : null;
  const etgDate = latestIntermediaire
    ? dayjs(latestIntermediaire.prise_en_charge_at || latestIntermediaire.decision_at).format(
      'dddd D MMMM YYYY à HH:mm',
    )
    : null;

  const sviAssignedToFeiAt = carcasse.svi_assigned_to_fei_at
    ? dayjs(carcasse.svi_assigned_to_fei_at).format('dddd D MMMM YYYY à HH:mm')
    : null;

  const milestones = useMemo(() => {
    const _milestones = [
      `Commune de mise à mort\u00A0: ${fei?.commune_mise_a_mort ?? ''}`,
      `Date de mise à mort\u00A0: ${dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY')}`,
    ];
    if (carcasse.heure_mise_a_mort_premiere_carcasse_fei) {
      _milestones.push(
        `Heure de mise à mort de la première carcasse de la fiche\u00A0: ${carcasse.heure_mise_a_mort_premiere_carcasse_fei}`,
      );
    }
    if (onlyPetitGibier && carcasse.heure_evisceration_derniere_carcasse_fei) {
      _milestones.push(
        `Heure d'éviscération de la dernière carcasse de la fiche\u00A0: ${carcasse.heure_evisceration_derniere_carcasse_fei}`,
      );
    }
    if (ccgDate) _milestones.push(`Date et heure de dépôt dans le CCG\u00A0: ${ccgDate}`);
    if (etgDate) _milestones.push(`Date et heure de prise en charge par l'ETG\u00A0: ${etgDate}`);
    if (sviAssignedToFeiAt)
      _milestones.push(`Date et heure d'assignation au SVI\u00A0: ${sviAssignedToFeiAt}`);
    if (statusNewCard.includes('manquant')) {
      _milestones.push(motifRefus);
    }
    // if (carcasse.svi_ipm1_date) _milestones.push(`Date de l'inspection\u00A0: ${dayjs(carcasse.svi_ipm1_date).format('dddd D MMMM YYYY')}`);
    if (carcasse.svi_ipm2_date)
      _milestones.push(
        `Date de l'inspection du service vétérinaire\u00A0: ${dayjs(carcasse.svi_ipm2_date).format('dddd D MMMM YYYY')}`,
      );
    return _milestones;
  }, [
    fei?.commune_mise_a_mort,
    fei.date_mise_a_mort,
    carcasse.heure_mise_a_mort_premiere_carcasse_fei,
    carcasse.heure_evisceration_derniere_carcasse_fei,
    onlyPetitGibier,
    ccgDate,
    etgDate,
    statusNewCard,
    carcasse.svi_ipm2_date,
    motifRefus,
    sviAssignedToFeiAt,
  ]);

  const ipm1 = useMemo(() => {
    if (!carcasse.svi_ipm1_date) return [];
    const imp1Lines = [];
    imp1Lines.push(`Date de l'inspection\u00A0: ${dayjs(carcasse.svi_ipm1_date).format('dddd D MMMM YYYY')}`);
    if (!carcasse.svi_ipm1_presentee_inspection) {
      imp1Lines.push('Carcasse manquante');
      return imp1Lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      imp1Lines.push(`Nombre d'animaux\u00A0: ${carcasse.svi_ipm1_nombre_animaux}`);
    }
    if (carcasse.svi_ipm1_commentaire) {
      imp1Lines.push(`Commentaire de l'inspection\u00A0: ${carcasse.svi_ipm1_commentaire}`);
    }
    if (carcasse.svi_ipm1_pieces.length) {
      imp1Lines.push(
        <>
          <p className="with-marker">Pièces observées&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm1_pieces.map((piece, index) => {
              return <li key={index}>{piece}</li>;
            })}
          </ul>
        </>,
      );
    }
    if (carcasse.svi_ipm1_lesions_ou_motifs.length) {
      imp1Lines.push(
        <>
          <p className="with-marker">Lésions ou motifs de consigne&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm1_lesions_ou_motifs.map((type, index) => {
              return <li key={index}>{type}</li>;
            })}
          </ul>
        </>,
      );
    }
    switch (carcasse.svi_ipm1_decision) {
      case IPM1Decision.NON_RENSEIGNEE:
        imp1Lines.push(`Non renseigné`);
        break;
      case IPM1Decision.ACCEPTE:
        imp1Lines.push(`Décision\u00A0: Acceptée`);
        break;
      case IPM1Decision.MISE_EN_CONSIGNE:
        imp1Lines.push(`Décision\u00A0: Mise en consigne`);
        break;
    }
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE) {
      imp1Lines.push(`Durée de la consigne\u00A0: ${carcasse.svi_ipm1_duree_consigne} heures`);
    }
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE && carcasse.svi_ipm1_poids_consigne) {
      imp1Lines.push(`Poids de la consigne\u00A0: ${carcasse.svi_ipm1_poids_consigne}kg`);
    }
    return imp1Lines;
  }, [carcasse]);

  const showIpm1AndIpm2 = useMemo(() => {
    return user.roles.includes(UserRoles.SVI) || user.roles.includes(UserRoles.ETG);
  }, [user.roles]);

  const ipm2 = useMemo(() => {
    if (!carcasse.svi_ipm2_date) return [];
    const imp2Lines = [];
    imp2Lines.push(`Date de l'inspection\u00A0: ${dayjs(carcasse.svi_ipm2_date).format('dddd D MMMM YYYY')}`);
    if (!carcasse.svi_ipm2_presentee_inspection) {
      imp2Lines.push('Carcasse manquante');
      return imp2Lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      imp2Lines.push(`Nombre d'animaux\u00A0: ${carcasse.svi_ipm2_nombre_animaux}`);
    }
    if (carcasse.svi_ipm2_commentaire) {
      imp2Lines.push(`Commentaire de l'inspection\u00A0: ${carcasse.svi_ipm2_commentaire}`);
    }
    if (carcasse.svi_ipm2_pieces.length) {
      imp2Lines.push(
        <>
          <p className="with-marker">Pièces observées&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm2_pieces.map((piece, index) => {
              return <li key={index}>{piece}</li>;
            })}
          </ul>
        </>,
      );
    }
    if (carcasse.svi_ipm2_lesions_ou_motifs.length) {
      imp2Lines.push(
        <>
          <p className="with-marker">Lésions ou motifs de consigne&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm2_lesions_ou_motifs.map((type, index) => {
              return <li key={index}>{type}</li>;
            })}
          </ul>
        </>,
      );
    }
    switch (carcasse.svi_ipm2_decision) {
      case IPM2Decision.NON_RENSEIGNEE:
        imp2Lines.push(`Pas de saisie`);
        break;
      case IPM2Decision.LEVEE_DE_LA_CONSIGNE:
        imp2Lines.push(`Décision\u00A0: Levée de la consigne, pas de saisie`);
        break;
      case IPM2Decision.SAISIE_TOTALE:
        imp2Lines.push(`Décision\u00A0: Saisie totale`);
        break;
      case IPM2Decision.SAISIE_PARTIELLE:
        imp2Lines.push(`Décision IPM2\u00A0: Saisie partielle`);
        break;
      case IPM2Decision.TRAITEMENT_ASSAINISSANT:
        imp2Lines.push(`Décision IPM2\u00A0: Traitement assainissant`);
        break;
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temps) {
      imp2Lines.push(`Temps de cuisson\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temp) {
      imp2Lines.push(
        `Température de cuisson\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temps) {
      imp2Lines.push(
        `Temps de congélation\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_congelation_temps}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temp) {
      imp2Lines.push(
        `Température de congélation\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_congelation_temp}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_type) {
      imp2Lines.push(`Type de traitement\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_type}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_paramètres) {
      imp2Lines.push(`Paramètres\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_paramètres}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_etablissement) {
      imp2Lines.push(
        `Établissement désigné pour réaliser le traitement assainissant\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_etablissement}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_poids) {
      imp2Lines.push(`Poids\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_poids}`);
    }
    if (carcasse.svi_ipm2_poids_saisie) {
      let poids = `Poids\u00A0: ${carcasse.svi_ipm2_poids_saisie}`;
      if (carcasse.svi_ipm2_poids_type === PoidsType.DEPOUILLE) poids += ' (dépouillée/plumée)';
      if (carcasse.svi_ipm2_poids_type === PoidsType.NON_DEPOUILLE) poids += ' (non dépouillée/non plumée)';
      imp2Lines.push(poids);
    }
    return imp2Lines;
  }, [carcasse]);

  return (
    <>
      <hr className="mt-4 bg-none" />
      <ItemNotEditable label="Informations clés" value={milestones} withDiscs />
      {carcasse.examinateur_anomalies_abats?.length > 0 && (
        <ItemNotEditable label="Anomalies abats" value={carcasse.examinateur_anomalies_abats} withDiscs />
      )}
      {carcasse.examinateur_anomalies_carcasse?.length > 0 && (
        <ItemNotEditable
          label="Anomalies carcasse"
          value={carcasse.examinateur_anomalies_carcasse}
          withDiscs
        />
      )}
      {statusNewCard.includes('refus') && motifRefus && (
        <ItemNotEditable
          label={motifRefus.split(':')[0]}
          value={motifRefus.split(':')[1] || "Aucun motif de refus n'a été renseigné"}
          withDiscs
        />
      )}
      {commentairesIntermediaires.length > 0 && (
        <ItemNotEditable
          label="Commentaires des intermédiaires"
          value={commentairesIntermediaires}
          withDiscs
        />
      )}
      {showIpm1AndIpm2 ? (
        <>
          <ItemNotEditable
            label="Inspection Post-Mortem 1"
            value={carcasse.svi_ipm1_date ? ipm1 : 'N/A'}
            withDiscs
          />
          <ItemNotEditable
            label="Inspection Post-Mortem 2"
            value={carcasse.svi_ipm2_date ? ipm2 : 'N/A'}
            withDiscs
          />
        </>
      ) : isCircuitCourt ? null : (
        <>
          <ItemNotEditable
            label="Inspection du Service Vétérinaire"
            value={carcasse.svi_ipm2_date ? ipm2 : 'N/A'}
            withDiscs
          />
        </>
      )}
      <hr className="my-4" />
      <h2 className="mb-4 ml-2 text-lg font-semibold text-gray-900">Acteurs de la chasse</h2>
      <ItemNotEditable label="Examinateur Initial" value={examinateurInitialInput} />
      <ItemNotEditable label="Premier Détenteur" value={premierDetenteurInput} />
      {intermediairesInputs.map((intermediaireInput, index) => {
        return (
          <ItemNotEditable key={index} label={intermediaireInput.label} value={intermediaireInput.value} />
        );
      })}
    </>
  );
}

type CardViewRole = 'chasseur' | 'etg-coll' | 'svi';
type CardUiState =
  | 'creation'
  | 'transmise'
  | 'manquante-etg'
  | 'refusee-etg'
  | 'acceptee-etg'
  | 'manquante-svi'
  | 'mise-en-consigne'
  | 'saisie-partielle'
  | 'saisie-totale'
  | 'accepte-svi';
type CardAccent = 'red' | 'blue' | 'orange' | 'gray' | null;

interface CardDisplay {
  uiState: CardUiState;
  iconId: string | null;
  accentColor: CardAccent;
  statusLabel: string | null;
  showStatusLine: boolean;
}

interface CardDisplayParams {
  carcasse: Carcasse;
  fei: ReturnType<typeof useZustandStore.getState>['feis'][string];
  latestIntermediaire: ReturnType<typeof useCarcassesIntermediairesForCarcasse>[number] | undefined;
  entities: ReturnType<typeof useZustandStore.getState>['entities'];
  viewRole: CardViewRole;
  forceRefus?: boolean;
  forceManquante?: boolean;
  forceAccept?: boolean;
}

function deriveCarcasseUiState(
  carcasse: Carcasse,
  fei: CardDisplayParams['fei'],
  latestIntermediaire: CardDisplayParams['latestIntermediaire'],
  overrides: { forceRefus?: boolean; forceManquante?: boolean; forceAccept?: boolean },
): CardUiState {
  if (!carcasse.svi_ipm1_date && !carcasse.svi_ipm2_date) {
    if (overrides.forceRefus) return 'refusee-etg';
    if (overrides.forceManquante) return 'manquante-etg';
    if (overrides.forceAccept) return 'acceptee-etg';
  }

  const status = carcasse.svi_carcasse_status ?? CarcasseStatus.SANS_DECISION;

  switch (status) {
    case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
      return 'manquante-etg';
    case CarcasseStatus.REFUS_ETG_COLLECTEUR:
      return 'refusee-etg';
    case CarcasseStatus.MANQUANTE_SVI:
      return 'manquante-svi';
    case CarcasseStatus.SAISIE_TOTALE:
      return 'saisie-totale';
    case CarcasseStatus.SAISIE_PARTIELLE:
      return 'saisie-partielle';
    case CarcasseStatus.CONSIGNE:
      return 'mise-en-consigne';
    case CarcasseStatus.ACCEPTE:
    case CarcasseStatus.LEVEE_DE_CONSIGNE:
    case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
      return 'accepte-svi';
    case CarcasseStatus.SANS_DECISION: {
      const isCreation =
        (fei?.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL ||
          fei?.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) &&
        !fei?.fei_next_owner_role;
      if (isCreation) return 'creation';
      if (
        latestIntermediaire?.decision_at &&
        latestIntermediaire?.intermediaire_role === FeiOwnerRole.ETG
      ) {
        return 'acceptee-etg';
      }
      return 'transmise';
    }
    default: {
      // Exhaustiveness check — adding a new CarcasseStatus enum value breaks the build
      // here until the case is wired. Runtime fallback = transmise (carte nue).
      const _exhaustive: never = status;
      void _exhaustive;
      return 'transmise';
    }
  }
}

function getCarcasseCardDisplay(params: CardDisplayParams): CardDisplay {
  const {
    carcasse,
    fei,
    latestIntermediaire,
    entities,
    viewRole,
    forceRefus,
    forceManquante,
    forceAccept,
  } = params;

  const uiState = deriveCarcasseUiState(carcasse, fei, latestIntermediaire, {
    forceRefus,
    forceManquante,
    forceAccept,
  });

  const isPetitGibier = carcasse.type === CarcasseType.PETIT_GIBIER;
  const manquantWord = isPetitGibier ? 'Manquant' : 'Manquante';
  const refuseWord = isPetitGibier ? 'Refusé' : 'Refusée';
  const accepteWord = isPetitGibier ? 'Accepté' : 'Acceptée';

  const intermediaireEntity = latestIntermediaire?.intermediaire_entity_id
    ? entities[latestIntermediaire.intermediaire_entity_id]
    : null;
  const intermediaireName = intermediaireEntity?.nom_d_usage ?? '';

  if (viewRole === 'chasseur') {
    if (uiState === 'creation') {
      return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
    }
    if (uiState === 'transmise' || uiState === 'acceptee-etg' || uiState === 'mise-en-consigne') {
      return {
        uiState,
        iconId: 'fr-icon-refresh-line',
        accentColor: 'gray',
        statusLabel: 'En cours de traitement',
        showStatusLine: true,
      };
    }
    if (uiState === 'saisie-partielle') {
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: `${accepteWord} partiellement par le service vétérinaire`,
        showStatusLine: true,
      };
    }
    if (uiState === 'saisie-totale') {
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} par le service vétérinaire`,
        showStatusLine: true,
      };
    }
  }

  if (viewRole === 'svi' && (uiState === 'acceptee-etg' || uiState === 'transmise')) {
    return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
  }

  switch (uiState) {
    case 'creation':
    case 'transmise':
      return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
    case 'manquante-etg':
      return {
        uiState,
        iconId: 'fr-icon-alert-line',
        accentColor: 'red',
        statusLabel: intermediaireName
          ? `${manquantWord} pour ${intermediaireName}`
          : `${manquantWord}`,
        showStatusLine: true,
      };
    case 'refusee-etg':
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: intermediaireName ? `${refuseWord} par ${intermediaireName}` : `${refuseWord}`,
        showStatusLine: true,
      };
    case 'acceptee-etg':
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: intermediaireName ? `${accepteWord} par ${intermediaireName}` : `${accepteWord}`,
        showStatusLine: true,
      };
    case 'manquante-svi':
      return {
        uiState,
        iconId: 'fr-icon-alert-line',
        accentColor: 'red',
        statusLabel: `${manquantWord} pour le service vétérinaire`,
        showStatusLine: true,
      };
    case 'mise-en-consigne':
      return {
        uiState,
        iconId: 'fr-icon-time-line',
        accentColor: 'orange',
        statusLabel: 'Mise en consigne par le service vétérinaire',
        showStatusLine: true,
      };
    case 'saisie-partielle':
      return {
        uiState,
        iconId: 'fr-icon-error-warning-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} partiellement par le service vétérinaire`,
        showStatusLine: true,
      };
    case 'saisie-totale':
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} par le service vétérinaire`,
        showStatusLine: true,
      };
    case 'accepte-svi':
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: `${accepteWord} par le service vétérinaire`,
        showStatusLine: true,
      };
  }
}
