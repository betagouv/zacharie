// Motifs de saisie liés au non-respect des Bonnes Pratiques d'Hygiène (BPH).
// Doit rester aligné avec api-express/src/utils/federation-stats.ts (BPH_PATTERNS).
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

// Un motif unique relève-t-il des BPH ?
export function isBphMotif(motif: string): boolean {
  const s = motif.toLowerCase();
  return BPH_PATTERNS.some((p) => s.includes(p));
}

// Une liste de motifs contient-elle au moins un motif BPH ?
export function hasBphMotif(motifs: Array<string> | null): boolean {
  return (motifs ?? []).some(isBphMotif);
}
