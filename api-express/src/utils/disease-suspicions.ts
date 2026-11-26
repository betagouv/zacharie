import { CarcasseType } from '@prisma/client';

export const PG_POILS_ESPECES = ['Lapins', 'Lièvres', 'Autres petits gibiers à poils'];

const GG_ABATS_TUBERCULOSE = [
  'Abcès - Système respiratoire (trachée, poumons)',
  'Abcès - Système digestif (foie, intestins)',
  'Ganglions volumineux (intestins) - Système digestif (foie, intestins)',
];
const GG_CARCASSE_TUBERCULOSE = ['Abcès unique - Externe'];

const GG_ABATS_PESTE_PORCINE = [
  'Lésions hémorragiques - Système respiratoire (trachée, poumons)',
  'Lésions hémorragiques - Système digestif (foie, intestins)',
  'Cœur anormal - Système circulatoire (cœur)',
];

const PG_CARCASSE_TULAREMIE = [
  'Abcès',
  "Déformation d'une ou plusieurs articulations",
  'Déformation de la tête',
];
const PG_CARCASSE_BRUCELLOSE = ['Testicules gonflés ou consistance anormale'];

export const REFERENTIEL_CANONICALS = {
  gros: [...GG_CARCASSE_TUBERCULOSE, ...GG_ABATS_TUBERCULOSE, ...GG_ABATS_PESTE_PORCINE],
  petit: [...PG_CARCASSE_TULAREMIE, ...PG_CARCASSE_BRUCELLOSE],
};

export interface CarcasseLike {
  type: CarcasseType | null;
  espece: string | null;
  examinateur_anomalies_carcasse: string[];
  examinateur_anomalies_abats: string[];
}

function anyOf(arr: string[] | null | undefined, canonicals: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  return arr.some((anomalie) => canonicals.includes(anomalie));
}

export function matchTuberculose(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;

  return (
    anyOf(c.examinateur_anomalies_carcasse, GG_CARCASSE_TUBERCULOSE) ||
    anyOf(c.examinateur_anomalies_abats, GG_ABATS_TUBERCULOSE)
  );
}

export function matchPestePorcine(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.GROS_GIBIER) return false;
  if (c.espece !== 'Sanglier') return false;

  return anyOf(c.examinateur_anomalies_abats, GG_ABATS_PESTE_PORCINE);
}

export function matchBrucellose(c: CarcasseLike): boolean {
  const isPgPoils = c.type === CarcasseType.PETIT_GIBIER && !!c.espece && PG_POILS_ESPECES.includes(c.espece);
  if (!isPgPoils) return false;

  return anyOf(c.examinateur_anomalies_carcasse, PG_CARCASSE_BRUCELLOSE);
}

export function matchTularemie(c: CarcasseLike): boolean {
  if (c.type !== CarcasseType.PETIT_GIBIER) return false;
  if (c.espece !== 'Lièvres') return false;

  return anyOf(c.examinateur_anomalies_carcasse, PG_CARCASSE_TULAREMIE);
}
