import { useEffect, useMemo } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import { useNavigate, useParams } from 'react-router';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createNewFei } from '@app/utils/create-new-fei';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { formatCarcasseLotCount } from '@app/utils/count-carcasses';
import useUser from '@app/zustand/user';
import SuccessSvg from '@app/assets/svg/success.svg';
import { CarcasseType, FeiOwnerRole, type Carcasse } from '@prisma/client';
import { useGetTransmissionsForFei } from '@app/utils/get-transmissions-sorted';

export default function ChasseurFeiEnvoyée() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const navigate = useNavigate();
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const fei = feis[params.fei_numero!];
  const carcasses = useCarcassesForFei(params.fei_numero);
  const isOnline = useIsOnline();
  const transmissions = useGetTransmissionsForFei(params.fei_numero!);

  const sentByRecipient = useMemo(() => {
    const grouped: Record<string, { entityId: string; entityName: string; carcasses: Array<Carcasse> }> = {};
    for (const transmission of transmissions) {
      if (!transmission.content.next_owner_entity_id) continue;
      if (!grouped[transmission.content.next_owner_entity_id]) {
        const entity = entities[transmission.content.next_owner_entity_id];
        grouped[transmission.content.next_owner_entity_id] = {
          entityId: transmission.content.next_owner_entity_id,
          entityName: entity?.nom_d_usage ?? transmission.content.next_owner_entity_id,
          carcasses: [],
        };
      }
      grouped[transmission.content.next_owner_entity_id].carcasses = transmission.carcasses;
    }
    return Object.values(grouped);
  }, [transmissions, entities]);

  const unsendTransmissions = useMemo(() => {
    return transmissions.filter(
      (t) =>
        t.content.next_owner_entity_id == null &&
        (t.content.current_owner_role == null ||
          t.content.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ||
          t.content.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL)
    );
  }, [transmissions]);

  const unsendCarcasses = useMemo(() => {
    if (!unsendTransmissions.length) return [];
    const _unsendCarcasses = [];
    for (const unsendTransmission of unsendTransmissions) {
      _unsendCarcasses.push(...unsendTransmission.carcasses);
    }
    return _unsendCarcasses;
  }, [unsendTransmissions]);

  // Quand l'examinateur transmet la fiche au premier détenteur (une personne, pas une entité),
  // il n'y a ni next_owner_entity_id ni fei_next_owner_entity_id : le PD devient directement
  // détenteur courant. On résout son nom pour afficher la confirmation de transmission.
  const premierDetenteurName = useMemo(() => {
    if (fei?.premier_detenteur_entity_id) {
      return entities[fei.premier_detenteur_entity_id]?.nom_d_usage ?? null;
    }
    if (fei?.premier_detenteur_user_id) {
      const pd = users[fei.premier_detenteur_user_id];
      const name = pd ? `${pd.prenom ?? ''} ${pd.nom_de_famille ?? ''}`.trim() : '';
      if (name) return name;
    }
    // Repli : nom mis en cache sur les carcasses au moment de la transmission au PD.
    return carcasses.find((c) => c.current_owner_user_name_cache)?.current_owner_user_name_cache ?? null;
  }, [fei, entities, users, carcasses]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  if (!fei) {
    return null;
  }
  return (
    <>
      <title>{`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {fei?.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france m-4 md:m-0 md:p-0">
            <div className="bg-white p-4 md:p-8">
              <div className="flex flex-col items-center gap-4 p-5 pt-0 text-center">
                <img
                  src={SuccessSvg}
                  alt="Fiche envoyée"
                  className="h-44 w-44"
                />
                {sentByRecipient.length === 1 && (
                  <>
                    <h1 className="fr-h4 fr-mb-0">
                      {singleDestinataireCaption(sentByRecipient[0].entityName, isOnline, fei?.is_synced)}
                    </h1>
                    <p className="fr-mb-0">({formatCarcasseLotCount(sentByRecipient[0].carcasses)})</p>
                  </>
                )}
                {sentByRecipient.length > 1 && (
                  <>
                    <h1 className="fr-h4 fr-mb-0">
                      {multiDestinatairesCaption(sentByRecipient.length, isOnline, fei?.is_synced)}
                    </h1>
                    <ul className="fr-mb-0 list-none p-0">
                      {sentByRecipient.map((recipient) => (
                        <li key={recipient.entityId}>
                          {recipient.entityName} ({formatCarcasseLotCount(recipient.carcasses)})
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {sentByRecipient.length === 0 && premierDetenteurName && (
                  <>
                    <h1 className="fr-h4 fr-mb-0">Votre fiche a été transmise à {premierDetenteurName}</h1>
                    <p className="fr-mb-0">({formatCarcasseLotCount(carcasses)})</p>
                  </>
                )}
                {unsendCarcasses.length > 0 &&
                  fei.premier_detenteur_user_id === user.id &&
                  (() => {
                    const hasLot = unsendCarcasses.some((c) => c.type === CarcasseType.PETIT_GIBIER);
                    const hasCarcasse = unsendCarcasses.some((c) => c.type !== CarcasseType.PETIT_GIBIER);
                    const isPlural = unsendCarcasses.length > 1;
                    const isFeminine = hasCarcasse && !hasLot;
                    const suffix = `${isFeminine ? 'e' : ''}${isPlural ? 's' : ''}`;
                    return (
                      <Alert
                        severity="warning"
                        className="w-full bg-white"
                        title={`${formatCarcasseLotCount(unsendCarcasses)} non attribué${suffix}`}
                        description={
                          <Button
                            priority="secondary"
                            size="small"
                            className="mt-2"
                            linkProps={{
                              to: `/app/chasseur/fei/${params.fei_numero}`,
                            }}
                          >
                            Attribuer les carcasses restantes
                          </Button>
                        }
                      />
                    );
                  })()}
              </div>
            </div>
            <div className="mt-4 flex w-full flex-col justify-between gap-4 md:flex-row">
              <Button
                priority="secondary"
                linkProps={{
                  to: `/app/chasseur/`,
                }}
                iconId="fr-icon-arrow-left-line"
              >
                Voir toutes les fiches
              </Button>
              {!!user.numero_cfei && (
                <Button
                  type="button"
                  // className="bg-white"
                  onClick={async () => {
                    const newFei = await createNewFei();
                    navigate(`/app/chasseur/fei/${newFei.numero}`);
                  }}
                  iconId="fr-icon-add-circle-line"
                >
                  Nouvelle fiche
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function singleDestinataireCaption(name: string, isOnline: boolean, isSynced: boolean) {
  if (isSynced) {
    return `${name} a été notifié de la transmission de votre fiche.`;
  } else if (!isOnline) {
    return `${name} sera notifié dès que vous aurez retrouvé du réseau.`;
  } else {
    return `${name} va être notifié de la transmission de votre fiche.`;
  }
}

function multiDestinatairesCaption(number: number, isOnline: boolean, isSynced: boolean) {
  if (isSynced) {
    return `Votre fiche a été transmise aux ${number} destinataires.`;
  } else if (!isOnline) {
    return `Votre fiche sera transmise aux ${number} destinataires dès que vous aurez retrouvé du réseau.`;
  } else {
    return `Votre fiche est en train d'être transmise aux ${number}`;
  }
}
