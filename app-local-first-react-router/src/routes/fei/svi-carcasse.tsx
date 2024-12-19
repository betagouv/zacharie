import { useMemo, useState } from 'react';
import { Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import { CustomNotice } from '@app/components/CustomNotice';
import { useParams, Link } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import useUser from '@app/zustand/user';
import { createHistoryInput } from '@app/utils/create-history-entry';

interface CarcasseAVerifierProps {
  carcasse: Carcasse;
  canEdit: boolean;
}

export default function CarcasseSVI({ carcasse, canEdit }: CarcasseAVerifierProps) {
  // const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);
  const updateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;
  const [motifsSaisie, setMotifsSaisie] = useState(
    carcasse?.svi_carcasse_saisie_motif?.filter(Boolean) ?? [],
  );
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
          <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_carcasse_saisie_motif)}>
            Inspection SVI&nbsp;:
            {carcasse.svi_carcasse_saisie.length > 0 ? (
              <>
                {carcasse.svi_carcasse_saisie.map((type, index, svi_carcasse_saisie) => {
                  if (index === 0) {
                    // Saisie totale ou saisie partielle
                    return (
                      <span className="m-0 ml-2 block font-medium" key={type + index}>
                        {type}
                      </span>
                    );
                  }
                  if (svi_carcasse_saisie[0] === 'Saisie partielle') {
                    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
                      const nombreAnimaux = type;
                      return (
                        <span className="m-0 ml-2 block font-medium" key={type + index}>
                          - {nombreAnimaux} animaux
                        </span>
                      );
                    }
                  }
                  return (
                    <span className="m-0 ml-2 block font-medium" key={type + index}>
                      - {type}
                    </span>
                  );
                })}
                <>
                  {motifsSaisie.map((motif, index) => {
                    if (canEdit) {
                      return (
                        <span
                          className="m-0 ml-2 flex items-center justify-between border-b border-b-gray-300 font-medium"
                          key={motif + index}
                        >
                          - {motif}
                          <button
                            className="block px-4 py-1 font-medium"
                            title="Supprimer"
                            key={motif + index}
                            onClick={() => {
                              const nextMotifsSaisie = motifsSaisie.filter(
                                (motifSaisie) => motifSaisie !== motif,
                              );
                              setMotifsSaisie((motifsSaisie) => {
                                return motifsSaisie.filter((motifSaisie) => motifSaisie !== motif);
                              });
                              let nextPartialCarcasse: Partial<Carcasse>;
                              if (nextMotifsSaisie.length) {
                                nextPartialCarcasse = {
                                  svi_carcasse_saisie_motif: nextMotifsSaisie,
                                  svi_carcasse_saisie_at: dayjs().toDate(),
                                  svi_carcasse_signed_at: dayjs().toDate(),
                                };
                              } else {
                                nextPartialCarcasse = {
                                  svi_carcasse_saisie_motif: [],
                                  svi_carcasse_saisie: [],
                                  svi_carcasse_saisie_at: null,
                                  svi_carcasse_signed_at: dayjs().toDate(),
                                };
                              }
                              updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                              addLog({
                                user_id: user.id,
                                user_role: UserRoles.SVI,
                                fei_numero: fei.numero,
                                action: 'svi-carcasse-motif-delete',
                                history: createHistoryInput(carcasse, nextPartialCarcasse),
                                entity_id: fei.svi_entity_id,
                                zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                                fei_intermediaire_id: null,
                                carcasse_intermediaire_id: null,
                              });
                            }}
                          >
                            {`\u0078`}
                          </button>
                        </span>
                      );
                    }
                    return (
                      <span className="m-0 ml-2 block font-medium" key={motif + index}>
                        - {motif}
                      </span>
                    );
                  })}
                </>
              </>
            ) : (
              <span className="m-0 ml-2 block font-medium">- Pas de saisie</span>
            )}
          </span>
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
