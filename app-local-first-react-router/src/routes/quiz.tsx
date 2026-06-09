import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { trackEvent } from '@app/services/matomo';
import { selectStratifiedQuestions, type QuizQuestion } from '@app/utils/quiz-shuffle';
import questionBank from '@app/data/quiz-prelevement-assiette.json';
import { capture } from '@app/services/sentry';

type Stage = 'intro' | 'playing' | 'result';
type Source = 'tv' | 'menu' | 'direct';

interface LeaderboardEntry {
  display_name: string;
  score: number;
  total_questions: number;
  created_at: string;
}

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof window === 'undefined') return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' && window.location.origin.includes('localhost')) {
      return `http://localhost:${url.port}`;
    }
    return raw.replace(/\/$/, '');
  } catch {
    return raw;
  }
}

const API_BASE = getApiBase();

function readSource(value: string | null): Source {
  return value === 'tv' || value === 'menu' ? value : 'direct';
}

export default function QuizPage() {
  const [searchParams] = useSearchParams();
  const source = useMemo(() => readSource(searchParams.get('from')), [searchParams]);

  const [stage, setStage] = useState<Stage>('intro');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stage, currentIndex]);

  const score = answers.filter(Boolean).length;
  const total = questions.length || 7;

  function handleStart() {
    const picked = selectStratifiedQuestions(questionBank as QuizQuestion[]);
    setQuestions(picked);
    setCurrentIndex(0);
    setAnswers([]);
    setRevealed(false);
    setResultId(null);
    setSubmitError(null);
    setDisplayName('');
    setNameSubmitted(false);
    setNameError(null);
    startedAtRef.current = Date.now();
    setStage('playing');
    trackEvent('Quiz', 'start');
  }

  function handleAnswer(given: boolean) {
    if (revealed) return;
    const current = questions[currentIndex];
    if (!current) return;
    const correct = given === current.answer;
    setAnswers((prev) => [...prev, correct]);
    setRevealed(true);
    trackEvent('Quiz', 'answer', current.id, correct ? 1 : 0);
  }

  function handleNext() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    setStage('result');
    const finalScore = answers.filter(Boolean).length;
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    trackEvent('Quiz', 'complete', undefined, finalScore);
    submitResult(finalScore, durationSeconds);
    void fetchLeaderboard();
  }

  async function submitResult(finalScore: number, durationSeconds: number) {
    setSubmitError(null);
    try {
      const payload = {
        score: finalScore,
        totalQuestions: questions.length,
        answers: questions.map((q, idx) => {
          const correct = !!answers[idx];
          const givenAnswer = correct ? q.answer : !q.answer;
          return { questionId: q.id, givenAnswer, correct };
        }),
        durationSeconds,
        source,
      };
      const res = await fetch(`${API_BASE}/quiz-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; data?: { id: string }; error?: string };
      if (res.ok && json.ok && json.data?.id) {
        setResultId(json.data.id);
        return;
      }
      setSubmitError(json.error ?? `Erreur ${res.status} : enregistrement impossible.`);
      capture(new Error('quiz submitResult non-ok'), {
        extra: { status: res.status, body: json, payload },
      });
    } catch (err) {
      setSubmitError('Connexion au serveur impossible. Vérifiez votre réseau et réessayez.');
      capture(err as Error, { extra: { stage: 'submitResult' } });
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/quiz-result/leaderboard`);
      const json = (await res.json()) as { ok: boolean; data?: { leaderboard: LeaderboardEntry[] } };
      if (json.ok && json.data?.leaderboard) {
        setLeaderboard(json.data.leaderboard);
      }
    } catch (err) {
      capture(err as Error, { extra: { stage: 'fetchLeaderboard' } });
    }
  }

  async function handleSubmitName() {
    if (!resultId || !displayName.trim()) return;
    setNameError(null);
    try {
      const res = await fetch(`${API_BASE}/quiz-result/${resultId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setNameSubmitted(true);
        trackEvent('Quiz', 'name_submitted');
        void fetchLeaderboard();
      } else {
        setNameError(json.error ?? 'Impossible d’enregistrer ce pseudo.');
        trackEvent('Quiz', 'name_rejected');
      }
    } catch (err) {
      capture(err as Error, { extra: { stage: 'handleSubmitName' } });
      setNameError('Une erreur est survenue, veuillez réessayer.');
    }
  }

  return (
    <main
      role="main"
      id="content"
      className="fr-background-alt--blue-france min-h-full overflow-auto"
    >
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <title>Testez vos connaissances sur la valorisation du gibier | Zacharie</title>
        <div className="fr-grid-row fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-8 p-4 md:p-0">
            {stage === 'intro' && <IntroScreen onStart={handleStart} />}
            {stage === 'playing' && questions[currentIndex] && (
              <PlayingScreen
                question={questions[currentIndex]}
                index={currentIndex}
                total={questions.length}
                revealed={revealed}
                lastCorrect={answers[currentIndex] ?? null}
                onAnswer={handleAnswer}
                onNext={handleNext}
              />
            )}
            {stage === 'result' && (
              <ResultScreen
                score={score}
                total={total}
                resultId={resultId}
                submitError={submitError}
                displayName={displayName}
                onDisplayNameChange={setDisplayName}
                nameSubmitted={nameSubmitted}
                nameError={nameError}
                onSubmitName={handleSubmitName}
                leaderboard={leaderboard}
                onReplay={() => {
                  trackEvent('Quiz', 'replay');
                  handleStart();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-white p-6 md:p-10 md:shadow-sm">
      <h1 className="fr-h2 fr-mb-2w">Testez vos connaissances sur la valorisation du gibier</h1>
      <p className="fr-mb-3w">
        Répondez à 7 questions qui mettront au défi vos connaissances sur les bonnes pratiques d'hygiène, la
        trichine mais aussi les filières de valorisation.
      </p>
      <div className="text-right">
        <Button
          onClick={onStart}
          size="large"
        >
          Commencer le quiz
        </Button>
      </div>
    </div>
  );
}

interface PlayingScreenProps {
  question: QuizQuestion;
  index: number;
  total: number;
  revealed: boolean;
  lastCorrect: boolean | null;
  onAnswer: (given: boolean) => void;
  onNext: () => void;
}

function PlayingScreen({
  question,
  index,
  total,
  revealed,
  lastCorrect,
  onAnswer,
  onNext,
}: PlayingScreenProps) {
  const isLast = index + 1 === total;
  return (
    <div className="bg-white p-6 md:p-10 md:shadow-sm">
      <p className="fr-text--sm fr-mb-1w text-gray-600">
        Question {index + 1} / {total}
      </p>
      <h2 className="fr-h4 fr-mb-3w">{question.question}</h2>

      {!revealed && (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            onClick={() => onAnswer(true)}
            size="large"
            className="flex-1 justify-center"
          >
            Vrai
          </Button>
          <Button
            onClick={() => onAnswer(false)}
            size="large"
            priority="secondary"
            className="flex-1 justify-center"
          >
            Faux
          </Button>
        </div>
      )}

      {revealed && (
        <div className="flex flex-col gap-4">
          <Alert
            severity={lastCorrect ? 'success' : 'error'}
            title={lastCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'}
            description={''}
            small
          />
          <div className="text-center">
            <h2>{question.answer ? 'VRAI' : 'FAUX'}&nbsp;!</h2>
          </div>
          {question.why && (
            <div>
              <p className="font-bold">{question.why}</p>
            </div>
          )}
          {question.takeaway && (
            <div>
              <p>{question.takeaway}</p>
            </div>
          )}
          <p>
            <a
              href="/demarches"
              target="_blank"
            >
              En savoir plus sur les bonnes pratiques
            </a>
          </p>
          <div className="text-right">
            <Button
              onClick={onNext}
              size="large"
            >
              {isLast ? 'Voir mon score' : 'Question suivante'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResultScreenProps {
  score: number;
  total: number;
  resultId: string | null;
  submitError: string | null;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  nameSubmitted: boolean;
  nameError: string | null;
  onSubmitName: () => void;
  leaderboard: LeaderboardEntry[];
  onReplay: () => void;
}

function ResultScreen({
  score,
  total,
  resultId,
  submitError,
  displayName,
  onDisplayNameChange,
  nameSubmitted,
  nameError,
  onSubmitName,
  leaderboard,
  onReplay,
}: ResultScreenProps) {
  const ratio = total === 0 ? 0 : score / total;
  let mood: { title: string; description: string };
  if (ratio < 0.5) {
    mood = {
      title: `Vous avez un score de ${score}/${total}`,
      description:
        'Il y a matière à progresser. Les bonnes pratiques sanitaires se construisent avec un peu d’entraînement.',
    };
  } else if (ratio < 0.8) {
    mood = {
      title: `Vous avez un score de ${score}/${total}`,
      description: 'Bon score ! Quelques notions à consolider pour devenir incollable.',
    };
  } else {
    mood = {
      title: `Vous avez un score de ${score}/${total}`,
      description: 'Excellent ! Vos pratiques sont solides — partagez-les autour de vous.',
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white p-6 md:p-10 md:shadow-sm">
        <h1 className="fr-h3 fr-mb-2w">{mood.title}</h1>
        <p className="fr-mb-3w">
          {mood.description}&nbsp;
          <br />
          <a
            href="/demarches"
            target="_blank"
            onClick={() => trackEvent('Quiz', 'cta_demarches')}
          >
            En savoir plus sur les bonnes pratiques
          </a>
        </p>
        {!nameSubmitted && (
          <div className="fr-mt-6w">
            <h2 className="fr-h6 fr-mb-1w">Apparaître dans le top 5 du jour ?</h2>
            {submitError && (
              <Alert
                severity="warning"
                small
                title="Score non enregistré"
                description={submitError}
                className="fr-mb-2w"
              />
            )}
            <Input
              label="Votre pseudo"
              hintText="Optionnel — il sera affiché publiquement sur le classement du jour."
              state={nameError ? 'error' : 'default'}
              stateRelatedMessage={nameError ?? undefined}
              nativeInputProps={{
                value: displayName,
                onChange: (e) => onDisplayNameChange(e.target.value),
                maxLength: 30,
              }}
            />
            <Button
              onClick={onSubmitName}
              disabled={!displayName.trim() || !resultId}
            >
              {resultId ? 'Publier mon score' : 'Enregistrement en cours…'}
            </Button>
          </div>
        )}

        {nameSubmitted && (
          <Alert
            severity="success"
            small
            title="Pseudo enregistré"
            description="Bonne chance pour le top 5 !"
          />
        )}
      </div>
      <div className="text-center">
        <Button
          onClick={onReplay}
          size="large"
        >
          Rejouer
        </Button>
      </div>

      <div className="bg-white p-6 md:p-10 md:shadow-sm">
        <h2 className="fr-h5 fr-mb-2w">Top 5 du jour</h2>
        {leaderboard.length === 0 ? (
          <p className="text-gray-600">Soyez le premier à enregistrer votre score !</p>
        ) : (
          <ol className="space-y-2">
            {leaderboard.map((entry, idx) => (
              <li
                key={`${entry.display_name}-${entry.created_at}`}
                className="flex justify-between border-b border-gray-100 py-2"
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
      </div>
    </div>
  );
}
