import { useMemo } from 'react';
import { Carcasse, CarcasseType, IPM1Decision, IPM2Decision } from '@prisma/client';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { getSimplifiedCarcasseStatus } from '@app/utils/get-carcasse-status';

interface CarcasseAVerifierProps {
  carcasse: Carcasse;
  canClick: boolean;
}

export default function CardCarcasseSvi({ carcasse, canClick }: CarcasseAVerifierProps) {
  // const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const params = useParams();
  const navigate = useNavigate();

  const state = useZustandStore((state) => state);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const getCarcassesIntermediairesForCarcasse = useZustandStore(
    (state) => state.getCarcassesIntermediairesForCarcasse,
  );
  const carcasseIntermediaires = getCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const carcasseIntermediaire of carcasseIntermediaires) {
      if (carcasseIntermediaire?.commentaire) {
        const intermediaireEntity = state.entities[carcasseIntermediaire.intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage} : ${carcasseIntermediaire?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcasseIntermediaires, state.entities]);

  const Component = canClick ? 'button' : 'div';
  const componentProps = canClick
    ? {
        type: 'button' as const,
        onClick: () => {
          navigate(`/app/tableau-de-bord/carcasse-svi/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
        },
      }
    : {};

  const status = getSimplifiedCarcasseStatus(carcasse);

  let espece = carcasse.espece;
  if (carcasse.nombre_d_animaux! > 1) espece = espece += ` (${carcasse.nombre_d_animaux})`;
  let miseAMort = `Mise à mort : ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
  if (carcasse.heure_mise_a_mort) {
    miseAMort += ` à ${carcasse.heure_mise_a_mort}`;
  }
  if (carcasse.heure_evisceration) {
    miseAMort += ` - Éviscération : ${carcasse.heure_evisceration}`;
  }

  return (
    <Component
      key={carcasse?.updated_at ? dayjs(carcasse.updated_at).toISOString() : carcasse?.zacharie_carcasse_id}
      {...componentProps}
      className={[
        'flex basis-full flex-col items-start justify-between border-0 bg-contrast-grey p-4 text-left',
        status === 'refusé' && '!border-l-3 border-solid !border-red-500',
        status === 'accepté' && '!border-l-3 border-solid !border-action-high-blue-france',
        // priseEnCharge && '!border-action-high-blue-france',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-base font-bold">{espece}</p>
      <p className="text-sm/4font-bold">N° {carcasse.numero_bracelet}</p>
      {miseAMort && <p className="text-sm/4">{miseAMort}</p>}
      <p
        className={[
          'text-sm first-letter:uppercase',
          status === 'en cours de traitement' && '!text-transparent',
          status === 'refusé' && 'font-bold text-error-main-525',
          status === 'accepté' && 'font-bold text-action-high-blue-france',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {status}
      </p>
      {!!carcasse.examinateur_anomalies_abats?.length && (
        <p className="mt-2 text-sm">
          Anomalies abats:
          <br />
          {carcasse.examinateur_anomalies_abats.map((anomalie) => {
            return (
              <span className="m-0 ml-2 block font-bold" key={anomalie}>
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
              <span className="m-0 ml-2 block font-bold" key={anomalie}>
                {anomalie}
              </span>
            );
          })}
        </p>
      )}
      {commentairesIntermediaires.map((commentaire, index) => {
        return (
          <p key={commentaire + index} className="mt-2 block text-sm font-normal">
            {commentaire}
          </p>
        );
      })}
      {carcasse.svi_ipm1_date && (
        <p className="m-0 mt-2 block text-sm font-bold" key={JSON.stringify(carcasse.svi_ipm1_signed_at)}>
          SVI Inspection Post Mortem 1 du {dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}&nbsp;:
          <br />
          {!carcasse.svi_ipm1_presentee_inspection ? (
            <span className="m-0 ml-2 block font-medium">- Carcasse manquante</span>
          ) : (
            <>
              {carcasse.type === CarcasseType.PETIT_GIBIER && (
                <span className="m-0 ml-2 block font-medium">
                  - Nombre d'animaux : {carcasse.svi_ipm1_nombre_animaux}
                </span>
              )}
              {carcasse.svi_ipm1_commentaire && (
                <span className="m-0 ml-2 block font-medium">
                  - Commentaire : {carcasse.svi_ipm1_commentaire}
                </span>
              )}
              {!!carcasse.svi_ipm1_pieces.length && (
                <span className="m-0 ml-2 block font-medium">- Pièces observées&nbsp;:</span>
              )}
              {carcasse.svi_ipm1_pieces.map((piece, index) => {
                return (
                  <span className="m-0 ml-6 block font-medium" key={piece + index}>
                    - {piece}
                  </span>
                );
              })}
              {!!carcasse.svi_ipm1_lesions_ou_motifs.length && (
                <span className="m-0 ml-2 block font-medium">- Lésions ou motifs de consigne&nbsp;:</span>
              )}
              {carcasse.svi_ipm1_lesions_ou_motifs.map((type, index) => {
                return (
                  <span className="m-0 ml-6 block font-medium" key={type + index}>
                    - {type}
                  </span>
                );
              })}
              <span className="m-0 ml-2 block font-medium">
                - Décision IPM1 :{' '}
                {carcasse.svi_ipm1_decision === IPM1Decision.NON_RENSEIGNEE
                  ? 'Non renseigné'
                  : 'Mise en consigne'}
              </span>
              {carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE && (
                <span className="m-0 ml-2 block font-medium">
                  - Durée de la consigne : {carcasse.svi_ipm1_duree_consigne} heures
                </span>
              )}
              {carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE &&
                carcasse.svi_ipm1_poids_consigne && (
                  <span className="m-0 ml-2 block font-medium">
                    - Poids de la consigne : {carcasse.svi_ipm1_poids_consigne}kg
                  </span>
                )}
            </>
          )}
        </p>
      )}
      {carcasse.svi_ipm2_date && (
        <p className="m-0 mt-2 block text-sm font-bold" key={JSON.stringify(carcasse.svi_ipm2_signed_at)}>
          SVI Inspection Post Mortem 2 du {dayjs(carcasse.svi_ipm2_date).format('DD-MM-YYYY')}&nbsp;:
          <br />
          {!carcasse.svi_ipm2_presentee_inspection ? (
            <span className="m-0 ml-2 block font-medium">- Carcasse manquante</span>
          ) : (
            <>
              {carcasse.type === CarcasseType.PETIT_GIBIER && (
                <span className="m-0 ml-2 block font-medium">
                  - Nombre d'animaux : {carcasse.svi_ipm2_nombre_animaux}
                </span>
              )}
              {carcasse.svi_ipm2_commentaire && (
                <span className="m-0 ml-2 block font-medium">
                  - Commentaire : {carcasse.svi_ipm2_commentaire}
                </span>
              )}
              {!!carcasse.svi_ipm2_pieces.length && (
                <span className="m-0 ml-2 block font-medium">- Pièces observées&nbsp;:</span>
              )}
              {carcasse.svi_ipm2_pieces.map((piece, index) => {
                return (
                  <span className="m-0 ml-6 block font-medium" key={piece + index}>
                    - {piece}
                  </span>
                );
              })}
              {!!carcasse.svi_ipm2_lesions_ou_motifs.length && (
                <span className="m-0 ml-2 block font-medium">- Lésions ou motifs de consigne&nbsp;:</span>
              )}
              {carcasse.svi_ipm2_lesions_ou_motifs.map((type, index) => {
                return (
                  <span className="m-0 ml-6 block font-medium" key={type + index}>
                    - {type}
                  </span>
                );
              })}
              <span className="m-0 ml-2 block font-medium">
                - Décision IPM2 :{' '}
                {carcasse.svi_ipm2_decision === IPM2Decision.LEVEE_DE_LA_CONSIGNE && 'Levée de la consigne'}
                {carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE && 'Saisie totale'}
                {carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE && 'Saisie partielle'}
                {carcasse.svi_ipm2_decision === IPM2Decision.TRAITEMENT_ASSAINISSANT &&
                  'Traitement assainissant'}
              </span>
              {carcasse.svi_ipm2_traitement_assainissant_cuisson_temps && (
                <span className="m-0 ml-6 block font-medium">
                  - Temps de cuisson : {carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_cuisson_temp && (
                <span className="m-0 ml-6 block font-medium">
                  - Température de cuisson : {carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_congelation_temps && (
                <span className="m-0 ml-6 block font-medium">
                  - Temps de congélation : {carcasse.svi_ipm2_traitement_assainissant_congelation_temps}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_congelation_temp && (
                <span className="m-0 ml-6 block font-medium">
                  - Température de congélation : {carcasse.svi_ipm2_traitement_assainissant_congelation_temp}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_type && (
                <span className="m-0 ml-6 block font-medium">
                  - Type de traitement : {carcasse.svi_ipm2_traitement_assainissant_type}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_paramètres && (
                <span className="m-0 ml-6 block font-medium">
                  - Paramètres : {carcasse.svi_ipm2_traitement_assainissant_paramètres}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_etablissement && (
                <span className="m-0 ml-6 block font-medium">
                  - Établissement désigné pour réaliser le traitement assainissant :{' '}
                  {carcasse.svi_ipm2_traitement_assainissant_etablissement}
                </span>
              )}
              {carcasse.svi_ipm2_traitement_assainissant_poids && (
                <span className="m-0 ml-6 block font-medium">
                  - Poids : {carcasse.svi_ipm2_traitement_assainissant_poids}
                </span>
              )}
              {carcasse.svi_ipm2_poids_saisie && (
                <span className="m-0 ml-6 block font-medium">- Poids : {carcasse.svi_ipm2_poids_saisie}</span>
              )}
            </>
          )}
        </p>
      )}
      {carcasse.svi_carcasse_commentaire && (
        <>
          <br />
          <span className="m-0 block font-bold">Commentaire du SVI&nbsp;:</span>
          <span className="m-0 ml-2 block border-l-2 border-l-gray-400 pl-4 font-medium">
            {carcasse.svi_carcasse_commentaire}
          </span>
        </>
      )}
    </Component>
  );
}
