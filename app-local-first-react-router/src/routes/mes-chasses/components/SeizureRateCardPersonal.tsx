import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip';

interface SeizureRateCardProps {
  rate: number;
  label: string;
}

export default function SeizureRateCard({ rate, label }: SeizureRateCardProps) {
  return (
    <div className="flex flex-col items-center justify-between rounded-3xl bg-white p-6 shadow-sm">
      <div className="text-action-high-blue-france-light mb-3 text-5xl font-bold">
        {rate.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
      </div>
      <div className="text-action-high-blue-france-light mb-4 text-base font-bold">{label}</div>
      <div className="flex justify-end">
        <Tooltip
          style={{ textAlign: 'center' }}
          kind="hover"
          title="Ce taux correspond au nombre de carcasses de grand gibier sauvage qui ont été retirées de la consommation humaine par les services vétérinaires en établissement de traitement du gibier sauvage. Une saisie traduit un problème sanitaire rendant la viande impropre à la consommation. "
        />
      </div>
    </div>
  );
}
