import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import useUser from '@app/zustand/user';
import useCarcasseModal from '@app/zustand/ui-modals';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { getCarcasseCardDisplay, type CardViewRole } from '@app/utils/get-carcasse-card-display';

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
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[carcasse.fei_numero];
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const latestIntermediaire = carcassesIntermediaires[0];
  const entities = useZustandStore((state) => state.entities);
  const user = useUser((state) => state.user)!;
  const openCarcasseModal = useCarcasseModal((s) => s.open);
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
          `Commentaire de ${_intermediaireEntity?.nom_d_usage} : ${_carcasseIntermediaire?.commentaire}`
        );
      }
    }
    return commentaires;
  }, [carcassesIntermediaires, entities]);

  useCarcasseStatusAndRefus(carcasse, fei);

  let miseAMort = '';
  if (!hideDateMiseAMort && fei?.date_mise_a_mort) {
    miseAMort += `Mise à mort : ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
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

  const handleClick =
    onClick ?? (() => openCarcasseModal({ carcasseId: carcasse.zacharie_carcasse_id, feiNumero: carcasse.fei_numero }));

  return (
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
        onClick={handleClick}
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
            <p className={['text-sm/4', accentTextClass].filter(Boolean).join(' ')}>{descriptionLine}</p>
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
  );
}
