import { useMemo } from 'react';
import { useParams } from 'react-router';
import { CarcasseType, type Carcasse } from '@prisma/client';
import { CustomNotice } from '@app/components/CustomNotice';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';

interface CarcasseIntermediaireProps {
  carcasse: Carcasse;
}

export default function CollecteurCarcassePreview({ carcasse }: CarcasseIntermediaireProps) {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

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
      const _carcasseIntermediaire = state.carcassesIntermediaires[carcasseIntermediaireId];
      const _intermediaireEntity = state.entities[_intermediaire.fei_intermediaire_entity_id];
      if (_carcasseIntermediaire?.commentaire) {
        commentaires.push(
          `Commentaire de ${_intermediaireEntity?.nom_d_usage} : ${_carcasseIntermediaire?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [intermediaires, fei.numero, carcasse.numero_bracelet, state.carcassesIntermediaires, state.entities]);

  return (
    <div
      key={carcasse.numero_bracelet}
      className={['mb-2 border-4 border-transparent'].filter(Boolean).join(' ')}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={[`${carcasse.type === CarcasseType.PETIT_GIBIER ? '!bg-gray-300' : ''}`]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="block w-full p-8 text-left [&_*]:no-underline [&_*]:hover:no-underline">
          <span className="block font-bold text-3xl mb-4">
            {/* {carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : 'Numéro de bracelet'} */}
            {/* &nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span> */}
            {carcasse.numero_bracelet}
          </span>
          <span className="block font-bold text-2xl">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || 'À REMPLIR'}
            </span>
          )}
          {carcasse.intermediaire_carcasse_manquante && (
            <span className="ml-4 mt-4 block font-bold">Carcasse manquante</span>
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
        </div>
      </CustomNotice>
    </div>
  );
}
