import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import { CustomNotice } from '@app/components/CustomNotice';
import { CustomHighlight } from '@app/components/CustomHighlight';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
}) {
  // canEdit = true;
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const allCarcasses = useZustandStore((state) => state.carcasses);
  // console.log('fei', fei);
  const carcasses = (carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => allCarcasses[cId])
    .filter((c) => !c.deleted_at);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  return (
    <>
      <div
        className={[
          'mb-2 transition-all duration-1000',
          !canEdit ? 'max-h-0 overflow-hidden' : 'max-h-[300vh]',
        ].join(' ')}
      >
        <NouvelleCarcasse key={fei.commune_mise_a_mort} />
      </div>
      {carcasses.length > 0 && (
        <p className="mb-4 ml-4 text-sm text-gray-500">
          Déjà rentrés&nbsp;:
          {countCarcassesByEspece.map((line) => (
            <span className="ml-4 block" key={line}>
              {line}
            </span>
          ))}
        </p>
      )}
      {canEdit || canEditAsPremierDetenteur ? (
        <CustomHighlight>
          {carcasses.map((carcasse) => {
            return (
              <CarcasseExaminateur
                key={carcasse.numero_bracelet}
                carcasse={carcasse}
                canEditAsPremierDetenteur={canEditAsPremierDetenteur}
              />
            );
          })}
        </CustomHighlight>
      ) : (
        <>
          {carcasses.map((carcasse) => {
            return <CarcasseExaminateur key={carcasse.numero_bracelet} carcasse={carcasse} />;
          })}
        </>
      )}
    </>
  );
}

export function CarcasseExaminateur({
  carcasse,
  canEditAsPremierDetenteur,
  canEditAsExaminateurInitial,
}: {
  carcasse: Carcasse;
  canEditAsPremierDetenteur?: boolean;
  canEditAsExaminateurInitial?: boolean;
}) {
  // canEdit = true;
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const navigate = useNavigate();

  const { status, motifRefus } = useCarcasseStatusAndRefus(carcasse, fei);

  return (
    <div
      key={carcasse.numero_bracelet}
      className={[
        'mb-2 border-4 border-transparent',
        status === 'refusé' && '!border-red-500 *:!border-b-0',
        status === 'accepté' && '!border-action-high-blue-france *:!border-b-0',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={[
          status === 'refusé' && '!bg-error-main-525 text-white',
          status === 'accepté' && '!bg-action-high-blue-france text-white',
        ]
          .filter(Boolean)
          .join(' ')}
        isClosable={canEditAsPremierDetenteur || canEditAsExaminateurInitial}
        onClose={() => {
          if (window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')) {
            const nextPartialCarcasse: Partial<Carcasse> = {
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
        <button
          type="button"
          onClick={() => {
            if (canEditAsExaminateurInitial || canEditAsPremierDetenteur) {
              navigate(`/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.zacharie_carcasse_id}`);
            }
          }}
          className={[
            'block w-full bg-none p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline',
            canEditAsExaminateurInitial || canEditAsPremierDetenteur ? '' : 'pointer-events-none',
          ].join(' ')}
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
              {fei?.date_mise_a_mort && (
                <span className="mt-2 block text-sm font-normal italic opacity-50">
                  Mise à mort&nbsp;: {dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY')}
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
          {status && (
            <span className="ml-4 mt-4 block font-bold">
              {carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot' : 'Carcasse'} {status}
              {status !== 'en cours' && (carcasse.type === CarcasseType.PETIT_GIBIER ? '' : 'e')}
            </span>
          )}
          {motifRefus && <span className="mt-2 block font-normal">{motifRefus}</span>}
        </button>
      </CustomNotice>
    </div>
  );
}
