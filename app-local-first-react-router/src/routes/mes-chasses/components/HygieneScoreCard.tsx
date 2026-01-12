import HygieneScoreGauge from './HygieneScoreGauge';
import { Tooltip } from '@codegouvfr/react-dsfr/Tooltip';

interface HygieneScoreCardProps {
  score: number;
}

const getTooltipText = (score: number) => {
  if (score >= 80)
    return 'Excellent ! Vous respectez les bonnes pratiques d’hygiène garantissant une qualité et une valorisation optimale des viandes de grand gibier.';
  if (score >= 60)
    return 'Bon résultat, les bonnes pratiques d’hygiène sont globalement bien respectées pour le grand gibier.';
  if (score >= 30)
    return 'Attention, les bonnes pratiques d’hygiène doivent être améliorées pour garantir la qualité des viandes de grand gibier : éviscération et refroidissement rapides, protection de la viande contre les risques contaminations au cours de l’éviscération, du transport et du stockage.';
  return 'Des efforts importants sont nécessaires. Le respect strict des bonnes pratiques d’hygiène est indispensable pour assurer la sécurité et la valorisation des viandes de grand gibier : éviscération et refroidissement rapides, protection de la viande contre les risques contaminations au cours de l’éviscération, du transport et du stockage.';
};

export default function HygieneScoreCard({ score }: HygieneScoreCardProps) {
  return (
    <div className="col-span-2 rounded-3xl bg-white p-6 shadow-sm md:col-span-1">
      <div className="flex flex-col items-center">
        <HygieneScoreGauge score={score} />
        <div className="mt-4 text-center">
          <div className="text-action-high-blue-france-light mb-2 text-xl font-bold">
            score de respect des pratiques d'hygiène
          </div>
          <Tooltip style={{ textAlign: 'center' }} kind="hover" title={getTooltipText(score)} />
        </div>
      </div>
    </div>
  );
}
