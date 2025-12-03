import { useMemo } from 'react';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from './donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';

export default function CircuitCourt() {
  const params = useParams();
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const allCarcassesForFei = useMemo(
    () =>
      (carcassesIdsByFei[params.fei_numero!] || [])
        .map((cId) => carcasses[cId])
        .sort(sortCarcassesApproved)
        .filter((carcasse) => !carcasse.deleted_at),
    [carcassesIdsByFei, params.fei_numero, carcasses],
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
