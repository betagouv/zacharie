import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { Carcasse, CarcasseStatus, CarcasseType, UserRoles } from '@prisma/client';
import { useMemo } from 'react';
import { CustomNotice } from '@app/components/CustomNotice';
import { CustomHighlight } from '@app/components/CustomHighlight';
import { formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, Link } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { getVulgarisationSaisie } from '@app/utils/get-vulgarisation-saisie';
import { getSimplifiedCarcasseStatus } from '@app/utils/get-carcasse-status';

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
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
          'transition-all duration-1000 mb-2',
          !canEdit ? 'max-h-0 overflow-hidden' : 'max-h-[300vh]',
        ].join(' ')}
      >
        <NouvelleCarcasse key={fei.commune_mise_a_mort} />
      </div>
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
      {canEdit ? (
        <CustomHighlight>
          {carcasses.map((carcasse) => {
            return <CarcasseExaminateur key={carcasse.numero_bracelet} carcasse={carcasse} />;
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

function CarcasseExaminateur({ carcasse }: { carcasse: Carcasse }) {
  // canEdit = true;
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const feisIntermediaires = useZustandStore((state) => state.feisIntermediaires);
  const fei = feis[params.fei_numero!];
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);

  const status: 'en cours' | 'refusé' | 'accepté' | null = useMemo(() => {
    if (
      fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL ||
      fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR
    ) {
      if (!fei.fei_next_owner_role) {
        return null;
      }
    }
    return getSimplifiedCarcasseStatus(carcasse);
  }, [carcasse, fei.fei_current_owner_role, fei.fei_next_owner_role]);

  const motifRefus: string = useMemo(() => {
    switch (carcasse.svi_carcasse_status) {
      default:
        return '';
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR: {
        const carcasseIntermediaire =
          feisIntermediaires[carcasse.intermediaire_carcasse_refus_intermediaire_id!];
        const entity = entities[carcasseIntermediaire.fei_intermediaire_entity_id!];
        const manquant = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Manquant' : 'Manquante';
        return `${manquant} au moment de la collecte par ${entity?.nom_d_usage}`;
      }
      case CarcasseStatus.MANQUANTE_SVI:
        return "Manquant(e) au moment de l'inspection par le service vétérinaire";
      case CarcasseStatus.REFUS_ETG_COLLECTEUR: {
        const carcasseIntermediaire =
          feisIntermediaires[carcasse.intermediaire_carcasse_refus_intermediaire_id!];
        const entity = entities[carcasseIntermediaire.fei_intermediaire_entity_id!];
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        let refus = `${refusé} par ${entity.nom_d_usage}`;
        if (carcasse.intermediaire_carcasse_refus_motif) {
          refus += ` : ${carcasse.intermediaire_carcasse_refus_motif}`;
        }
        return refus;
      }
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.SAISIE_PARTIELLE: {
        const refusé = carcasse.type === CarcasseType.PETIT_GIBIER ? 'Refusé' : 'Refusée';
        return `${refusé} par le service vétérinaire : ${carcasse.svi_ipm2_lesions_ou_motifs
          .map((motif) => getVulgarisationSaisie(motif, carcasse.type!))
          .join(', ')}`;
      }
    }
  }, [
    carcasse.svi_carcasse_status,
    carcasse.svi_ipm2_lesions_ou_motifs,
    carcasse.type,
    carcasse.intermediaire_carcasse_refus_motif,
    carcasse.intermediaire_carcasse_refus_intermediaire_id,
    entities,
    feisIntermediaires,
  ]);

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
          carcasse.type === CarcasseType.PETIT_GIBIER ? '!bg-gray-300' : '',
          status === 'refusé' && '!bg-red-500 text-white',
          status === 'accepté' && '!bg-action-high-blue-france text-white',
        ]
          .filter(Boolean)
          .join(' ')}
        isClosable={user.id === fei.examinateur_initial_user_id || user.id === fei.premier_detenteur_user_id}
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
        <Link
          to={
            !user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) && user.roles.includes(UserRoles.SVI)
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
              {fei?.date_mise_a_mort && (
                <span className="block font-normal mt-2 text-sm italic opacity-50">
                  Mise à mort&nbsp;: {dayjs(fei?.date_mise_a_mort).format('DD/MM/YYYY')}
                </span>
              )}
              {carcasse.heure_mise_a_mort && (
                <span className="block font-normal ">
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
          {motifRefus && <span className="mt-2 block font-normal">Motif de refus&nbsp;: {motifRefus}</span>}
        </Link>
      </CustomNotice>
    </div>
  );
}
