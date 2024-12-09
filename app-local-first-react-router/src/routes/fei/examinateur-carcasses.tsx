import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { CarcasseType, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import { CustomNotice } from '@app/components/CustomNotice';
import { CustomHighlight } from '@app/components/CustomHighlight';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses-by-espece';
import { useParams, Link } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
  // canEdit = true;
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  // console.log('fei', fei);
  const carcasses = (state.carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => state.carcasses[cId])
    .filter((c) => !c.deleted_at);
  const updateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  return (
    <>
      <CustomHighlight>
        {carcasses.map((carcasse) => {
          // const examinationNotFinished =
          //   !carcasse.examinateur_anomalies_abats?.length &&
          //   !carcasse.examinateur_anomalies_carcasse?.length &&
          // !carcasse.examinateur_carcasse_sans_anomalie;
          // const missingFields =
          //   !carcasse.espece || !carcasse.categorie || !carcasse.heure_mise_a_mort || !carcasse.heure_evisceration;
          // const missingFields = !carcasse.espece || !carcasse.categorie;
          return (
            <CustomNotice
              key={carcasse.numero_bracelet}
              className={`mb-2 ${carcasse.type === CarcasseType.PETIT_GIBIER ? '!bg-gray-300' : ''}`}
              isClosable={
                user.id === fei.examinateur_initial_user_id || user.id === fei.premier_detenteur_user_id
              }
              onClose={() => {
                if (
                  window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')
                ) {
                  const nextPartialCarcasse = {
                    deleted_at: dayjs().toDate(),
                  };
                  updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                  addLog({
                    user_id: user.id,
                    user_role: UserRoles.EXAMINATEUR_INITIAL,
                    fei_numero: fei.numero,
                    action: 'examinateur-carcasse-delete',
                    history: createHistoryInput(carcasse, nextPartialCarcasse),
                    entity_id: null,
                    zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                    fei_intermediaire_id: null,
                    carcasse_intermediaire_id: null,
                  });
                }
              }}
            >
              <Link
                to={
                  user.roles.includes(UserRoles.SVI)
                    ? `/app/tableau-de-bord/carcasse-svi/${fei.numero}/${carcasse.zacharie_carcasse_id}`
                    : `/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`
                }
                className="block w-full bg-none p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
              >
                {carcasse.espece ? (
                  <>
                    <span className="block font-bold">
                      {carcasse.espece}
                      {carcasse.categorie && ` - ${carcasse.categorie}`}
                    </span>
                    <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
                      {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Grand gibier'}
                    </span>
                    <span className="block font-normal">
                      {carcasse.type === CarcasseType.PETIT_GIBIER
                        ? "Numéro d'identification"
                        : 'Numéro de bracelet'}
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
                            <span className="m-0 ml-2 block font-bold" key={anomalie}>
                              {anomalie}
                            </span>
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
                            <span className="m-0 ml-2 block font-bold" key={anomalie}>
                              {anomalie}
                            </span>
                          );
                        })}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="block font-bold md:-mt-4">Nouveau lot de carcasse(s) à examiner</span>
                    <span className="block font-normal">
                      {carcasse.type === CarcasseType.PETIT_GIBIER
                        ? "Numéro d'identification"
                        : 'Numéro de bracelet'}
                      &nbsp;: {carcasse.numero_bracelet}
                    </span>
                    <span className="fr-btn mt-2 block md:-mb-4">Examiner</span>
                  </>
                )}
              </Link>
            </CustomNotice>
          );
        })}
      </CustomHighlight>
      <div
        className={[
          'transition-all duration-1000',
          !canEdit ? 'max-h-0 overflow-hidden' : 'max-h-[300vh]',
        ].join(' ')}
      >
        {carcasses.length > 0 && <hr />}
        {carcasses.length > 0 && (
          <p className="-mt-4 mb-4 ml-4 text-sm text-gray-500">
            Déjà rentrés&nbsp;:
            {countCarcassesByEspece.map((line) => (
              <span className="ml-4 block" key={line}>
                {line}
              </span>
            ))}
          </p>
        )}
        <NouvelleCarcasse key={fei.commune_mise_a_mort} />
      </div>
    </>
  );
}
