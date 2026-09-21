import villes from '@app/data/villes.json';

// Le fichier est volumineux (~39 000 communes) : les clés sont abrégées pour alléger le bundle.
type Ville = { c: string; v: string };

const DEFAULT_MAX_RESULTS = 30;

// Le référentiel des communes est en majuscules, sans accent ni apostrophe, et abrège
// « Saint(e) » en « ST(E) ». On ramène la saisie de l'utilisateur et le référentiel à
// cette même forme pour que « Sainte-Marie », « Ste Marie » et « STE MARIE » matchent.
export function normalizeVille(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      if (word === 'SAINT') return 'ST';
      if (word === 'SAINTE') return 'STE';
      return word;
    })
    .join(' ');
}

type IndexedVille = {
  code_postal: string;
  ville: string;
  code_postal_ville: string;
  normalized_ville: string;
};

let index: Array<IndexedVille> | null = null;

function getIndex(): Array<IndexedVille> {
  if (!index) {
    index = (villes as Array<Ville>).map((item) => ({
      code_postal: item.c,
      ville: item.v,
      code_postal_ville: `${item.c} ${item.v}`,
      normalized_ville: normalizeVille(item.v),
    }));
  }
  return index;
}

// Chaque mot recherché doit être le début d'un mot de la commune : « valdoule » trouve
// « STE MARIE - VALDOULE », « marie ste » aussi.
function everyTokenStartsAWord(name: string, tokens: Array<string>): boolean {
  const words = name.split(' ');
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

export function searchVilles(search: string, maxResults = DEFAULT_MAX_RESULTS): Array<string> {
  const query = normalizeVille(search);
  if (!query) {
    return [];
  }
  // Un code postal ne peut être qu'en tête de recherche : dans un nom de commune les chiffres
  // sont toujours en suffixe d'arrondissement (« MARSEILLE 01 »).
  const codePostal = query.match(/^\d{1,5}/)?.[0] ?? '';
  const nameQuery = query.slice(codePostal.length).trim();
  const tokens = nameQuery.split(' ').filter(Boolean);

  const scored = scoreVilles(codePostal, nameQuery, tokens);
  // Le code postal saisi peut être absent du référentiel (« 75000 ») ou ne pas correspondre à la
  // commune cherchée : plutôt que de ne rien proposer, on cherche alors sur le seul nom.
  const results = scored.length || !tokens.length ? scored : scoreVilles('', nameQuery, tokens);

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.item.ville.length !== b.item.ville.length) return a.item.ville.length - b.item.ville.length;
    return a.item.code_postal_ville.localeCompare(b.item.code_postal_ville);
  });

  return results.slice(0, maxResults).map(({ item }) => item.code_postal_ville);
}

function scoreVilles(
  codePostal: string,
  nameQuery: string,
  tokens: Array<string>
): Array<{ score: number; item: IndexedVille }> {
  const scored: Array<{ score: number; item: IndexedVille }> = [];
  for (const item of getIndex()) {
    if (codePostal && !item.code_postal.startsWith(codePostal)) {
      continue;
    }
    const name = item.normalized_ville;
    let score: number;
    if (!tokens.length) {
      score = 5;
    } else if (name === nameQuery) {
      score = 0;
    } else if (name.startsWith(`${nameQuery} `)) {
      // « ste » cherche « Sainte », pas « Stenay » : un préfixe qui tombe sur une fin de mot prime.
      score = 1;
    } else if (name.startsWith(nameQuery)) {
      score = 2;
    } else if (everyTokenStartsAWord(name, tokens)) {
      score = 3;
    } else if (tokens.every((token) => name.includes(token))) {
      score = 4;
    } else {
      continue;
    }
    scored.push({ score, item });
  }
  return scored;
}
