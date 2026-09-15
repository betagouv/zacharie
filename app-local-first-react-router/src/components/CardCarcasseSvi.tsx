import { useMemo } from 'react';
import { Carcasse, CarcasseStatus, CarcasseType, IPM1Decision, IPM2Decision } from '@prisma/client';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { getSimplifiedCarcasseStatus } from '@app/utils/get-carcasse-status';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { useApproveCarcasse } from '@app/utils/svi-approve-carcasse';
import { Button } from '@codegouvfr/react-dsfr/Button';

interface CarcasseAVerifierProps {
  carcasse: Carcasse;
  canClick: boolean;
}

const ipm1DecisionLabel: Record<IPM1Decision, string> = {
  [IPM1Decision.NON_RENSEIGNEE]: 'Non renseignée',
  [IPM1Decision.ACCEPTE]: 'Acceptée',
  [IPM1Decision.MISE_EN_CONSIGNE]: 'Mise en consigne',
};

const ipm2DecisionLabel: Record<IPM2Decision, string> = {
  [IPM2Decision.NON_RENSEIGNEE]: 'Non renseignée',
  [IPM2Decision.LEVEE_DE_LA_CONSIGNE]: 'Levée de la consigne',
  [IPM2Decision.SAISIE_TOTALE]: 'Saisie totale',
  [IPM2Decision.SAISIE_PARTIELLE]: 'Saisie partielle',
  [IPM2Decision.TRAITEMENT_ASSAINISSANT]: 'Traitement assainissant',
};

// une ligne par information, listes mises bout à bout : la carte reste lisible d'un coup d'œil,
// le détail complet est sur la page de la carcasse
function getIpm1Lines(carcasse: Carcasse): Array<string> {
  if (!carcasse.svi_ipm1_presentee_inspection) {
    return ['Carcasse manquante'];
  }
  const lines: Array<string> = [];
  if (carcasse.svi_ipm1_decision) {
    let decision = ipm1DecisionLabel[carcasse.svi_ipm1_decision];
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE) {
      const precisions = [
        carcasse.svi_ipm1_duree_consigne ? `${carcasse.svi_ipm1_duree_consigne}\u00A0h` : null,
        carcasse.svi_ipm1_poids_consigne ? `${carcasse.svi_ipm1_poids_consigne}\u00A0kg` : null,
      ].filter(Boolean);
      if (precisions.length) {
        decision += ` (${precisions.join(', ')})`;
      }
    }
    lines.push(`Décision\u00A0: ${decision}`);
  }
  if (carcasse.svi_ipm1_lesions_ou_motifs.length) {
    lines.push(`Lésions ou motifs\u00A0: ${carcasse.svi_ipm1_lesions_ou_motifs.join(', ')}`);
  }
  if (carcasse.svi_ipm1_pieces.length) {
    lines.push(`Pièces observées\u00A0: ${carcasse.svi_ipm1_pieces.join(', ')}`);
  }
  if (carcasse.type === CarcasseType.PETIT_GIBIER) {
    lines.push(`Nombre d'animaux\u00A0: ${carcasse.svi_ipm1_nombre_animaux}`);
  }
  if (carcasse.svi_ipm1_commentaire) {
    lines.push(`Commentaire\u00A0: ${carcasse.svi_ipm1_commentaire}`);
  }
  return lines;
}

