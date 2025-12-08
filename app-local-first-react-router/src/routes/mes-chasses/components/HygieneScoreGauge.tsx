interface HygieneScoreGaugeProps {
  score: number;
  maxScore?: number;
}

export default function HygieneScoreGauge({ score, maxScore = 100 }: HygieneScoreGaugeProps) {
  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  const radius = 50;
  const startX = 20;
  const startY = 70;
  const endX = 120;
  const endY = 70;

  // Calculate the circumference of the semicircle
  const circumference = Math.PI * radius;

  // Calculate how much of the arc should be filled
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Calculate the endpoint for the indicator dot
  // For arc M 20 70 A 50 50 0 0 1 120 70:
  // - SVG calculates the center at (70, 70) for the upper semicircle
  // - The arc spans 180 degrees (from 180° at left to 0° at right)
  // - At angle θ: x = 70 + 50*cos(θ), y = 70 - 50*sin(θ)
  const centerX = (startX + endX) / 2;
  const centerY = startY; // The center is at y=70

  // Calculate angle: 0% = 180° (left), 100% = 0° (right)
  const angleDegrees = 180 - (percentage / 100) * 180;
  const angleRad = (angleDegrees * Math.PI) / 180;

  // Calculate endpoint on the arc
  const scoreEndX = centerX + radius * Math.cos(angleRad);
  const scoreEndY = centerY - radius * Math.sin(angleRad);

  // Determine color based on score
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'BON';
    return 'À AMÉLIORER';
  };

  const getScoreColorClass = () => {
    if (score >= 75) return '#16a34a';
    if (score >= 30) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[140px]">
        <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
          <defs className="">
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          {/* Background arc (full semicircle) */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="opacity-50"
          />
          {/* Score arc using stroke-dasharray for precise control */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
            stroke={getScoreColorClass()}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
          {/* Score indicator dot */}
          <circle cx={scoreEndX} cy={scoreEndY} r="6" fill={getScoreColorClass()} />
        </svg>
        {/* Score text */}
        <div className="absolute right-0 bottom-0 left-0 flex items-center justify-center pt-2">
          <div className={`text-3xl font-bold ${getScoreColor()}`}>{score}</div>
        </div>
      </div>
      {/* Label */}
      <div className={`mt-2 flex items-center gap-1 text-sm font-semibold ${getScoreColor()}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L10 6H16L11 9L13 15L8 12L3 15L5 9L0 6H6L8 0Z" />
        </svg>
        {getScoreLabel()}
      </div>
    </div>
  );
}
