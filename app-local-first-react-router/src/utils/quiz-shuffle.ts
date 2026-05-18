export interface QuizQuestion {
  id: string;
  theme: string;
  subTheme: string | null;
  question: string;
  answer: boolean;
  why: string | null;
  takeaway: string | null;
}

const MAJOR_THEMES = [
  ['donnees-filiere'],
  [
    'hygiene-tirs',
    'hygiene-evisceration',
    'hygiene-refroidissement',
    'hygiene-transport',
    'hygiene-manipulations',
  ],
  ['examen-initial'],
  ['trichine'],
  ['valorisation'],
] as const;

const TARGET_LENGTH = 7;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function selectStratifiedQuestions(bank: QuizQuestion[]): QuizQuestion[] {
  const selected: QuizQuestion[] = [];
  const used = new Set<string>();

  for (const themeGroup of MAJOR_THEMES) {
    const pool = bank.filter((q) => themeGroup.includes(q.theme as never) && !used.has(q.id));
    if (pool.length === 0) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selected.push(pick);
    used.add(pick.id);
  }

  const remaining = bank.filter((q) => !used.has(q.id));
  const extras = shuffle(remaining).slice(0, TARGET_LENGTH - selected.length);
  for (const q of extras) {
    selected.push(q);
    used.add(q.id);
  }

  return shuffle(selected);
}
