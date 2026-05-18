import { useMemo, useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import questionBank from '@app/data/quiz-prelevement-assiette.json';
import type { QuizQuestion } from '@app/utils/quiz-shuffle';

const THEME_LABELS: Record<string, string> = {
  'donnees-filiere': 'Données filière',
  'hygiene-tirs': 'Hygiène — Tirs',
  'hygiene-evisceration': 'Hygiène — Éviscération',
  'hygiene-refroidissement': 'Hygiène — Refroidissement',
  'hygiene-transport': 'Hygiène — Transport',
  'hygiene-manipulations': 'Hygiène — Manipulations autorisées',
  'examen-initial': 'Examen initial',
  trichine: 'Trichine',
  valorisation: 'Valorisation',
};

const THEME_ORDER = [
  'donnees-filiere',
  'hygiene-tirs',
  'hygiene-evisceration',
  'hygiene-refroidissement',
  'hygiene-transport',
  'hygiene-manipulations',
  'examen-initial',
  'trichine',
  'valorisation',
];

const allQuestions = questionBank as QuizQuestion[];

function matches(q: QuizQuestion, needle: string) {
  if (!needle) return true;
  const haystack = [q.id, q.question, q.why ?? '', q.takeaway ?? '', THEME_LABELS[q.theme] ?? q.theme]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export default function AdminQuiz() {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = allQuestions.filter((q) => matches(q, search));
    const map = new Map<string, QuizQuestion[]>();
    for (const theme of THEME_ORDER) map.set(theme, []);
    for (const q of filtered) {
      const list = map.get(q.theme) ?? [];
      list.push(q);
      map.set(q.theme, list);
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0);
  }, [search]);

  const totalShown = grouped.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className="fr-py-4w">
      <h1 className="fr-h3 fr-mb-1w">Quiz — Banque de questions</h1>
      <p className="fr-text--sm fr-mb-3w text-gray-600">
        {allQuestions.length} questions au total. Source :{' '}
        <code>src/data/quiz-prelevement-assiette.json</code>. Lecture seule — modifiez ce fichier pour mettre
        à jour la banque.
      </p>

      <Input
        label="Rechercher"
        hintText="Filtre sur l'énoncé, l'explication, le « À retenir » et le thème."
        nativeInputProps={{
          value: search,
          onChange: (e) => setSearch(e.target.value),
          placeholder: 'mot-clé…',
        }}
      />
      <p className="fr-text--sm fr-mb-3w text-gray-600">
        {totalShown} question{totalShown > 1 ? 's' : ''} affichée{totalShown > 1 ? 's' : ''}.
      </p>

      {grouped.map(([theme, items]) => (
        <section
          key={theme}
          className="fr-mb-5w"
        >
          <h2 className="fr-h5 fr-mb-2w">
            {THEME_LABELS[theme] ?? theme}
            <span className="fr-text--sm fr-ml-1w font-normal text-gray-600">({items.length})</span>
          </h2>
          <ul className="m-0 list-none space-y-3 p-0">
            {items.map((q) => (
              <li
                key={q.id}
                className="rounded-md border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="fr-text--sm font-mono text-gray-600">{q.id.toUpperCase()}</span>
                  <Badge
                    severity={q.answer ? 'success' : 'error'}
                    small
                  >
                    {q.answer ? 'Vrai' : 'Faux'}
                  </Badge>
                  {!q.why && !q.takeaway && (
                    <Badge
                      severity="info"
                      small
                    >
                      Énoncé seul
                    </Badge>
                  )}
                </div>
                <p className="fr-mt-1w fr-mb-1w font-medium">{q.question}</p>
                {q.why && (
                  <details className="fr-mt-1w">
                    <summary className="cursor-pointer text-sm text-gray-700">Pourquoi ?</summary>
                    <p className="fr-mt-1w fr-text--sm text-gray-800">{q.why}</p>
                  </details>
                )}
                {q.takeaway && (
                  <details className="fr-mt-1w">
                    <summary className="cursor-pointer text-sm text-gray-700">À retenir</summary>
                    <p className="fr-mt-1w fr-text--sm text-gray-800">{q.takeaway}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {grouped.length === 0 && <p className="text-gray-600">Aucune question ne correspond à la recherche.</p>}
    </div>
  );
}
