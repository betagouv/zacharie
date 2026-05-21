import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import useUser from '@app/zustand/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Carcasse, CarcasseType, IPM1Decision, IPM2Decision, PoidsType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { type ReactNode, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useIsCircuitCourt } from '@app/utils/circuit-court';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import {
  getCarcasseCardDisplay,
  type CardAccent,
  type CardViewRole,
} from '@app/utils/get-carcasse-card-display';
import {
  useHistoryForCarcasse,
  CarcasseModificationRequestStatus,
} from '@app/utils/carcasse-modification-request';

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
    })
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
          `Commentaire de ${_intermediaireEntity?.nom_d_usage}\u00A0: ${_carcasseIntermediaire?.commentaire}`
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

  // Modifications passées (approuvées / refusées) sur cette carcasse — utilisé pour afficher un
  // compteur dans le descriptionLine + une icône d'alerte en cas de refus (signal visuel fort).
  // Les demandes PENDING ne sont pas comptées ici (déjà visualisées via le PendingModificationBanner).
  const modifsHistory = useHistoryForCarcasse(carcasse.zacharie_carcasse_id);
  const modifsCount = modifsHistory.length;
  const hasRejectedModif = modifsHistory.some((r) => r.status === CarcasseModificationRequestStatus.REJECTED);

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
  if (modifsCount > 0) {
    if (descriptionLine.length > 0) descriptionLine += `, `;
    descriptionLine += `${modifsCount} modification`;
    if (modifsCount > 1) descriptionLine += 's';
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
          'flex basis-full flex-row items-center justify-between border-1 border-solid border-transparent text-left hover:border-gray-300!',
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
              className={[statusIconId, 'shrink-0 text-2xl', accentTextClass].filter(Boolean).join(' ')}
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
                className={['text-sm/4 font-bold first-letter:uppercase', accentTextClass]
                  .filter(Boolean)
                  .join(' ')}
              >
                {statusLabel}
              </p>
            )}
            {descriptionLine && (
              <p
                className={[
                  'inline-flex items-center gap-1 text-sm/4',
                  hasRejectedModif ? 'text-error-main-525 font-semibold' : accentTextClass,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {hasRejectedModif && (
                  <span
                    className="fr-icon-warning-line fr-icon--sm"
                    aria-hidden="true"
                  />
                )}
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
            cardDisplay={cardDisplay}
            isEcarteePourInspection={isEcarteePourInspection}
          />
        )}
      </cacasseModal.Component>
    </>
  );
}

// === Helpers et sous-composants pour le contenu de la modale ===
// Style repris de routes/chasseur/examinateur-carcasse-detail.tsx.
// A factoriser dans un second temps.

type DecisionColor = {
  cardText: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
};

function getAccentColorClasses(accent: CardAccent | undefined): DecisionColor {
  switch (accent) {
    case 'red':
      return {
        cardText: 'text-red-700',
        cardBg: 'bg-red-50',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
      };
    case 'blue':
      return {
        cardText: 'text-blue-700',
        cardBg: 'bg-blue-50',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
      };
    case 'orange':
      return {
        cardText: 'text-orange-700',
        cardBg: 'bg-orange-50',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
      };
    case 'gray':
    default:
      return {
        cardText: 'text-gray-700',
        cardBg: 'bg-gray-50',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-800',
      };
  }
}

function formatModalDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YY');
}

function formatModalTimelineDate(date: Date, withTime?: boolean): string {
  return dayjs(date).format(withTime ? 'dddd D MMMM YYYY à HH:mm' : 'dddd D MMMM YYYY');
}

type ModalTimelineEvent = { date: Date; label: string; withTime?: boolean };

