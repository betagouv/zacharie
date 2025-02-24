import { useMemo } from 'react';
import { Carcasse, CarcasseType, IPM1Decision, IPM1Protocole } from '@prisma/client';
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

  const priseEnCharge = !carcasse.svi_carcasse_saisie;
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

  return (
    <div
      key={carcasse?.updated_at ? dayjs(carcasse.updated_at).toISOString() : carcasse?.zacharie_carcasse_id}
      className={[
        'border-4 border-transparent',
        !!carcasse.svi_carcasse_saisie?.length && '!border-red-500',
        !!canEdit && priseEnCharge && '!border-action-high-blue-france',
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
            <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_carcasse_saisie_motif)}>
              SVI Inspection Post Mortem 1 du {dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}&nbsp;:
              <br />
              <span className="m-0 ml-2 block font-medium">
                - Protocole :{' '}
                {carcasse.svi_ipm1_protocole === IPM1Protocole.RENFORCE ? 'Renforcé' : 'Standard'}
              </span>
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
              <span className="m-0 ml-2 block font-medium">- Pièces observées&nbsp;:</span>
              {carcasse.svi_ipm1_pieces.map((piece, index) => {
                return (
                  <span className="m-0 ml-6 block font-medium" key={piece + index}>
                    - {piece}
                  </span>
                );
              })}
              <span className="m-0 ml-2 block font-medium">- Lésions ou motifs de consigne&nbsp;:</span>
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
