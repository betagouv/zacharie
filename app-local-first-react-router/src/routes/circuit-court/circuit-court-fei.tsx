import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from '@app/components/DonneesDeChasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import useZustandStore from '@app/zustand/store';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';

export default function CircuitCourtFeiLoader() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);
  useLoaderEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData('circuit-court-fei')
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CircuitCourtFei key={fei.numero} />;
}

function CircuitCourtFei() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const transmissionWithMetadata = useGetTransmissionFromURLParams();
  const myCarcasses = transmissionWithMetadata.carcasses;
  const allCarcassesForFei = useMemo(() => [...myCarcasses].sort(sortCarcassesApproved), [myCarcasses]);

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
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0">
            <h1 className="fr-h3 fr-mb-2w">Fiche {fei?.numero}</h1>
            <Section
              open={false}
              title="Données de chasse"
            >
              <FEIDonneesDeChasse intermediaires={transmissionWithMetadata.intermediaires} />
            </Section>
            <Section title={`Carcasses (${allCarcassesForFei.length})`}>
              <div className="flex flex-col gap-4">
                {allCarcassesForFei.map((carcasse) => {
                  return (
                    <CardCarcasse
                      carcasse={carcasse}
                      key={carcasse.numero_bracelet}
                    />
                  );
                })}
              </div>
            </Section>
            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                priority="secondary"
                linkProps={{
                  to: `/app/circuit-court/`,
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
