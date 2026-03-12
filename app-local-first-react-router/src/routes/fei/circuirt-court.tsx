import { useMemo } from 'react';
import { useParams } from 'react-router';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from './donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';

export default function CircuitCourt() {
  const params = useParams();
  const myCarcasses = useMyCarcassesForFei(params.fei_numero);
  const allCarcassesForFei = useMemo(
    () => myCarcasses.sort(sortCarcassesApproved),
    [myCarcasses],
  );

  return (
    <>
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
    </>
  );
}
