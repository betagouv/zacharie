type DestinataireOption = { label: string | null; value: string };

export type DestinataireResult<T extends DestinataireOption> = {
  option: T;
  isFuzzy: boolean;
};

const SCORE_EXACT_WORD = 0;
const SCORE_WORD_START = 1;
const SCORE_INSIDE_WORD = 2;
const SCORE_TYPO = 3;

export function normalizeDestinataire(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function maxTypos(token: string): number {
  if (/^\d+$/.test(token)) return 0;
  if (token.length >= 8) return 2;
  if (token.length >= 5) return 1;
  return 0;
}

function typoDistanceToWordStart(token: string, word: string): number {
  const rows = token.length + 1;
  const cols = word.length + 1;
  const d: Array<Array<number>> = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = token[i - 1] === word[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && token[i - 1] === word[j - 2] && token[i - 2] === word[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return Math.min(...d[token.length]);
}

function isShortToken(token: string): boolean {
  return token.length <= 2;
}

function scoreToken(token: string, words: Array<string>, fullLabel: string): number | null {
  if (words.includes(token)) return SCORE_EXACT_WORD;
  if (words.some((word) => word.startsWith(token))) return SCORE_WORD_START;
  if (isShortToken(token)) return null;
  if (fullLabel.includes(token)) return SCORE_INSIDE_WORD;
  const allowed = maxTypos(token);
  if (!allowed) return null;
  let best: number | null = null;
  for (const word of words) {
    const distance = typoDistanceToWordStart(token, word);
    if (distance <= allowed && (best === null || distance < best)) best = distance;
  }
  return best === null ? null : SCORE_TYPO + best;
}

export function searchDestinataires<T extends DestinataireOption>(
  options: Array<T>,
  search: string
): Array<DestinataireResult<T>> {
  const query = normalizeDestinataire(search);
  if (!query) return [];
  const allTokens = query.split(' ');
  const meaningfulTokens = allTokens.filter((token) => !isShortToken(token) || /^\d+$/.test(token));
  const tokens = meaningfulTokens.length ? meaningfulTokens : allTokens;

  const scored: Array<{ score: number; isFuzzy: boolean; label: string; option: T }> = [];
  for (const option of options) {
    const label = normalizeDestinataire(option.label ?? '');
    if (!label) continue;
    const words = label.split(' ');
    let score = 0;
    let isFuzzy = false;
    let matches = true;
    for (const token of tokens) {
      const tokenScore = scoreToken(token, words, label);
      if (tokenScore === null) {
        matches = false;
        break;
      }
      score += tokenScore;
      if (tokenScore >= SCORE_TYPO) isFuzzy = true;
    }
    if (matches) scored.push({ score, isFuzzy, label, option });
  }

  scored.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
  return scored.map(({ option, isFuzzy }) => ({ option, isFuzzy }));
}
