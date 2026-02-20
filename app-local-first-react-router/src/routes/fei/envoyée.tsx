import { useEffect, useMemo } from 'react';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import { useNavigate, useParams } from 'react-router';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import FeiStepper from '@app/components/FeiStepper';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createNewFei } from '@app/utils/create-new-fei';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';

export default function FeiEnvoyée() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const navigate = useNavigate();
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const carcasses = useCarcassesForFei(params.fei_numero);

  const isOnline = useIsOnline();

  // Group sent carcasses by recipient
  const sentByRecipient = useMemo(() => {
    const grouped: Record<string, { entityName: string; count: number }> = {};
    for (const c of carcasses) {
      if (!c.next_owner_entity_id) continue;
      if (!grouped[c.next_owner_entity_id]) {
        const entity = entities[c.next_owner_entity_id];
        grouped[c.next_owner_entity_id] = {
          entityName: entity?.nom_d_usage ?? c.next_owner_entity_id,
          count: 0,
        };
      }
      grouped[c.next_owner_entity_id].count++;
    }
    return Object.values(grouped);
  }, [carcasses, entities]);

  const unsendCarcasses = useMemo(() => {
    return carcasses.filter((c) => c.next_owner_entity_id == null);
  }, [carcasses]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  if (!fei) {
    return null;
  }
  return (
    <>
      <title>
        {`${params.fei_numero} | Zacharie | Ministere de l'Agriculture et de la Souverainete Alimentaire`}
      </title>
      {fei?.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimee</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0">
            <FeiStepper />
            <div className={['bg-white p-4 md:p-8'].join(' ')}>
              <div className="p-5">
                {sentByRecipient.map((recipient) => (
                  <Alert
                    key={recipient.entityName}
                    severity="success"
                    className="mb-4 bg-white"
                    description={`${recipient.entityName} (${recipient.count} carcasse${recipient.count > 1 ? 's' : ''}) ${fei?.is_synced ? 'a ete notifie' : !isOnline ? 'sera notifie des que vous aurez retrouve du reseau' : 'va etre notifie'}.`}
                    title="Attribution effectuee"
                  />
                ))}
                {sentByRecipient.length === 0 && fei?.fei_next_owner_entity_id && (
                  <Alert
                    severity="success"
                    className="bg-white"
                    description={`${entities[fei.fei_next_owner_entity_id]?.nom_d_usage ?? ''} ${fei?.is_synced ? 'a ete notifie' : !isOnline ? 'sera notifie des que vous aurez retrouve du reseau' : 'va etre notifie'}.`}
                    title="Attribution effectuee"
                  />
                )}
                {unsendCarcasses.length > 0 && (
                  <Alert
                    severity="warning"
                    className="mb-4 bg-white"
                    title={`${unsendCarcasses.length} carcasse${unsendCarcasses.length > 1 ? 's' : ''} non attribuee${unsendCarcasses.length > 1 ? 's' : ''}`}
                    description={
                      <Button
                        priority="secondary"
                        size="small"
                        className="mt-2"
                        linkProps={{
                          to: `/app/tableau-de-bord/fei/${params.fei_numero}`,
                        }}
                      >
                        Attribuer les carcasses restantes
                      </Button>
                    }
                  />
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
                    Retour a la fiche
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
