import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from '@app/routes/fei/donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import useZustandStore from '@app/zustand/store';
import { loadFei } from '@app/utils/load-fei';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from '@app/utils/load-my-relations';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import { Button } from '@codegouvfr/react-dsfr/Button';

export default function CircuitCourtFeiLoader() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refreshUser('connexion')
      .then(loadMyRelations)
      .then(() => loadFei(params.fei_numero!))
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CircuitCourtFei key={fei.numero} />;
}

function CircuitCourtFei() {
  const params = useParams();
  const myCarcasses = useMyCarcassesForFei(params.fei_numero);
  const allCarcassesForFei = useMemo(() => myCarcasses.sort(sortCarcassesApproved), [myCarcasses]);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  return (
    <>
      <title>{`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {fei.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div
            className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0"
            key={fei.fei_current_owner_entity_id! + fei.fei_current_owner_user_id!}
          >
            <h1 className="fr-h3 fr-mb-2w">Fiche {fei?.numero}</h1>
            <Section open={false} title="Données de chasse">
              <FEIDonneesDeChasse />
            </Section>
            <Section title={`Carcasses (${allCarcassesForFei.length})`}>
              <div className="flex flex-col gap-4">
                {allCarcassesForFei.map((carcasse) => {
                  return <CardCarcasse carcasse={carcasse} key={carcasse.numero_bracelet} />;
                })}
              </div>
            </Section>
            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                priority="secondary"
                linkProps={{
                  to: `/app/tableau-de-bord/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
