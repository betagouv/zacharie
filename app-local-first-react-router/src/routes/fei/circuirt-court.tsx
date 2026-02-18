import { useMemo } from 'react';
import { useParams } from 'react-router';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from './donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';

export default function CircuitCourt() {
  const params = useParams();
  const feiCarcasses = useCarcassesForFei(params.fei_numero);
  const myCarcasses = useMyCarcassesForFei(params.fei_numero);
  const hiddenCount = feiCarcasses.length - myCarcasses.length;
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
        {hiddenCount > 0 && (
          <p className="my-2 text-sm text-gray-400 italic">
            {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} carcasse{hiddenCount > 1 ? 's' : ''} sur cette fiche ne vous concern{hiddenCount > 1 ? 'ent' : 'e'} pas
          </p>
        )}
        <div className="flex flex-col gap-4">
          {allCarcassesForFei.map((carcasse) => {
            return <CardCarcasse carcasse={carcasse} key={carcasse.numero_bracelet} />;
          })}
        </div>
      </Section>
    </>
  );
}