function getIpm2Lines(carcasse: Carcasse): Array<string> {
  if (!carcasse.svi_ipm2_presentee_inspection) {
    return ['Carcasse manquante'];
  }
  const lines: Array<string> = [];
  if (carcasse.svi_ipm2_decision) {
    let decision = ipm2DecisionLabel[carcasse.svi_ipm2_decision];
    if (carcasse.svi_ipm2_poids_saisie) {
      decision += ` (${carcasse.svi_ipm2_poids_saisie}\u00A0kg)`;
    }
    lines.push(`Décision\u00A0: ${decision}`);
  }
  const traitement = [
    carcasse.svi_ipm2_traitement_assainissant_type,
    carcasse.svi_ipm2_traitement_assainissant_cuisson_temps
      ? `cuisson ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}`
      : null,
    carcasse.svi_ipm2_traitement_assainissant_cuisson_temp,
    carcasse.svi_ipm2_traitement_assainissant_congelation_temps
      ? `congélation ${carcasse.svi_ipm2_traitement_assainissant_congelation_temps}`
      : null,
    carcasse.svi_ipm2_traitement_assainissant_congelation_temp,
    carcasse.svi_ipm2_traitement_assainissant_paramètres,
    carcasse.svi_ipm2_traitement_assainissant_poids
      ? `${carcasse.svi_ipm2_traitement_assainissant_poids}\u00A0kg`
      : null,
  ].filter(Boolean);
  if (traitement.length) {
    lines.push(`Traitement\u00A0: ${traitement.join(', ')}`);
  }
  if (carcasse.svi_ipm2_traitement_assainissant_etablissement) {
    lines.push(`Établissement\u00A0: ${carcasse.svi_ipm2_traitement_assainissant_etablissement}`);
  }
  if (carcasse.svi_ipm2_lesions_ou_motifs.length) {
    lines.push(`Lésions ou motifs\u00A0: ${carcasse.svi_ipm2_lesions_ou_motifs.join(', ')}`);
  }
  if (carcasse.svi_ipm2_pieces.length) {
    lines.push(`Pièces observées\u00A0: ${carcasse.svi_ipm2_pieces.join(', ')}`);
  }
  if (carcasse.type === CarcasseType.PETIT_GIBIER) {
    lines.push(`Nombre d'animaux\u00A0: ${carcasse.svi_ipm2_nombre_animaux}`);
  }
  if (carcasse.svi_ipm2_commentaire) {
    lines.push(`Commentaire\u00A0: ${carcasse.svi_ipm2_commentaire}`);
  }
  return lines;
}

