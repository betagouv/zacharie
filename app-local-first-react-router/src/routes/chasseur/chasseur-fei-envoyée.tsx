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

export default function ChasseurFeiEnvoyée() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const navigate = useNavigate();
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const carcasses = useCarcassesForFei(params.fei_numero);
  const isOnline = useIsOnline();

  const notificationStatus = fei?.is_synced
    ? 'a été notifié'
    : !isOnline
      ? 'sera notifié dès que vous aurez retrouvé du réseau'
      : 'va être notifié';

  const sentByRecipient = useMemo(() => {
    const grouped: Record<string, { entityId: string; entityName: string; carcasses: Array<Carcasse> }> = {};
    for (const c of carcasses) {
      if (!c.next_owner_entity_id) continue;
      if (!grouped[c.next_owner_entity_id]) {
        const entity = entities[c.next_owner_entity_id];
        grouped[c.next_owner_entity_id] = {
          entityId: c.next_owner_entity_id,
          entityName: entity?.nom_d_usage ?? c.next_owner_entity_id,
          carcasses: [],
        };
      }
      grouped[c.next_owner_entity_id].carcasses.push(c);
    }
    return Object.values(grouped);
  }, [carcasses, entities]);

  const unsendCarcasses = useMemo(() => {
    // Une carcasse n'est « non attribuée » que si elle n'a pas de prochain détenteur ET qu'elle
    // est encore détenue par le PD/examinateur. Si elle a déjà été reçue/avancée (next_owner
    // remis à null, current_owner_role passé à ETG/collecteur…), elle est bien attribuée.
    // Même définition que `carcassesRestantes` dans premier-detenteur-select-next.tsx.
    return carcasses.filter(
      (c) =>
        c.next_owner_entity_id == null &&
        (c.current_owner_role == null ||
          c.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ||
          c.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL)
    );
  }, [carcasses]);

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
                      Votre fiche a été transmise à {sentByRecipient[0].entityName}
                    </h1>
                    <p className="fr-mb-0">({formatCarcasseLotCount(sentByRecipient[0].carcasses)})</p>
                  </>
                )}
                {sentByRecipient.length > 1 && (
                  <>
                    <h1 className="fr-h4 fr-mb-0">
                      Votre fiche a été transmise aux {sentByRecipient.length} destinataires.
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
                {sentByRecipient.length === 0 && fei?.fei_next_owner_entity_id && (
                  <p className="fr-mb-0">
                    <span
                      className="fr-icon-arrow-right-s-line fr-icon--sm mr-1"
                      aria-hidden="true"
                    />
                    {entities[fei.fei_next_owner_entity_id]?.nom_d_usage ?? ''} — {notificationStatus}
                  </p>
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
              {!!user.numero_cfei && user.activated && (
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
