import { Badge } from '@codegouvfr/react-dsfr/Badge';

interface HygieneScoreGaugeProps {
  score: number;
  maxScore?: number;
}

export default function HygieneScoreGauge({ score, maxScore = 100 }: HygieneScoreGaugeProps) {
  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  const radius = 55;
  const startX = 20;
  const startY = 70;
  const endX = 130;
  const endY = 70;

  const centerX = (startX + endX) / 2;
  const centerY = startY;

  const angleDegrees = 180 - (percentage / 100) * 180;
  const angleRad = (angleDegrees * Math.PI) / 180;

  const scoreEndX = centerX + radius * Math.cos(angleRad);
  const scoreEndY = centerY - radius * Math.sin(angleRad);

  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBackgroundColor = () => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    if (score >= 30) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'BON';
    if (score >= 30) return 'MOYEN';
    return 'À AMÉLIORER';
  };

  const getScoreIconColor = () => {
    if (score >= 80) return '#18753C';
    if (score >= 60) return '#D69E2E';
    if (score >= 30) return '#D69E2E';
    return '#D62E2E';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[150px]">
        <svg
          width="150"
          height="80"
          viewBox="0 0 150 80"
          className="overflow-visible"
        >
          <defs className="">
            <linearGradient
              id="gaugeGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop
                offset="0%"
                stopColor="#f87171"
              />
              <stop
                offset="50%"
                stopColor="#fbbf24"
              />
              <stop
                offset="100%"
                stopColor="#16a34a"
              />
            </linearGradient>
          </defs>
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
            stroke="url(#gaugeGradient)"
            strokeWidth="16"
            fill="none"
            strokeLinecap="square"
            className="opacity-30"
          />
          <circle
            cx={scoreEndX}
            cy={scoreEndY}
            r="6"
            fill={getScoreIconColor()}
          />
        </svg>
        <div className="absolute right-0 bottom-0 left-0 -mb-2 flex items-center justify-center">
          <div className={`text-5xl font-bold ${getScoreColor()}`}>{score}</div>
        </div>
      </div>
      <div className="mt-4">
        <Badge className={`${getScoreBackgroundColor()} ${getScoreColor()}`}>{getScoreLabel()}</Badge>
      </div>
    </div>
  );
}