export default function CardCarcasseSvi({ carcasse, canClick }: CarcasseAVerifierProps) {
  // const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const params = useParams();
  const navigate = useNavigate();

  const state = useZustandStore((state) => state);
  const feis = useZustandStore((state) => state.feis);
  const approveCarcasse = useApproveCarcasse();
  const fei = feis[params.fei_numero!];
  const carcasseIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const latestIntermediaire = carcasseIntermediaires[0];

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcasseIntermediaire of carcasseIntermediaires) {
      if (carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = state.entities[carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage}\u00A0: ${carcasseIntermediaire?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcasseIntermediaires, state.entities]);

  const Component = canClick ? 'button' : 'div';
  const componentProps = canClick
    ? {
        type: 'button' as const,
        onClick: () => {
          navigate(`/app/svi/carcasse-svi/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
        },
      }
    : {};

  const status = getSimplifiedCarcasseStatus(carcasse);
  // la mise en consigne est un statut « en cours de traitement » pour le reste de l'app,
  // mais le SVI doit la repérer d'un coup d'œil : il devra y revenir (levée de consigne ou saisie)
  const isMiseEnConsigne = carcasse.svi_carcasse_status === CarcasseStatus.CONSIGNE;
  const miseEnConsigneLabel =
    carcasse.type === CarcasseType.PETIT_GIBIER ? 'Mis en consigne' : 'Mise en consigne';
  const isEcarteePourInspection =
    status === 'en cours de traitement' &&
    !!latestIntermediaire?.ecarte_pour_inspection &&
    !carcasse.svi_ipm1_date &&
    !carcasse.svi_ipm2_date;

  let espece = carcasse.espece;
  if (carcasse.type === CarcasseType.PETIT_GIBIER && latestIntermediaire?.nombre_d_animaux_acceptes) {
    espece += ` (${latestIntermediaire.nombre_d_animaux_acceptes}/${carcasse.nombre_d_animaux} acceptés)`;
  } else if (carcasse.nombre_d_animaux! > 1) {
    espece += ` (${carcasse.nombre_d_animaux})`;
  }
  let miseAMort = `Mise à mort\u00A0: ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
  if (carcasse.heure_mise_a_mort) {
    miseAMort += ` à ${carcasse.heure_mise_a_mort}`;
  }
  if (carcasse.heure_evisceration) {
    miseAMort += ` - Éviscération\u00A0: ${carcasse.heure_evisceration}`;
  }

  return (
    <Component
      key={carcasse?.updated_at ? dayjs(carcasse.updated_at).toISOString() : carcasse?.zacharie_carcasse_id}
      {...componentProps}
      className={[
        'bg-contrast-grey flex basis-full items-center justify-between border-0 p-4',
        status === 'refusé' && 'border-l-3! border-solid border-red-500!',
        isEcarteePourInspection && 'border-l-3! border-solid border-red-500!',
        isMiseEnConsigne && 'border-warning-main-525! border-l-3! border-solid',
        status === 'accepté' && 'border-action-high-blue-france! border-l-3! border-solid',
        status === 'saisie partielle' && 'border-action-high-blue-france! border-l-3! border-solid',
        // priseEnCharge && 'border-action-high-blue-france!',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col items-start justify-between text-left">
        <p className="text-base font-bold">{espece}</p>
        <p className="text-sm/4 font-bold">N° {carcasse.numero_bracelet}</p>
        {miseAMort && <p className="text-sm/4">{miseAMort}</p>}
        <p
          className={[
            'inline-flex items-center gap-1 text-sm first-letter:uppercase',
            status === 'en cours de traitement' &&
              !isEcarteePourInspection &&
              !isMiseEnConsigne &&
              'text-transparent!',
            isEcarteePourInspection && 'text-error-main-525 font-bold',
            isMiseEnConsigne && 'text-warning-main-525 font-bold',
            status === 'refusé' && 'text-error-main-525 font-bold',
            status === 'saisie partielle' && 'text-action-high-blue-france font-bold',
            status === 'accepté' && 'text-action-high-blue-france font-bold',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isMiseEnConsigne && (
            <span
              className="fr-icon-time-line fr-icon--sm shrink-0"
              aria-hidden="true"
            />
          )}
          {isEcarteePourInspection
            ? "Écarté par l'établissement de traitement pour inspection par le service vétérinaire"
            : isMiseEnConsigne
              ? miseEnConsigneLabel
              : status}
        </p>
        {!!carcasse.examinateur_anomalies_abats?.length && (
          <p className="mt-2 text-sm">
            Anomalies abats:
            <br />
            {carcasse.examinateur_anomalies_abats.map((anomalie) => {
              return (
                <span
                  className="m-0 ml-2 block font-bold"
                  key={anomalie}
                >
                  {anomalie}
                </span>
              );
            })}
          </p>
        )}
        {!!carcasse.examinateur_anomalies_carcasse?.length && (
          <p className="mt-2 text-sm">
            Anomalies carcasse:
            <br />
            {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
              return (
                <span
                  className="m-0 ml-2 block font-bold"
                  key={anomalie}
                >
                  {anomalie}
                </span>
              );
            })}
          </p>
        )}
        {commentairesIntermediaires.map((commentaire, index) => {
          return (
            <p
              key={commentaire + index}
              className="mt-2 block text-sm font-normal"
            >
              {commentaire}
            </p>
          );
        })}
        {carcasse.svi_ipm1_date && (
          <div
            className="mt-2 text-sm"
            key={JSON.stringify(carcasse.svi_ipm1_signed_at)}
          >
            <p className="m-0 font-bold">
              Inspection post mortem 1 du {dayjs(carcasse.svi_ipm1_date).format('DD/MM/YYYY')}&nbsp;:
            </p>
            {getIpm1Lines(carcasse).map((line) => (
              <p
                className="m-0"
                key={line}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        {carcasse.svi_ipm2_date && (
          <div
            className="mt-2 text-sm"
            key={JSON.stringify(carcasse.svi_ipm2_signed_at)}
          >
            <p className="m-0 font-bold">
              Inspection post mortem 2 du {dayjs(carcasse.svi_ipm2_date).format('DD/MM/YYYY')}&nbsp;:
            </p>
            {getIpm2Lines(carcasse).map((line) => (
              <p
                className="m-0"
                key={line}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        {carcasse.svi_carcasse_commentaire && (
          <>
            <br />
            <span className="m-0 block font-bold">Commentaire du SVI&nbsp;:</span>
            <span className="m-0 ml-2 block border-l-2 border-l-gray-400 pl-4 font-medium">
              {carcasse.svi_carcasse_commentaire.split('\n').map((line, index) => {
                return (
                  <span
                    key={line + index}
                    className="block"
                  >
                    {line}
                  </span>
                );
              })}
            </span>
          </>
        )}
      </div>
      {canClick && carcasse.svi_carcasse_status === CarcasseStatus.SANS_DECISION && (
        <div>
          <Button
            iconId="fr-icon-check-line"
            onClick={async (e) => {
              // la carte entière est un bouton qui navigue vers la carcasse : on ne veut que l'acceptation
              e.stopPropagation();
              const result = await approveCarcasse(carcasse);
              if (!result.ok) {
                alert(result.error);
              }
            }}
          >
            Accepter
          </Button>
        </div>
      )}
    </Component>
  );
}
