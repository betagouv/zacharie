// Motifs de saisie liés aux Bonnes Pratiques d'Hygiène (BPH).
// Doit rester aligné avec la source canonique backend : api-express/src/utils/federation-stats.ts (BPH_PATTERNS).
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
