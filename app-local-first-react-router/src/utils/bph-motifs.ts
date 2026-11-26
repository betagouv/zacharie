export const BPH_PATTERNS = [
  "souillures d'origine digestive",
  "souillures d'origine digestive liées à une balle d'abdomen",
  'souillures telluriques',
  'odeur anormale',
  'putréfaction superficielle',
  'putréfaction profonde',
  'moisissures',
  'œufs ou larves de mouche',
  'morsure de chien',
  'conditions de préparation des viandes par le producteur primaire',
];

export function isBphMotif(motif: string) {
  const m = motif.toLowerCase();
  return BPH_PATTERNS.some((p) => m.includes(p.toLowerCase()));
}

export function hasBphMotif(motifs: Array<string>) {
  return motifs.some(isBphMotif);
}

export const NATIONAL_BPH_RATE_BIG_GAME = 5.49;

export function computeScoreBph(saisiesBph: number, inspectees: number): number | null {
  if (inspectees === 0) return null;
  const score = 100 * (1 - saisiesBph / inspectees / ((2 * NATIONAL_BPH_RATE_BIG_GAME) / 100));
  return Math.max(0, Math.min(100, Math.round(score)));
}

export const MOTIFS_DISQUALIFIANTS_PATTERNS = [
  "balle d'abdomen",
  'putréfaction superficielle',
  'putréfaction profonde',
];

export function hasMotifDisqualifiant(motifs: Array<string>) {
  return motifs.some((motif) => {
    const m = motif.toLowerCase();
    return MOTIFS_DISQUALIFIANTS_PATTERNS.some((p) => m.includes(p));
  });
}

export type MotifDatum = { motif: string; count: number; hygiene: boolean };

export function buildMotifData<T>(
  items: Array<T>,
  getMotifs: (item: T) => Array<string>,
  getWeight: (item: T) => number = () => 1
): MotifDatum[] {
  const motifCounts = new Map<string, number>();
  for (const item of items) {
    const weight = getWeight(item);
    for (const motif of getMotifs(item).filter(Boolean)) {
      motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + weight);
    }
  }
  return [...motifCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([motif, count]) => ({ motif, count, hygiene: isBphMotif(motif) }));
}
