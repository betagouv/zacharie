import { useMemo } from 'react';
import {
  Carcasse,
  CarcasseStatus,
  CarcasseType,
  IPM1Decision,
  IPM1Protocole,
  IPM2Decision,
} from '@prisma/client';
import dayjs from 'dayjs';
import { CustomNotice } from '@app/components/CustomNotice';
import { useParams, Link } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';

interface CarcasseAVerifierProps {
  carcasse: Carcasse;
  canEdit: boolean;
}

export default function CarcasseSVI({ carcasse, canEdit }: CarcasseAVerifierProps) {
  // const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const params = useParams();

  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

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

  const Component = canEdit ? Link : 'div';

  const saisie = (
    [CarcasseStatus.SAISIE_PARTIELLE, CarcasseStatus.SAISIE_TOTALE] as CarcasseStatus[]
  ).includes(carcasse.svi_carcasse_status!);

  return (
    <div
      key={carcasse?.updated_at ? dayjs(carcasse.updated_at).toISOString() : carcasse?.zacharie_carcasse_id}
      className={[
        'border-4 border-transparent',
        saisie && '!border-red-500',
        // priseEnCharge && '!border-action-high-blue-france',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={`${carcasse.type === CarcasseType.PETIT_GIBIER ? '!bg-gray-300' : ''}`}
      >
        <Component
          className="block w-full p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
          to={
            canEdit ? `/app/tableau-de-bord/carcasse-svi/${fei.numero}/${carcasse.zacharie_carcasse_id}` : ''
          }
        >
          <span className="block font-bold">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
          </span>
          <span className="block font-normal">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : 'Numéro de bracelet'}
            &nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span>
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || 'À REMPLIR'}
            </span>
          )}
          {carcasse.heure_mise_a_mort && (
            <span className="block font-normal">
              Mise à mort&nbsp;: {carcasse.heure_mise_a_mort || 'À REMPLIR'}
            </span>
          )}
          {carcasse.heure_evisceration && (
            <span className="block font-normal">
              Éviscération&nbsp;: {carcasse.heure_evisceration || 'À REMPLIR'}
            </span>
          )}
          {!!carcasse.examinateur_anomalies_abats?.length && (
            <>
              <br />
              <span className="m-0 block font-bold">Anomalies abats:</span>
              {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                return (
                  <>
                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                  </>
                );
              })}
            </>
          )}
          {!!carcasse.examinateur_anomalies_carcasse?.length && (
            <>
              <br />
              <span className="m-0 block font-bold">Anomalies carcasse:</span>
              {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                return (
                  <>
                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                  </>
                );
              })}
            </>
          )}
          {commentairesIntermediaires.map((commentaire, index) => {
            return (
              <span key={commentaire + index} className="mt-2 block font-normal">
                {commentaire}
              </span>
            );
          })}
          <br />
          {carcasse.svi_ipm1_date && (
            <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_ipm1_signed_at)}>
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
            </span>
          )}
          <br />
          {carcasse.svi_ipm2_date && (
            <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_ipm2_signed_at)}>
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
                    {carcasse.svi_ipm2_decision === IPM2Decision.LEVEE_DE_LA_CONSIGNE &&
                      'Levée de la consigne'}
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
                      - Température de congélation :{' '}
                      {carcasse.svi_ipm2_traitement_assainissant_congelation_temp}
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
                    <span className="m-0 ml-6 block font-medium">
                      - Poids : {carcasse.svi_ipm2_poids_saisie}
                    </span>
                  )}
                </>
              )}
            </span>
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
      </CustomNotice>
    </div>
  );
}
