import { useEffect, useMemo } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import { useNavigate, useParams } from 'react-router';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import FeiStepper from '@app/components/FeiStepper';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createNewFei } from '@app/utils/create-new-fei';

export default function FeiEnvoyée() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const navigate = useNavigate();
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const users = useZustandStore((state) => state.users);

  const isOnline = useIsOnline();

  const nextOwnerUserOrEntityId = fei?.fei_next_owner_user_id ?? fei?.fei_next_owner_entity_id ?? '';

  const { nextOwnerUser, nextOwnerEntity } = useMemo(() => {
    const _nextOwner = users[nextOwnerUserOrEntityId];
    if (_nextOwner) {
      return { nextOwnerUser: _nextOwner, nextOwnerEntity: null };
    }
    const _nextEntity = entities[nextOwnerUserOrEntityId];
    if (_nextEntity) {
      return { nextOwnerUser: null, nextOwnerEntity: _nextEntity };
    }
    return { nextOwnerUser: null, nextOwnerEntity: null };
  }, [users, entities, nextOwnerUserOrEntityId]);

  const nextOwnerName = useMemo(() => {
    if (nextOwnerUser) {
      return `${nextOwnerUser.prenom} ${nextOwnerUser.nom_de_famille}`;
    }
    if (nextOwnerEntity) {
      return nextOwnerEntity.nom_d_usage;
    }
    return '';
  }, [nextOwnerUser, nextOwnerEntity]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  if (!fei) {
    return null;
  }
  return (
    <>
      <title>
        {`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      {fei?.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0">
            <FeiStepper />
            <div className={['bg-white p-4 md:p-8'].join(' ')}>
              <div className="p-5">
                {nextOwnerName &&
                  (fei?.fei_next_owner_user_id === nextOwnerUser?.id ||
                    fei?.fei_next_owner_entity_id === nextOwnerEntity?.id) && (
                    <>
                      <Alert
                        severity="success"
                        className="bg-white"
                        description={`${nextOwnerName} ${fei?.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
                        title="Attribution effectuée"
                      />
                    </>
                  )}
                <div className="mt-8 flex flex-col justify-start gap-4">
                  <Button
                    linkProps={{
                      to: `/app/tableau-de-bord/`,
                    }}
                  >
                    Voir toutes mes fiches
                  </Button>
                  <Button
                    type="button"
                    priority="secondary"
                    className="bg-white"
                    onClick={async () => {
                      const newFei = await createNewFei();
                      navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
                    }}
                  >
                    Nouvelle fiche
                  </Button>
                  <Button
                    priority="tertiary"
                    className="bg-white"
                    linkProps={{
                      to: `/app/tableau-de-bord/fei/${params.fei_numero}`,
                    }}
                  >
                    Retour à la fiche
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
