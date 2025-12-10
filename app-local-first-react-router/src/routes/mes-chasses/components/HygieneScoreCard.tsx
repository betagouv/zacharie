import HygieneScoreGauge from './HygieneScoreGauge';

interface HygieneScoreCardProps {
  score: number;
}

export default function HygieneScoreCard({ score }: HygieneScoreCardProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center">
        <HygieneScoreGauge score={score} />
        <div className="mt-4 text-center">
          <div className="text-action-high-blue-france-light mb-2 text-xl font-bold">
            score de respect des pratiques d'hygiène
          </div>
          <button
            type="button"
            className="text-action-high-blue-france-light mt-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
            aria-label="Plus d'informations"
          >
            <span className="text-xs font-bold">?</span>
          </button>
        </div>
      </div>
    </div>
  );
}
