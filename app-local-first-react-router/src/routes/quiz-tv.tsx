import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { trackEvent } from '@app/services/matomo';
import { capture } from '@app/services/sentry';

interface LeaderboardEntry {
  display_name: string;
  score: number;
  total_questions: number;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL;
const POLL_INTERVAL_MS = 30_000;

export default function QuizTvPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [quizUrl, setQuizUrl] = useState<string>('');

  useEffect(() => {
    setQuizUrl(`${window.location.origin}/quiz?from=tv`);
    trackEvent('QuizTv', 'view');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/quiz-result/leaderboard`);
        const json = (await res.json()) as { ok: boolean; data?: { leaderboard: LeaderboardEntry[] } };
        if (!cancelled && json.ok && json.data?.leaderboard) {
          setLeaderboard(json.data.leaderboard);
        }
      } catch (err) {
        capture(err as Error, { extra: { stage: 'quiz-tv-leaderboard' } });
      }
    }
    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <main role="main" id="content" className="fr-background-alt--blue-france min-h-screen">
      <title>Quiz Zacharie — Stand</title>
      <div className="flex min-h-screen flex-col items-stretch p-8 md:flex-row md:gap-12 md:p-16">
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <img
            src="/logo_zacharie.svg"
            alt="Zacharie"
            className="fr-mb-5w h-32 w-auto md:h-48"
          />
          <h1 className="fr-display--xs md:fr-display--md fr-mb-3w">
            Du prélèvement à l’assiette : êtes-vous sûrs de vos pratiques ?
          </h1>
          <p className="fr-text--lg fr-mb-5w">Testez vos connaissances en 3 minutes.</p>
          {quizUrl && (
            <div className="rounded-lg bg-white p-6 shadow-md">
              <QRCodeSVG value={quizUrl} size={320} level="M" includeMargin />
            </div>
          )}
          <p className="fr-mt-3w fr-text--lg font-semibold">Scannez pour commencer.</p>
        </section>

        <section className="flex flex-1 flex-col justify-center">
          <h2 className="fr-h3 fr-mb-3w">Top 5 du jour</h2>
          {leaderboard.length === 0 ? (
            <p className="fr-text--lg text-gray-700">Soyez le premier à inscrire votre nom !</p>
          ) : (
            <ol className="space-y-3">
              {leaderboard.map((entry, idx) => (
                <li
                  key={`${entry.display_name}-${entry.created_at}`}
                  className="flex items-baseline justify-between rounded-md bg-white px-4 py-3 text-2xl shadow-sm"
                >
                  <span>
                    <span className="fr-mr-1w font-bold">{idx + 1}.</span>
                    {entry.display_name}
                  </span>
                  <span className="font-mono">
                    {entry.score}/{entry.total_questions}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
