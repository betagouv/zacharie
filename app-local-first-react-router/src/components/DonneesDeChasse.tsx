import { useMemo } from 'react';
import { useParams } from 'react-router';
import { Carcasse, CarcasseType, DepotType, EntityTypes, FeiOwnerRole } from '@prisma/client';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import { getIntermediaireRoleLabel } from '@app/utils/get-user-roles-label';
import { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import {
  useGetTransmissionFromCarcasse,
  useGetTransmissionFromURLParams,
} from '@app/utils/get-transmissions-sorted';
import { getLatestSviDates } from '@app/utils/get-latest-svi-dates';

type StepDetail = { icon: string; text: string; href?: string };
type Step = { role: string; name: string; details: Array<StepDetail> };

export default function FEIDonneesDeChasse({
  carcasseId,
  intermediaires,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
  intermediaires: Array<CarcassesIntermediaire>;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const carcassesState = useZustandStore((state) => state.carcasses);
  const transmission = carcasseId
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useGetTransmissionFromCarcasse(carcassesState[carcasseId])
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useGetTransmissionFromURLParams();
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const carcasses = carcasseId
    ? [carcassesState[carcasseId]].filter(Boolean).filter((c) => !c.deleted_at)
    : transmission?.carcasses;
  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id!] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id!]
    : null;

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of carcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [carcasses]);

  // Étapes du parcours de la fiche, dans l'ordre chronologique (examinateur -> premier détenteur ->
  // intermédiaires -> SVI), affichées en frise chronologique.
  const steps = useMemo(() => {
    const _steps: Array<Step> = [];

    const contactDetails = (user: {
      telephone?: string | null;
      email?: string | null;
      numero_cfei?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    }): Array<StepDetail> => {
      const details: Array<StepDetail> = [];
      if (user.telephone)
        details.push({ icon: 'fr-icon-phone-line', text: user.telephone, href: `tel:${user.telephone}` });
      if (user.email)
        details.push({ icon: 'fr-icon-mail-line', text: user.email, href: `mailto:${user.email}` });
      if (user.numero_cfei) details.push({ icon: 'fr-icon-award-line', text: `N° CFEI ${user.numero_cfei}` });
      if (user.code_postal || user.ville)
        details.push({ icon: 'fr-icon-map-pin-2-line', text: `${user.code_postal} ${user.ville}` });
      return details;
    };

    const entityLocation = (entity: {
      siret?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    }): Array<StepDetail> => {
      const details: Array<StepDetail> = [];
      if (entity.siret) details.push({ icon: 'fr-icon-building-line', text: `SIRET ${entity.siret}` });
      details.push({ icon: 'fr-icon-map-pin-2-line', text: `${entity.code_postal} ${entity.ville}` });
      return details;
    };

    if (examinateurInitialUser) {
      _steps.push({
        role: 'Examinateur initial',
        name: `${examinateurInitialUser.prenom} ${examinateurInitialUser.nom_de_famille}`,
        details: contactDetails(examinateurInitialUser),
      });
    }

    if (premierDetenteurEntity) {
      _steps.push({
        role: 'Premier détenteur',
        name: premierDetenteurEntity.nom_d_usage ?? '',
        details: entityLocation(premierDetenteurEntity),
      });
    } else if (premierDetenteurUser) {
      _steps.push({
        role: 'Premier détenteur',
        name: `${premierDetenteurUser.prenom} ${premierDetenteurUser.nom_de_famille}`,
        details: contactDetails(premierDetenteurUser),
      });
    }

    for (let i = intermediaires.length - 1; i >= 0; i--) {
      const intermediaire = intermediaires[i];
      const entity = entities[intermediaire.intermediaire_entity_id!];
      if (
        entity?.type === EntityTypes.ETG &&
        intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO
      ) {
        continue;
      }
      const details: Array<StepDetail> = entityLocation(entity ?? {});
      if (intermediaire.prise_en_charge_at) {
        details.push({
          icon: 'fr-icon-calendar-line',
          text: `Prise en charge : ${dayjs(intermediaire.prise_en_charge_at).format('dddd D MMMM à HH:mm')}`,
        });
      }
      _steps.push({
        role: getIntermediaireRoleLabel(intermediaire.intermediaire_role!),
        name: entity?.nom_d_usage ?? '',
        details: details,
      });
    }

    if (transmission?.content?.svi_entity_id) {
      const sviEntity = entities[transmission.content.svi_entity_id];
      if (sviEntity) {
        const details: Array<StepDetail> = [
          { icon: 'fr-icon-map-pin-2-line', text: `${sviEntity.code_postal} ${sviEntity.ville}` },
        ];
        const { sviAssignedAt, sviClosedAt, sviAutomaticClosedAt } = getLatestSviDates(
          transmission.carcasses
        );
        if (sviAssignedAt) {
          details.push({
            icon: 'fr-icon-calendar-line',
            text: `Assignation : ${dayjs(sviAssignedAt).format('dddd D MMMM YYYY à HH:mm')}`,
          });
        }
        if (sviClosedAt) {
          details.push({
            icon: 'fr-icon-calendar-line',
            text: `Clôture manuelle : ${dayjs(sviClosedAt).format('dddd D MMMM YYYY à HH:mm')}`,
          });
        }
        if (sviAutomaticClosedAt) {
          details.push({
            icon: 'fr-icon-calendar-line',
            text: `Clôture automatique : ${dayjs(sviAutomaticClosedAt).format('dddd D MMMM YYYY à HH:mm')}`,
          });
        }
        _steps.push({
          role: "Service d'Inspection Vétérinaire (SVI)",
          name: sviEntity.nom_d_usage ?? '',
          details,
        });
      }
    }

    return _steps;
  }, [
    examinateurInitialUser,
    premierDetenteurEntity,
    premierDetenteurUser,
    intermediaires,
    entities,
    transmission?.content?.svi_entity_id,
    transmission.carcasses,
  ]);

  const ccgDate = transmission?.content?.premier_detenteur_depot_ccg_at
    ? dayjs(transmission?.content?.premier_detenteur_depot_ccg_at).format('dddd D MMMM YYYY à HH:mm')
    : null;

  // Faits de la chasse propres à la fiche. Les dates de prise en charge / assignation SVI ne sont pas
  // répétées ici : elles figurent déjà dans la frise « Parcours de la fiche ».
  const facts = useMemo(() => {
    const _facts: Array<{ label: string; value: string }> = [
      { label: 'Fiche n°', value: fei.numero },
      {
        label: carcasses.length > 1 ? 'Espèces' : 'Espèce',
        value: [...new Set(carcasses.map((c) => c.espece))].join(', '),
      },
      {
        label: 'Mise à mort',
        value: [fei?.commune_mise_a_mort, dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY')]
          .filter(Boolean)
          .join(', '),
      },
    ];
    const debutChasse = carcasses[0]?.heure_mise_a_mort_premiere_carcasse_fei;
    const finExamen = onlyPetitGibier ? null : carcasses[0]?.heure_evisceration_derniere_carcasse_fei;
    if (debutChasse || finExamen) {
      _facts.push({ label: 'Horaires', value: [debutChasse, finExamen].filter(Boolean).join(' → ') });
    }
    if (ccgDate) {
      _facts.push({
        label: 'Dépôt CCG',
        value: [transmission?.content?.premier_detenteur_depot_entity_name_cache, ccgDate]
          .filter(Boolean)
          .join(', '),
      });
    }
    return _facts;
  }, [
    fei.numero,
    fei.commune_mise_a_mort,
    fei.date_mise_a_mort,
    transmission?.content?.premier_detenteur_depot_entity_name_cache,
    ccgDate,
    onlyPetitGibier,
    carcasses,
  ]);

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {facts.map((fact, index) => (
          <p
            key={index}
            className="m-0"
          >
            <span className="text-gray-500">{fact.label} : </span>
            <span className="font-medium">{fact.value}</span>
          </p>
        ))}
      </div>
      <p className="mb-4 font-bold">Parcours de la fiche</p>
      <div className="relative border-l-2 border-gray-300 pl-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className="relative mb-4 last:mb-0"
          >
            <div className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{step.name}</span>
              <Tag small>{step.role}</Tag>
            </div>
            {step.details.map((detail, detailIndex) => (
              <div
                key={detailIndex}
                className="flex items-start gap-1.5 text-sm text-gray-600"
              >
                <span
                  className={`${detail.icon} fr-icon--sm shrink-0 text-gray-400`}
                  aria-hidden="true"
                />
                {detail.href ? (
                  <a
                    className="fr-link text-sm break-all"
                    href={detail.href}
                  >
                    {detail.text}
                  </a>
                ) : (
                  <span className="break-words">{detail.text}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
