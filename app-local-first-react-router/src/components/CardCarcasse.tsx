import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import useZustandStore from '@app/zustand/store';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Carcasse } from '@prisma/client';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useParams } from 'react-router';

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
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const carcassesIntermediaires = useZustandStore((state) => state.carcassesIntermediaires);
  const entities = useZustandStore((state) => state.entities);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _intermediaire of intermediaires) {
      if (!_intermediaire?.id) {
        continue;
      }
      const carcasseIntermediaireId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        _intermediaire.id,
      );
      const _carcasseIntermediaire = carcassesIntermediaires[carcasseIntermediaireId];
      const _intermediaireEntity = entities[_intermediaire.fei_intermediaire_entity_id];
      if (_carcasseIntermediaire?.commentaire) {
        commentaires.push(
          `Commentaire de ${_intermediaireEntity?.nom_d_usage} : ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [intermediaires, fei.numero, carcasse.numero_bracelet, carcassesIntermediaires, entities]);

  let { statusNewCard } = useCarcasseStatusAndRefus(carcasse, fei);

  let espece = carcasse.espece;
  if (carcasse.nombre_d_animaux! > 1) espece = espece += ` (${carcasse.nombre_d_animaux})`;
  let miseAMort = '';
  if (!hideDateMiseAMort) {
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

  const Component = onClick ? 'button' : 'div';
  const componentProps = onClick ? { type: 'button' as const, onClick } : {};

  if (forceRefus) {
    statusNewCard = 'refusé';
  } else if (forceManquante) {
    statusNewCard = 'manquant';
  } else if (forceAccept) {
    statusNewCard = 'accepté';
  }
  const isEnCours = statusNewCard.includes('cours');
  const isRefus = statusNewCard.includes('refus');
  const isManquante = statusNewCard.includes('manquant');
  const isAccept = statusNewCard.includes('accepté');

  return (
    <Component
      {...componentProps}
      className={[
        'flex basis-full flex-row items-center justify-between border-solid p-4 text-left',
        'bg-contrast-grey border-0',
        isRefus && 'border-l-3 border-error-main-525',
        isManquante && 'border-l-3 border-manquante border-error-main-525',
        isAccept && 'border-l-3 border-action-high-blue-france',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col">
        <p className="order-1 text-base font-bold">{espece}</p>
        <p className="order-2 text-sm/4 font-bold">N° {carcasse.numero_bracelet}</p>
        {miseAMort && <p className="order-3 text-sm/4">{miseAMort}</p>}
        <p
          className={[
            'text-sm/4',
            !descriptionLine && 'text-transparent',
            isEnCours ? 'order-4' : 'order-6',
            isRefus && 'text-error-main-525',
            isManquante && 'text-error-main-525',
            isAccept && 'text-action-high-blue-france',
          ].join(' ')}
        >
          {descriptionLine || 'Aucune anomalie'}
        </p>
        <p
          className={[
            'order-5 text-sm/4 first-letter:uppercase',
            isEnCours && '!text-transparent',
            !isEnCours && 'font-bold', // bold pour accepté et refusé et manquant
            isRefus && 'text-error-main-525',
            isManquante && 'text-manquante text-error-main-525',
            isAccept && 'text-action-high-blue-france',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {statusNewCard}
        </p>
      </div>
      <div className="flex flex-row gap-2">
        {onEdit && (
          <Button
            type="button"
            iconId="fr-icon-pencil-line"
            onClick={onEdit}
            title="Éditer la carcasse"
            priority="tertiary no outline"
          />
        )}
        {onDelete && !isRefus && !isManquante && (
          <Button
            type="button"
            iconId="fr-icon-delete-bin-line"
            onClick={onDelete}
            title="Supprimer la carcasse"
            priority="tertiary no outline"
          />
        )}
      </div>
    </Component>
  );
}
