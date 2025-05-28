import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { Carcasse, CarcasseType, IPM1Decision, IPM2Decision, Prisma, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { useMemo, useRef } from 'react';
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
  const cacasseModal = useRef(
    createModal({
      id: `carcasse-modal-${carcasse.zacharie_carcasse_id}`,
      isOpenedByDefault: false,
    }),
  ).current;

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
    <>
      <div
        className={[
          'flex basis-full flex-row items-center justify-between border-solid text-left',
          'bg-contrast-grey border-0',
          isRefus && 'border-l-3 border-error-main-525',
          isManquante && 'border-l-3 border-manquante border-error-main-525',
          isAccept && 'border-l-3 border-action-high-blue-france',
          className || '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          className="flex flex-1 flex-col border-none p-4 text-left"
          type="button"
          onClick={onClick ? onClick : cacasseModal.open}
        >
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
        )}
      </div>

      <cacasseModal.Component
        size="large"
        title={`${espece} - N° ${carcasse.numero_bracelet}`}
        buttons={[
          {
            children: 'Fermer',
            onClick: () => cacasseModal.close(),
          },
        ]}
      >
        <CarcasseDetails carcasseId={carcasse.zacharie_carcasse_id} />
      </cacasseModal.Component>
    </>
  );
}

function CarcasseDetails({ carcasseId }: { carcasseId?: Carcasse['zacharie_carcasse_id'] }) {
  const user = useUser((state) => state.user)!;
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const latestIntermediaire = intermediaires[0];
  // console.log('fei', fei);

  const carcasse = state.carcasses[carcasseId!];

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const intermediaire of intermediaires) {
      const carcassesIntermediairesId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        intermediaire.id,
      );
      const intermediaireCarcasse = state.carcassesIntermediaires[carcassesIntermediairesId];
      if (intermediaireCarcasse?.commentaire) {
        const intermediaireEntity = state.entities[intermediaire.fei_intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage} : ${intermediaireCarcasse?.commentaire}`);
      }
    }
    return commentaires;
  }, [intermediaires, state.carcassesIntermediaires, state.entities, carcasse.numero_bracelet, fei.numero]);

  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? state.users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id!]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id!]
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
    for (const intermediaire of intermediaires) {
      const intermediaireLines = [];
      const isCollecteur = intermediaire.fei_intermediaire_role === UserRoles.COLLECTEUR_PRO;
      const label = isCollecteur
        ? `Collecteur ${collecteurs + 1}`
        : 'Établissement de Traitement du Gibier Sauvage';
      const entity = state.entities[intermediaire.fei_intermediaire_entity_id!];
      intermediaireLines.push(entity.nom_d_usage);
      intermediaireLines.push(entity.siret);
      intermediaireLines.push(`${entity.code_postal} ${entity.ville}`);
      lines.push({ label, value: intermediaireLines });
    }
    return lines;
  }, [intermediaires, state.entities]);

  const ccgDate =
    fei.premier_detenteur_depot_type === 'CCG'
      ? dayjs(fei.premier_detenteur_date_depot_quelque_part).format('dddd DD MMMM YYYY à HH:mm')
      : null;
  const etgDate = latestIntermediaire
    ? dayjs(latestIntermediaire.check_finished_at).format('dddd DD MMMM YYYY à HH:mm')
    : null;

  const milestones = useMemo(() => {
    const _milestones = [
      `Commune de mise à mort: ${fei?.commune_mise_a_mort ?? ''}`,
      `Date de mise à mort: ${dayjs(fei.date_mise_a_mort).format('dddd DD MMMM YYYY')}`,
      `Heure de mise à mort de la première carcasse de la fiche: ${fei.heure_mise_a_mort_premiere_carcasse!}`,
    ];
    if (onlyPetitGibier) {
      _milestones.push(
        `Heure d'éviscération de la dernière carcasse de la fiche: ${fei.heure_evisceration_derniere_carcasse!}`,
      );
    }
    if (ccgDate) _milestones.push(`Date et heure de dépôt dans le CCG: ${ccgDate}`);
    if (etgDate) _milestones.push(`Date et heure de prise en charge par l'ETG: ${etgDate}`);
    // if (carcasse.svi_ipm1_date) _milestones.push(`Date de l'inspection : ${dayjs(carcasse.svi_ipm1_date).format('dddd DD MMMM YYYY')}`);
    if (carcasse.svi_ipm2_date)
      _milestones.push(
        `Date de l'inspection du service vétérinaire : ${dayjs(carcasse.svi_ipm2_date).format('dddd DD MMMM YYYY')}`,
      );
    return _milestones;
  }, [
    ccgDate,
    etgDate,
    onlyPetitGibier,
    fei.date_mise_a_mort,
    fei.heure_mise_a_mort_premiere_carcasse,
    fei.heure_evisceration_derniere_carcasse,
    carcasse.svi_ipm2_date,
  ]);

  const ipm1 = useMemo(() => {
    if (!carcasse.svi_ipm1_date) return [];
    const imp1Lines = [];
    imp1Lines.push(`Date de l'inspection : ${dayjs(carcasse.svi_ipm1_date).format('dddd DD MMMM YYYY')}`);
    if (!carcasse.svi_ipm1_presentee_inspection) {
      imp1Lines.push('Carcasse manquante');
      return imp1Lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      imp1Lines.push(`Nombre d'animaux : ${carcasse.svi_ipm1_nombre_animaux}`);
    }
    if (carcasse.svi_ipm1_commentaire) {
      imp1Lines.push(`Commentaire de l'inspection : ${carcasse.svi_ipm1_commentaire}`);
    }
    if (carcasse.svi_ipm1_pieces.length) {
      imp1Lines.push(
        <>
          <p className="with-marker">Pièces observées :</p>
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
          <p className="with-marker">Lésions ou motifs de consigne :</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm1_lesions_ou_motifs.map((type, index) => {
              return <li key={index}>{type}</li>;
            })}
          </ul>
        </>,
      );
    }
    imp1Lines.push(
      `Décision IPM1 : ${carcasse.svi_ipm1_decision === IPM1Decision.NON_RENSEIGNEE ? 'Non renseigné' : 'Mise en consigne'}`,
    );
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE) {
      imp1Lines.push(`Durée de la consigne : ${carcasse.svi_ipm1_duree_consigne} heures`);
    }
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE && carcasse.svi_ipm1_poids_consigne) {
      imp1Lines.push(`Poids de la consigne : ${carcasse.svi_ipm1_poids_consigne}kg`);
    }
    return imp1Lines;
  }, [carcasse]);

  const showIpm1AndIpm2 = useMemo(() => {
    return user.roles.includes(UserRoles.SVI) || user.roles.includes(UserRoles.ETG);
  }, [user.roles]);

  const ipm2 = useMemo(() => {
    if (!carcasse.svi_ipm2_date) return [];
    const imp2Lines = [];
    imp2Lines.push(`Date de l'inspection : ${dayjs(carcasse.svi_ipm2_date).format('dddd DD MMMM YYYY')}`);
    if (!carcasse.svi_ipm2_presentee_inspection) {
      imp2Lines.push('Carcasse manquante');
      return imp2Lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      imp2Lines.push(`Nombre d'animaux : ${carcasse.svi_ipm2_nombre_animaux}`);
    }
    if (carcasse.svi_ipm2_commentaire) {
      imp2Lines.push(`Commentaire de l'inspection : ${carcasse.svi_ipm2_commentaire}`);
    }
    if (carcasse.svi_ipm2_pieces.length) {
      imp2Lines.push(
        <>
          <p className="with-marker">Pièces observées :</p>
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
          <p className="with-marker">Lésions ou motifs de consigne :</p>
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
        imp2Lines.push(`Décision : Levée de la consigne, pas de saisie`);
        break;
      case IPM2Decision.SAISIE_TOTALE:
        imp2Lines.push(`Décision : Saisie totale`);
        break;
      case IPM2Decision.SAISIE_PARTIELLE:
        imp2Lines.push(`Décision IPM2: Saisie partielle`);
        break;
      case IPM2Decision.TRAITEMENT_ASSAINISSANT:
        imp2Lines.push(`Décision IPM2: Traitement assainissant`);
        break;
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temps) {
      imp2Lines.push(`Temps de cuisson : ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temp) {
      imp2Lines.push(`Température de cuisson : ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temps) {
      imp2Lines.push(`Temps de congélation : ${carcasse.svi_ipm2_traitement_assainissant_congelation_temps}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temp) {
      imp2Lines.push(
        `Température de congélation : ${carcasse.svi_ipm2_traitement_assainissant_congelation_temp}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_type) {
      imp2Lines.push(`Type de traitement : ${carcasse.svi_ipm2_traitement_assainissant_type}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_paramètres) {
      imp2Lines.push(`Paramètres : ${carcasse.svi_ipm2_traitement_assainissant_paramètres}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_etablissement) {
      imp2Lines.push(
        `Établissement désigné pour réaliser le traitement assainissant : ${carcasse.svi_ipm2_traitement_assainissant_etablissement}`,
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_poids) {
      imp2Lines.push(`Poids : ${carcasse.svi_ipm2_traitement_assainissant_poids}`);
    }
    if (carcasse.svi_ipm2_poids_saisie) {
      imp2Lines.push(`Poids : ${carcasse.svi_ipm2_poids_saisie}`);
    }
    return imp2Lines;
  }, [carcasse]);

  return (
    <>
      <hr className="mt-4 bg-none" />
      <ItemNotEditable label="Épisodes clés" value={milestones} withDiscs />
      <ItemNotEditable label="Anomalies abats" value={carcasse.examinateur_anomalies_abats} withDiscs />
      <ItemNotEditable label="Anomalies carcasse" value={carcasse.examinateur_anomalies_carcasse} withDiscs />
      <ItemNotEditable label="Commentaires des intermédiaires" value={commentairesIntermediaires} withDiscs />
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
      ) : (
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

function ItemNotEditable({
  label,
  value,
  withDiscs = false,
}: {
  label: string;
  value: string | Array<string | null | undefined | React.ReactNode>;
  withDiscs?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <p className="font-bold">{label}</p>
      {Array.isArray(value) ? (
        value.length > 0 ? (
          <ul className={['ml-4 list-inside'].filter(Boolean).join(' ')}>
            {value.map((item, index) => {
              if (!item) return null;
              if (typeof item === 'string') {
                return (
                  <li key={item + index}>
                    <p className={['m-0 inline', withDiscs ? 'with-marker' : ''].join(' ')}>{item}</p>
                  </li>
                );
              }
              return <li key={index}>{item}</li>;
            })}
          </ul>
        ) : (
          <p className="ml-4">N/A</p>
        )
      ) : (
        <p className="ml-4">{value}</p>
      )}
    </div>
  );
}