function buildModalTimeline(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fei: any;
  carcasse: Carcasse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intermediaires: Array<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: Record<string, any>;
}): Array<ModalTimelineEvent> {
  const { fei, carcasse, intermediaires, entities } = args;
  const events: Array<ModalTimelineEvent> = [];

  if (fei?.date_mise_a_mort) {
    events.push({ date: new Date(fei.date_mise_a_mort), label: 'Mise à mort' });
  }
  if (fei?.examinateur_initial_date_approbation_mise_sur_le_marche) {
    events.push({
      date: new Date(fei.examinateur_initial_date_approbation_mise_sur_le_marche),
      label: 'Fiche transmise au premier détenteur',
      withTime: true,
    });
  }
  if (fei?.premier_detenteur_depot_ccg_at) {
    const ccgName =
      entities[fei.premier_detenteur_depot_entity_id]?.nom_d_usage ||
      fei.premier_detenteur_depot_entity_name_cache ||
      '';
    events.push({
      date: new Date(fei.premier_detenteur_depot_ccg_at),
      label: ccgName ? `Dépôt des carcasses ${ccgName}` : 'Dépôt des carcasses',
      withTime: true,
    });
  }
  for (const ci of intermediaires) {
    if (!ci.prise_en_charge_at) continue;
    const entityName = entities[ci.intermediaire_entity_id]?.nom_d_usage ?? '';
    const isEtg = ci.intermediaire_role === UserRoles.ETG;
    events.push({
      date: new Date(ci.prise_en_charge_at),
      label: isEtg ? `Prise en charge par ETG ${entityName}` : `Carcasses prise en charge par ${entityName}`,
      withTime: true,
    });
  }
  if (carcasse.svi_assigned_to_fei_at) {
    events.push({
      date: new Date(carcasse.svi_assigned_to_fei_at),
      label: 'Assignation au service vétérinaire',
      withTime: true,
    });
  }
  if (carcasse.svi_ipm2_date) {
    events.push({
      date: new Date(carcasse.svi_ipm2_date),
      label: 'Inspection du service vétérinaire',
    });
  }
  if (carcasse.svi_carcasse_status_set_at) {
    events.push({
      date: new Date(carcasse.svi_carcasse_status_set_at),
      label: 'Contrôle par service vétérinaire',
      withTime: true,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function ModalStatusBadge({
  statusLabel,
  statusIconId,
  accentColor,
}: {
  statusLabel: string;
  statusIconId: string | null;
  accentColor: CardAccent;
}) {
  const colors = getAccentColorClasses(accentColor);
  return (
    <div className="fr-mb-2w flex flex-wrap items-center gap-2">
      <Tag
        small
        className={['items-center rounded-[4px] font-semibold', colors.badgeBg, colors.badgeText].join(' ')}
      >
        {statusIconId && (
          <span
            className={[statusIconId, 'fr-icon--sm mr-1'].join(' ')}
            aria-hidden="true"
          />
        )}
        {statusLabel}
      </Tag>
    </div>
  );
}

function ModalCard({
  title,
  accentColor,
  children,
}: {
  title?: string;
  accentColor?: CardAccent;
  children: ReactNode;
}) {
  const isAccented = !!accentColor && accentColor !== 'gray';
  const colors = isAccented ? getAccentColorClasses(accentColor) : null;
  return (
    <div className={['fr-mb-2w rounded p-4 md:p-6', colors ? colors.cardBg : 'bg-gray-50'].join(' ')}>
      {title && (
        <h3 className={['fr-h6 fr-mb-1w', colors ? colors.cardText : ''].filter(Boolean).join(' ')}>
          {title}
        </h3>
      )}
      <div className={colors ? colors.cardText : ''}>{children}</div>
    </div>
  );
}

function ModalActeurBlock({ label, lines }: { label: string; lines: Array<string | null | undefined> }) {
  const cleaned = lines.map((l) => (l ?? '').toString().trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <ul className="space-y-0.5 text-sm">
        {cleaned.map((line, idx) => (
          <li key={idx}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function ModalTimeline({ events }: { events: Array<ModalTimelineEvent> }) {
  if (events.length === 0) return null;
  return (
    <ModalCard title="Traçabilité">
      <div className="relative border-l-2 border-gray-300 pl-4">
        {events.map((event, i) => (
          <div
            key={`${event.date.toISOString()}-${i}`}
            className="relative mb-4 last:mb-0"
          >
            <div className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
            <div className="text-sm">
              <span className="text-gray-500">{formatModalTimelineDate(event.date, event.withTime)}</span>{' '}
              <span className="font-semibold">{event.label}</span>
            </div>
          </div>
        ))}
      </div>
    </ModalCard>
  );
}

function CarcasseDetails({
  carcasseId,
  statusNewCard,
  motifRefus,
  cardDisplay,
  isEcarteePourInspection,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
  statusNewCard: string;
  motifRefus: string;
  cardDisplay: ReturnType<typeof getCarcasseCardDisplay>;
  isEcarteePourInspection: boolean;
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

  const examinateurName = useMemo(() => {
    if (!examinateurInitialUser) return '—';
    return (
      [examinateurInitialUser.prenom, examinateurInitialUser.nom_de_famille]
        .filter(Boolean)
        .join(' ')
        .trim() || '—'
    );
  }, [examinateurInitialUser]);

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

  const timelineEvents = useMemo(
    () => buildModalTimeline({ fei, carcasse, intermediaires: carcassesIntermediaires, entities }),
    [fei, carcasse, carcassesIntermediaires, entities]
  );

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
        </>
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
        </>
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
        </>
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
        </>
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
        `Température de cuisson\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temps) {
      imp2Lines.push(
        `Temps de congélation\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_congelation_temps}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temp) {
      imp2Lines.push(
        `Température de congélation\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_congelation_temp}`
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
        `Établissement désigné pour réaliser le traitement assainissant\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_etablissement}`
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

  const headerAccent: CardAccent = isEcarteePourInspection ? 'red' : (cardDisplay.accentColor ?? 'gray');
  const headerStatusLabel = isEcarteePourInspection
    ? 'Écarté pour inspection'
    : (cardDisplay.statusLabel ?? 'En cours');
  const headerStatusIconId = isEcarteePourInspection ? 'fr-icon-alert-line' : (cardDisplay.iconId ?? null);
  const sviAccent: CardAccent = cardDisplay.accentColor ?? 'gray';

  return (
    <>
      <ModalStatusBadge
        statusLabel={headerStatusLabel}
        statusIconId={headerStatusIconId}
        accentColor={headerAccent}
      />

      <ModalCard title="Informations de chasse">
        <ul className="space-y-1">
          <li>Chasse du {formatModalDate(fei.date_mise_a_mort)}</li>
          <li>{carcasse.espece || '—'}</li>
          <li>Prélevé à {fei.commune_mise_a_mort || '—'}</li>
          <li>Examiné par {examinateurName}</li>
          {carcasse.heure_mise_a_mort_premiere_carcasse_fei && (
            <li>
              Heure de mise à mort de la première carcasse&nbsp;:{' '}
              {carcasse.heure_mise_a_mort_premiere_carcasse_fei}
            </li>
          )}
          {carcasse.type === CarcasseType.PETIT_GIBIER &&
            carcasse.heure_evisceration_derniere_carcasse_fei && (
              <li>
                Heure d'éviscération de la dernière carcasse&nbsp;:{' '}
                {carcasse.heure_evisceration_derniere_carcasse_fei}
              </li>
            )}
        </ul>
      </ModalCard>

      {carcasse.examinateur_anomalies_carcasse?.length > 0 && (
        <ModalCard title="Anomalies carcasse">
          <ul className="ml-4 list-inside list-disc space-y-0.5 text-sm">
            {carcasse.examinateur_anomalies_carcasse.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </ModalCard>
      )}

      {carcasse.examinateur_anomalies_abats?.length > 0 && (
        <ModalCard title="Anomalies abats">
          <ul className="ml-4 list-inside list-disc space-y-0.5 text-sm">
            {carcasse.examinateur_anomalies_abats.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </ModalCard>
      )}

      {(statusNewCard.includes('refus') || statusNewCard.includes('manquant')) && motifRefus && (
        <ModalCard
          title={motifRefus.split(':')[0]}
          accentColor="red"
        >
          <p>{motifRefus.split(':')[1] || "Aucun motif de refus n'a été renseigné"}</p>
        </ModalCard>
      )}

      {commentairesIntermediaires.length > 0 && (
        <ModalCard title="Commentaires des intermédiaires">
          <ul className="space-y-1 text-sm">
            {commentairesIntermediaires.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </ModalCard>
      )}

      {showIpm1AndIpm2 ? (
        <>
          <ModalCard
            title="Inspection Post-Mortem 1"
            accentColor={sviAccent}
          >
            {carcasse.svi_ipm1_date ? (
              <div className="space-y-1 text-sm">
                {ipm1.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ) : (
              <p>N/A</p>
            )}
          </ModalCard>
          <ModalCard
            title="Inspection Post-Mortem 2"
            accentColor={sviAccent}
          >
            {carcasse.svi_ipm2_date ? (
              <div className="space-y-1 text-sm">
                {ipm2.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ) : (
              <p>N/A</p>
            )}
          </ModalCard>
        </>
      ) : isCircuitCourt ? null : (
        <ModalCard
          title="Inspection du Service Vétérinaire"
          accentColor={sviAccent}
        >
          {carcasse.svi_ipm2_date ? (
            <div className="space-y-1 text-sm">
              {ipm2.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          ) : (
            <p>N/A</p>
          )}
        </ModalCard>
      )}

      <ModalTimeline events={timelineEvents} />

      <ModalCard title="Acteurs de la chasse">
        <div className="space-y-3">
          <ModalActeurBlock
            label="Examinateur Initial"
            lines={examinateurInitialInput}
          />
          <ModalActeurBlock
            label="Premier Détenteur"
            lines={premierDetenteurInput}
          />
          {intermediairesInputs.map((intermediaireInput, index) => (
            <ModalActeurBlock
              key={index}
              label={intermediaireInput.label}
              lines={intermediaireInput.value}
            />
          ))}
        </div>
      </ModalCard>
    </>
  );
}
